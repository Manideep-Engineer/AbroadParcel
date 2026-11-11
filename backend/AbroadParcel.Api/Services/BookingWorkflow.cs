using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Services;

public class BookingWorkflow(AppDbContext db, IPaymentGateway payments, INotifier notifier, IConfiguration config)
{
    /// <summary>Records the authorized payment, books the parcel and sends the recipient their link.</summary>
    public async Task MarkHeldAsync(Booking booking, string paymentReference)
    {
        if (booking.Status != BookingStatus.AwaitingPayment) return;

        var listing = await db.Listings.FirstAsync(l => l.Id == booking.Conversation.ListingId);
        var trip = await db.Trips.FirstAsync(t => t.Id == booking.Conversation.TripId);
        booking.Status = BookingStatus.Held;
        booking.PaymentReference = paymentReference;
        listing.Status = ListingStatus.Booked;
        trip.AvailableKg = Math.Max(0, trip.AvailableKg - listing.WeightKg);
        await db.SaveChangesAsync();

        var link = $"{config["App:PublicUrl"]}/r/{booking.RecipientToken}";
        await notifier.SendAsync(booking.RecipientPhone,
            $"{listing.Title} is on its way to you with AbroadParcel. Delivery details: {link}");
    }

    /// <summary>Pays the traveler. Capturing the full hold also charges the sender's processing fee.</summary>
    public async Task ReleaseAsync(Booking booking)
    {
        await payments.CaptureAsync(booking.PaymentReference!, booking.TotalCents, $"{booking.Id}-release");

        var listing = await db.Listings.FirstAsync(l => l.Id == booking.Conversation.ListingId);
        var traveler = await db.Users.FirstAsync(u => u.Id == booking.Conversation.Trip.TravelerId);
        booking.Status = BookingStatus.Delivered;
        booking.DeliveredAt = DateTime.UtcNow;
        listing.Status = ListingStatus.Delivered;
        traveler.WalletBalanceCents += booking.DeliveryFeeCents;
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Returns the delivery fee to the sender. The processing fee isn't refundable, so only that part of
    /// the hold is captured and Adyen releases the rest.
    /// </summary>
    public async Task RefundAsync(Booking booking, BookingStatus outcome)
    {
        await payments.CaptureAsync(booking.PaymentReference!, booking.ProcessingFeeCents, $"{booking.Id}-processing");

        var listing = await db.Listings.FirstAsync(l => l.Id == booking.Conversation.ListingId);
        var trip = await db.Trips.FirstAsync(t => t.Id == booking.Conversation.TripId);
        booking.Status = outcome;
        listing.Status = ListingStatus.Open;
        trip.AvailableKg += listing.WeightKg;
        await db.SaveChangesAsync();
    }
}
