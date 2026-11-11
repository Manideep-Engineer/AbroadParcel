using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public record StartConversationRequest(Guid ListingId, Guid TripId);
public record SendMessageRequest([Required, MaxLength(2000)] string Body);

[Authorize, Route("api/conversations")]
public class ChatController(AppDbContext db) : ApiController(db)
{
    [HttpPost]
    public async Task<IActionResult> Start(StartConversationRequest request)
    {
        await VerifiedUserAsync();
        var listing = await Db.Listings.FirstOrDefaultAsync(l => l.Id == request.ListingId) ?? throw new NotFoundException("Parcel not found.");
        var trip = await Db.Trips.FirstOrDefaultAsync(t => t.Id == request.TripId) ?? throw new NotFoundException("Trip not found.");

        if (listing.SenderId != UserId && trip.TravelerId != UserId) throw new ForbiddenException();
        if (listing.SenderId == trip.TravelerId) throw new BadRequestException("You can't carry your own parcel.");
        if (listing.Status != ListingStatus.Open || trip.IsClosed || trip.FlightStatus != ReviewStatus.Approved)
            throw new BadRequestException("This parcel or trip is no longer available.");
        if (listing.OriginCountry != trip.FromCountry || listing.DestinationCountry != trip.ToCountry)
            throw new BadRequestException("This parcel and trip are on different routes.");
        if (listing.WeightKg > trip.AvailableKg)
            throw new BadRequestException("This parcel is heavier than the space available on the trip.");

        var conversation = await Db.Conversations.FirstOrDefaultAsync(c => c.ListingId == listing.Id && c.TripId == trip.Id);
        if (conversation is null)
        {
            conversation = new Conversation { ListingId = listing.Id, TripId = trip.Id };
            Db.Conversations.Add(conversation);
            await Db.SaveChangesAsync();
        }
        return Ok(new { conversation.Id });
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var items = await Db.Conversations.AsNoTracking()
            .Where(c => c.Listing.SenderId == UserId || c.Trip.TravelerId == UserId)
            .Select(c => new
            {
                c.Id,
                ListingTitle = c.Listing.Title,
                c.Trip.FromAirport,
                c.Trip.ToAirport,
                c.Trip.FlightDate,
                OtherName = c.Listing.SenderId == UserId ? c.Trip.Traveler.FullName : c.Listing.Sender.FullName,
                LastMessage = c.Messages.OrderByDescending(m => m.SentAt).Select(m => m.Body).FirstOrDefault(),
                LastAt = c.Messages.OrderByDescending(m => m.SentAt).Select(m => (DateTime?)m.SentAt).FirstOrDefault() ?? c.CreatedAt,
            })
            .OrderByDescending(c => c.LastAt).ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var c = await Db.Conversations.AsNoTracking()
            .Include(x => x.Listing).ThenInclude(l => l.Sender)
            .Include(x => x.Trip).ThenInclude(t => t.Traveler)
            .FirstOrDefaultAsync(x => x.Id == id) ?? throw new NotFoundException();
        if (c.Listing.SenderId != UserId && c.Trip.TravelerId != UserId) throw new ForbiddenException();

        var messages = await Db.Messages.AsNoTracking().Where(m => m.ConversationId == id)
            .OrderBy(m => m.SentAt).Take(500)
            .Select(m => new { m.Id, m.Body, m.SentAt, m.SenderId }).ToListAsync();
        var booking = await Db.Bookings.Where(b => b.ConversationId == id)
            .OrderByDescending(b => b.CreatedAt).Select(b => new { b.Id, b.Status }).FirstOrDefaultAsync();

        return Ok(new
        {
            c.Id,
            Role = c.Listing.SenderId == UserId ? "Sender" : "Traveler",
            Listing = new { c.Listing.Id, c.Listing.Title, c.Listing.WeightKg, c.Listing.Status },
            Trip = new { c.Trip.Id, c.Trip.FromAirport, c.Trip.ToAirport, c.Trip.FlightDate },
            OtherName = c.Listing.SenderId == UserId ? c.Trip.Traveler.FullName : c.Listing.Sender.FullName,
            OtherId = c.Listing.SenderId == UserId ? c.Trip.TravelerId : c.Listing.SenderId,
            BookingId = booking?.Id,
            BookingStatus = booking?.Status,
            Messages = messages,
        });
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> Send(Guid id, SendMessageRequest request)
    {
        var allowed = await Db.Conversations.AnyAsync(c => c.Id == id && (c.Listing.SenderId == UserId || c.Trip.TravelerId == UserId));
        if (!allowed) throw new ForbiddenException();
        var message = new Message { ConversationId = id, SenderId = UserId, Body = request.Body.Trim() };
        Db.Messages.Add(message);
        await Db.SaveChangesAsync();
        return Ok(new { message.Id, message.Body, message.SentAt, message.SenderId });
    }
}
