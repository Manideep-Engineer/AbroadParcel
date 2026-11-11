using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AbroadParcel.Api.Domain;

namespace AbroadParcel.Api.Services;

public interface IPaymentGateway
{
    bool IsSimulated { get; }

    /// <summary>Authorizes without capturing, so the money stays on hold until the delivery PIN. Returns a hosted checkout URL.</summary>
    Task<string?> CreateHoldAsync(Booking booking, string returnUrl);

    Task CaptureAsync(string paymentReference, long amountCents, string reference);
}

public class SimulatedPaymentGateway : IPaymentGateway
{
    public bool IsSimulated => true;
    public Task<string?> CreateHoldAsync(Booking booking, string returnUrl) => Task.FromResult<string?>(null);
    public Task CaptureAsync(string paymentReference, long amountCents, string reference) => Task.CompletedTask;
}

public class AdyenPaymentGateway(HttpClient http, IConfiguration config) : IPaymentGateway
{
    public bool IsSimulated => false;

    private string MerchantAccount => config["Adyen:MerchantAccount"]!;

    public async Task<string?> CreateHoldAsync(Booking booking, string returnUrl)
    {
        var response = await PostAsync("paymentLinks", new
        {
            reference = booking.Id.ToString(),
            amount = new { value = booking.TotalCents, currency = "USD" },
            merchantAccount = MerchantAccount,
            description = "AbroadParcel delivery fee",
            returnUrl,
            manualCapture = "true",
        });
        return response.GetProperty("url").GetString();
    }

    public async Task CaptureAsync(string paymentReference, long amountCents, string reference) =>
        await PostAsync($"payments/{paymentReference}/captures", new
        {
            merchantAccount = MerchantAccount,
            amount = new { value = amountCents, currency = "USD" },
            reference,
        });

    private async Task<JsonElement> PostAsync(string path, object body)
    {
        using var response = await http.PostAsJsonAsync(path, body);
        var text = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Adyen returned {(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement.Clone();
    }
}

public class AdyenWebhook
{
    [JsonPropertyName("notificationItems")] public List<AdyenItemWrapper> Items { get; set; } = [];
}

public class AdyenItemWrapper
{
    [JsonPropertyName("NotificationRequestItem")] public AdyenItem Item { get; set; } = new();
}

public class AdyenItem
{
    [JsonPropertyName("eventCode")] public string EventCode { get; set; } = "";
    [JsonPropertyName("success")] public string Success { get; set; } = "";
    [JsonPropertyName("pspReference")] public string PspReference { get; set; } = "";
    [JsonPropertyName("originalReference")] public string? OriginalReference { get; set; }
    [JsonPropertyName("merchantAccountCode")] public string MerchantAccountCode { get; set; } = "";
    [JsonPropertyName("merchantReference")] public string MerchantReference { get; set; } = "";
    [JsonPropertyName("amount")] public AdyenAmount Amount { get; set; } = new();
    [JsonPropertyName("additionalData")] public Dictionary<string, string>? AdditionalData { get; set; }
}

public class AdyenAmount
{
    [JsonPropertyName("value")] public long Value { get; set; }
    [JsonPropertyName("currency")] public string Currency { get; set; } = "";
}

public static class AdyenSignature
{
    public static bool IsValid(AdyenItem item, string hexKey)
    {
        var signature = item.AdditionalData?.GetValueOrDefault("hmacSignature");
        if (string.IsNullOrEmpty(signature) || string.IsNullOrEmpty(hexKey)) return false;

        var payload = string.Join(':',
            item.PspReference, item.OriginalReference ?? "", item.MerchantAccountCode, item.MerchantReference,
            item.Amount.Value.ToString(CultureInfo.InvariantCulture), item.Amount.Currency, item.EventCode, item.Success);
        var hash = HMACSHA256.HashData(Convert.FromHexString(hexKey), Encoding.UTF8.GetBytes(payload));
        return Codes.Same(Convert.ToBase64String(hash), signature);
    }
}

public class FeeCalculator(IConfiguration config)
{
    /// <summary>The sender's processing fee, charged on top of the delivery fee.</summary>
    public long ProcessingFeeCents(long deliveryFeeCents)
    {
        var percent = config.GetValue("Payments:ProcessingFeePercent", 3m);
        var fixedCents = config.GetValue("Payments:ProcessingFeeFixedCents", 30L);
        return (long)Math.Ceiling(deliveryFeeCents * percent / 100m) + fixedCents;
    }
}
