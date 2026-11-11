using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public record ReviewDecision(bool Approve, [MaxLength(300)] string? Reason);

[Authorize(Roles = nameof(UserRole.Admin)), Route("api/admin")]
public class AdminController(AppDbContext db, FileStore files) : ApiController(db)
{
    [HttpGet("overview")]
    public async Task<IActionResult> Overview() => Ok(new
    {
        users = await Db.Users.CountAsync(),
        pendingIds = await Db.Users.CountAsync(u => u.IdStatus == ReviewStatus.Pending),
        pendingFlights = await Db.Trips.CountAsync(t => t.FlightStatus == ReviewStatus.Pending),
        activeBookings = await Db.Bookings.CountAsync(b => b.Status == BookingStatus.Held || b.Status == BookingStatus.HandedOver),
        requestedWithdrawals = await Db.Withdrawals.CountAsync(w => w.Status == WithdrawalStatus.Requested),
    });

    [HttpGet("users")]
    public async Task<IActionResult> Users() => Ok(await Db.Users.AsNoTracking()
        .OrderByDescending(u => u.CreatedAt)
        .Select(u => new
        {
            u.Id, u.FullName, u.Email, u.PhoneNumber, u.Role, u.PhoneVerified, u.IdStatus,
            u.IdRejectionReason, u.WalletBalanceCents, u.CreatedAt,
            HasIdDocument = u.IdDocumentFile != null,
            ListingCount = Db.Listings.Count(l => l.SenderId == u.Id),
            TripCount = Db.Trips.Count(t => t.TravelerId == u.Id),
        }).ToListAsync());

    [HttpGet("users/{id:guid}/id-document")]
    public async Task<IActionResult> IdDocument(Guid id)
    {
        var name = await Db.Users.Where(u => u.Id == id).Select(u => u.IdDocumentFile).FirstOrDefaultAsync();
        return ServeFile(name);
    }

    [HttpPost("users/{id:guid}/id-review")]
    public async Task<IActionResult> ReviewId(Guid id, ReviewDecision decision)
    {
        var user = await Db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw new NotFoundException();
        user.IdStatus = decision.Approve ? ReviewStatus.Approved : ReviewStatus.Rejected;
        user.IdRejectionReason = decision.Approve ? null : decision.Reason;
        await Db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("trips")]
    public async Task<IActionResult> Trips() => Ok(await Db.Trips.AsNoTracking()
        .OrderByDescending(t => t.CreatedAt)
        .Select(t => new
        {
            t.Id, t.FromAirport, t.ToAirport, t.FlightDate, t.AvailableKg, t.FlightStatus, t.RejectionReason, t.IsClosed,
            TravelerName = t.Traveler.FullName, TravelerEmail = t.Traveler.Email,
        }).ToListAsync());

    [HttpGet("trips/{id:guid}/booking-document")]
    public async Task<IActionResult> BookingDocument(Guid id)
    {
        var name = await Db.Trips.Where(t => t.Id == id).Select(t => t.BookingDocumentFile).FirstOrDefaultAsync();
        return ServeFile(name);
    }

    [HttpPost("trips/{id:guid}/flight-review")]
    public async Task<IActionResult> ReviewFlight(Guid id, ReviewDecision decision)
    {
        var trip = await Db.Trips.FirstOrDefaultAsync(t => t.Id == id) ?? throw new NotFoundException();
        trip.FlightStatus = decision.Approve ? ReviewStatus.Approved : ReviewStatus.Rejected;
        trip.RejectionReason = decision.Approve ? null : decision.Reason;
        await Db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("listings")]
    public async Task<IActionResult> Listings() => Ok(await Db.Listings.AsNoTracking()
        .OrderByDescending(l => l.CreatedAt)
        .Select(l => new
        {
            l.Id, l.Title, l.WeightKg, l.OriginCity, l.OriginCountry, l.DestinationCity, l.DestinationCountry, l.Status, l.CreatedAt,
            SenderName = l.Sender.FullName, SenderEmail = l.Sender.Email,
        }).ToListAsync());

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings() => Ok(await Db.Bookings.AsNoTracking()
        .OrderByDescending(b => b.CreatedAt)
        .Select(b => new
        {
            b.Id, b.ConversationId, b.Status, b.DeliveryFeeCents, b.ProcessingFeeCents, b.MeetingPlace, b.MeetingAt, b.PickupPlace,
            b.RecipientName, b.RecipientPhone, b.PaymentReference, b.CreatedAt,
            ListingTitle = b.Conversation.Listing.Title,
            SenderName = b.Conversation.Listing.Sender.FullName,
            TravelerName = b.Conversation.Trip.Traveler.FullName,
        }).ToListAsync());

    [HttpGet("conversations/{id:guid}")]
    public async Task<IActionResult> Conversation(Guid id) => Ok(await Db.Messages.AsNoTracking()
        .Where(m => m.ConversationId == id).OrderBy(m => m.SentAt)
        .Select(m => new { m.Id, m.Body, m.SentAt, SenderName = m.Sender.FullName }).ToListAsync());

    [HttpGet("withdrawals")]
    public async Task<IActionResult> Withdrawals() => Ok(await Db.Withdrawals.AsNoTracking()
        .OrderByDescending(w => w.CreatedAt)
        .Select(w => new { w.Id, w.AmountCents, w.Method, w.Status, w.CreatedAt, w.PaidAt, UserName = w.User.FullName, UserEmail = w.User.Email })
        .ToListAsync());

    [HttpPost("withdrawals/{id:guid}/mark-paid")]
    public async Task<IActionResult> MarkPaid(Guid id)
    {
        var withdrawal = await Db.Withdrawals.FirstOrDefaultAsync(w => w.Id == id) ?? throw new NotFoundException();
        withdrawal.Status = WithdrawalStatus.Paid;
        withdrawal.PaidAt = DateTime.UtcNow;
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private IActionResult ServeFile(string? name)
    {
        var path = name is null ? null : files.Resolve(name);
        return path is null ? NotFound() : PhysicalFile(path, FileStore.ContentType(name!));
    }
}
