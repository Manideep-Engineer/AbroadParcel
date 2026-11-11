using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public record WithdrawRequest([Range(100, long.MaxValue)] long AmountCents, WithdrawalMethod Method);

[Route("api")]
public class PaymentsController(AppDbContext db, BookingWorkflow workflow, IConfiguration config, ILogger<PaymentsController> log)
    : ApiController(db)
{
    [AllowAnonymous, HttpPost("payments/adyen/webhook")]
    public async Task<IActionResult> AdyenWebhook(AdyenWebhook webhook)
    {
        foreach (var wrapper in webhook.Items)
        {
            var item = wrapper.Item;
            if (!AdyenSignature.IsValid(item, config["Adyen:HmacKey"] ?? ""))
            {
                log.LogWarning("Rejected Adyen notification {Psp}: bad signature", item.PspReference);
                return Unauthorized();
            }
            if (item.EventCode != "AUTHORISATION" || item.Success != "true") continue;
            if (!Guid.TryParse(item.MerchantReference, out var bookingId)) continue;

            var booking = await Db.Bookings.Include(b => b.Conversation).FirstOrDefaultAsync(b => b.Id == bookingId);
            if (booking is not null) await workflow.MarkHeldAsync(booking, item.PspReference);
        }
        return Content("[accepted]");
    }

    [Authorize, HttpGet("wallet")]
    public async Task<IActionResult> Wallet()
    {
        var user = await CurrentUserAsync();
        var withdrawals = await Db.Withdrawals.AsNoTracking().Where(w => w.UserId == user.Id)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new { w.Id, w.AmountCents, w.Method, w.Status, w.CreatedAt, w.PaidAt }).ToListAsync();
        var earnings = await Db.Bookings.AsNoTracking()
            .Where(b => b.Status == BookingStatus.Delivered && b.Conversation.Trip.TravelerId == user.Id)
            .OrderByDescending(b => b.DeliveredAt)
            .Select(b => new { b.Id, b.Conversation.Listing.Title, b.DeliveryFeeCents, b.DeliveredAt }).ToListAsync();
        return Ok(new { balanceCents = user.WalletBalanceCents, withdrawals, earnings });
    }

    [Authorize, HttpPost("wallet/withdraw")]
    public async Task<IActionResult> Withdraw(WithdrawRequest request)
    {
        var user = await CurrentUserAsync();
        if (request.AmountCents > user.WalletBalanceCents)
            throw new BadRequestException("That's more than your wallet balance.");
        user.WalletBalanceCents -= request.AmountCents;
        Db.Withdrawals.Add(new Withdrawal { UserId = user.Id, AmountCents = request.AmountCents, Method = request.Method });
        await Db.SaveChangesAsync();
        return NoContent();
    }

    [AllowAnonymous, HttpGet("recipient/{token}")]
    public async Task<IActionResult> RecipientView(string token)
    {
        var b = await Db.Bookings.AsNoTracking()
            .Include(x => x.Conversation).ThenInclude(c => c.Listing).ThenInclude(l => l.Photos)
            .Include(x => x.Conversation).ThenInclude(c => c.Trip).ThenInclude(t => t.Traveler)
            .FirstOrDefaultAsync(x => x.RecipientToken == token) ?? throw new NotFoundException();
        return Ok(new
        {
            b.Status,
            b.RecipientName,
            TravelerName = b.Conversation.Trip.Traveler.FullName,
            b.PickupPlace,
            b.Conversation.Trip.FromAirport,
            b.Conversation.Trip.ToAirport,
            b.Conversation.Trip.FlightDate,
            b.Conversation.Listing.Title,
            b.Conversation.Listing.Description,
            Photos = b.Conversation.Listing.Photos.Select(p => $"/api/photos/{p.FileName}"),
            // Released only once the traveler has the parcel; the recipient shares it after inspecting.
            DeliveryPin = b.Status == BookingStatus.HandedOver ? b.DeliveryPin : null,
        });
    }
}
