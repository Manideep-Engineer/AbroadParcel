using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public record ProposeBookingRequest(
    Guid ConversationId,
    [Range(100, 1_000_000)] long DeliveryFeeCents,
    [Required, MaxLength(200)] string MeetingPlace,
    DateTime MeetingAt,
    [Required, MaxLength(200)] string PickupPlace,
    [Required, MaxLength(120)] string RecipientName,
    [Required, Phone, MaxLength(30)] string RecipientPhone);

public record CodeRequest([Required] string Code);
public record ReviewRequest([Range(1, 5)] int Rating, [MaxLength(1000)] string? Comment);

[Authorize, Route("api/bookings")]
public class BookingsController(
    AppDbContext db,
    IPaymentGateway payments,
    BookingWorkflow workflow,
    FeeCalculator fees,
    IConfiguration config) : ApiController(db)
{
    private const int MaxCodeAttempts = 5;

    private IQueryable<Booking> Full => Db.Bookings
        .Include(b => b.Conversation).ThenInclude(c => c.Listing).ThenInclude(l => l.Sender)
        .Include(b => b.Conversation).ThenInclude(c => c.Trip).ThenInclude(t => t.Traveler)
        .Include(b => b.Reviews);

    [HttpGet]
    public async Task<IActionResult> Mine()
    {
        var bookings = await Full.AsNoTracking()
            .Where(b => b.Conversation.Listing.SenderId == UserId || b.Conversation.Trip.TravelerId == UserId)
            .OrderByDescending(b => b.CreatedAt).ToListAsync();
        return Ok(bookings.Select(View));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id) => Ok(View(await LoadAsync(id)));

    [HttpGet("fee-preview")]
    public IActionResult FeePreview(long deliveryFeeCents) =>
        Ok(new { processingFeeCents = fees.ProcessingFeeCents(deliveryFeeCents) });

    [HttpPost]
    public async Task<IActionResult> Propose(ProposeBookingRequest request)
    {
        await VerifiedUserAsync();
        var conversation = await Db.Conversations.Include(c => c.Listing).Include(c => c.Trip)
            .FirstOrDefaultAsync(c => c.Id == request.ConversationId) ?? throw new NotFoundException();
        if (conversation.Listing.SenderId != UserId)
            throw new ForbiddenException("Only the sender can propose delivery terms.");
        if (conversation.Listing.Status != ListingStatus.Open)
            throw new BadRequestException("This parcel is no longer open.");
        if (request.MeetingAt <= DateTime.UtcNow)
            throw new BadRequestException("The meeting time must be in the future.");

        var open = await Db.Bookings.AnyAsync(b => b.ConversationId == conversation.Id &&
            (b.Status == BookingStatus.Proposed || b.Status == BookingStatus.AwaitingPayment));
        if (open) throw new BadRequestException("There is already an active proposal in this chat.");

        var booking = new Booking
        {
            ConversationId = conversation.Id,
            DeliveryFeeCents = request.DeliveryFeeCents,
            ProcessingFeeCents = fees.ProcessingFeeCents(request.DeliveryFeeCents),
            MeetingPlace = request.MeetingPlace.Trim(),
            MeetingAt = request.MeetingAt.ToUniversalTime(),
            PickupPlace = request.PickupPlace.Trim(),
            RecipientName = request.RecipientName.Trim(),
            RecipientPhone = request.RecipientPhone.Trim(),
            RecipientToken = Codes.Token(),
            HandoverCode = Codes.SixDigits(),
            DeliveryPin = Codes.SixDigits(),
        };
        Db.Bookings.Add(booking);
        await Db.SaveChangesAsync();
        return Ok(new { booking.Id });
    }

    [HttpPost("{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id) => await TravelerResponds(id, BookingStatus.AwaitingPayment);

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id) => await TravelerResponds(id, BookingStatus.Rejected);

    private async Task<IActionResult> TravelerResponds(Guid id, BookingStatus next)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Trip.TravelerId != UserId) throw new ForbiddenException();
        Require(booking, BookingStatus.Proposed);
        booking.Status = next;
        await Db.SaveChangesAsync();
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> Pay(Guid id)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Listing.SenderId != UserId) throw new ForbiddenException();
        Require(booking, BookingStatus.AwaitingPayment);
        EnsureStillAvailable(booking);

        var returnUrl = $"{config["App:PublicUrl"]}/bookings/{booking.Id}";
        var checkoutUrl = await payments.CreateHoldAsync(booking, returnUrl);
        return Ok(new { checkoutUrl, simulated = payments.IsSimulated });
    }

    /// <summary>Stands in for Adyen's webhook while no API key is configured.</summary>
    [HttpPost("{id:guid}/simulate-payment")]
    public async Task<IActionResult> SimulatePayment(Guid id)
    {
        if (!payments.IsSimulated) return NotFound();
        var booking = await LoadAsync(id);
        if (booking.Conversation.Listing.SenderId != UserId) throw new ForbiddenException();
        EnsureStillAvailable(booking);
        await workflow.MarkHeldAsync(booking, $"SIM-{Guid.NewGuid():N}");
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/handover")]
    public async Task<IActionResult> ConfirmHandover(Guid id, CodeRequest request)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Trip.TravelerId != UserId) throw new ForbiddenException();
        Require(booking, BookingStatus.Held);
        await CheckCodeAsync(booking, booking.HandoverCode, request.Code);

        booking.Status = BookingStatus.HandedOver;
        booking.HandedOverAt = DateTime.UtcNow;
        await Db.SaveChangesAsync();
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/decline")]
    public async Task<IActionResult> Decline(Guid id)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Trip.TravelerId != UserId) throw new ForbiddenException();
        Require(booking, BookingStatus.Held);
        await workflow.RefundAsync(booking, BookingStatus.Declined);
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/cancel-flight")]
    public async Task<IActionResult> CancelForFlight(Guid id)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Listing.SenderId != UserId && booking.Conversation.Trip.TravelerId != UserId)
            throw new ForbiddenException();
        Require(booking, BookingStatus.Held);
        await workflow.RefundAsync(booking, BookingStatus.Cancelled);
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/deliver")]
    public async Task<IActionResult> ConfirmDelivery(Guid id, CodeRequest request)
    {
        var booking = await LoadAsync(id);
        if (booking.Conversation.Trip.TravelerId != UserId) throw new ForbiddenException();
        Require(booking, BookingStatus.HandedOver);
        await CheckCodeAsync(booking, booking.DeliveryPin, request.Code);
        await workflow.ReleaseAsync(booking);
        return Ok(View(booking));
    }

    [HttpPost("{id:guid}/reviews")]
    public async Task<IActionResult> AddReview(Guid id, ReviewRequest request)
    {
        var booking = await LoadAsync(id);
        Require(booking, BookingStatus.Delivered);
        var senderId = booking.Conversation.Listing.SenderId;
        var subjectId = senderId == UserId ? booking.Conversation.Trip.TravelerId : senderId;
        if (booking.Reviews.Any(r => r.AuthorId == UserId))
            throw new BadRequestException("You've already reviewed this delivery.");

        Db.Reviews.Add(new Review
        {
            BookingId = id,
            AuthorId = UserId,
            SubjectId = subjectId,
            Rating = request.Rating,
            Comment = request.Comment?.Trim(),
        });
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<Booking> LoadAsync(Guid id)
    {
        var booking = await Full.FirstOrDefaultAsync(b => b.Id == id) ?? throw new NotFoundException();
        if (booking.Conversation.Listing.SenderId != UserId && booking.Conversation.Trip.TravelerId != UserId)
            throw new ForbiddenException();
        return booking;
    }

    private static void EnsureStillAvailable(Booking booking)
    {
        var listing = booking.Conversation.Listing;
        if (listing.Status != ListingStatus.Open)
            throw new BadRequestException("This parcel is already booked or closed.");
        if (listing.WeightKg > booking.Conversation.Trip.AvailableKg)
            throw new BadRequestException("The traveler no longer has enough space for this parcel.");
    }

    private static void Require(Booking booking, BookingStatus status)
    {
        if (booking.Status != status)
            throw new BadRequestException("This delivery has moved on. Refresh the page.");
    }

    private async Task CheckCodeAsync(Booking booking, string expected, string entered)
    {
        if (booking.FailedCodeAttempts >= MaxCodeAttempts)
            throw new BadRequestException("Too many incorrect codes. Please contact support.");
        if (!Codes.Same(expected, entered.Trim()))
        {
            booking.FailedCodeAttempts++;
            await Db.SaveChangesAsync();
            throw new BadRequestException("That code is incorrect.");
        }
        booking.FailedCodeAttempts = 0;
    }

    private object View(Booking b)
    {
        var listing = b.Conversation.Listing;
        var trip = b.Conversation.Trip;
        var isSender = listing.SenderId == UserId;
        return new
        {
            b.Id,
            b.ConversationId,
            b.Status,
            Role = isSender ? "Sender" : "Traveler",
            b.DeliveryFeeCents,
            // The processing fee is the sender's cost, so travelers don't see it.
            ProcessingFeeCents = isSender ? b.ProcessingFeeCents : (long?)null,
            TotalCents = isSender ? b.TotalCents : (long?)null,
            b.MeetingPlace,
            b.MeetingAt,
            b.PickupPlace,
            b.RecipientName,
            // The traveler only needs the number once they're carrying the item.
            RecipientPhone = isSender || b.Status == BookingStatus.HandedOver ? b.RecipientPhone : null,
            RecipientLink = isSender && b.Status is BookingStatus.Held or BookingStatus.HandedOver
                ? $"{config["App:PublicUrl"]}/r/{b.RecipientToken}" : null,
            HandoverCode = isSender && b.Status == BookingStatus.Held ? b.HandoverCode : null,
            b.CreatedAt,
            b.HandedOverAt,
            b.DeliveredAt,
            CanReview = b.Status == BookingStatus.Delivered && b.Reviews.All(r => r.AuthorId != UserId),
            Listing = new { listing.Id, listing.Title, listing.Description, listing.WeightKg },
            Trip = new { trip.Id, trip.FromAirport, trip.ToAirport, trip.FlightDate },
            SenderName = listing.Sender.FullName,
            TravelerName = trip.Traveler.FullName,
        };
    }
}
