using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AbroadParcel.Api.Domain;
using Microsoft.IdentityModel.Tokens;

namespace AbroadParcel.Api.Services;

public class TokenService(IConfiguration config)
{
    public string Create(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims:
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Role, user.Role.ToString()),
            ],
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public static class Codes
{
    public static string SixDigits() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
    public static bool Same(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}

public interface INotifier
{
    Task SendAsync(string phone, string message);
}

// No SMS or WhatsApp provider is chosen yet, so messages go to the API log.
public class LogNotifier(ILogger<LogNotifier> log) : INotifier
{
    public Task SendAsync(string phone, string message)
    {
        log.LogInformation("Message to {Phone}: {Message}", phone, message);
        return Task.CompletedTask;
    }
}

public class FileStore(IWebHostEnvironment env)
{
    private const long MaxBytes = 8 * 1024 * 1024;
    private static readonly string[] ImageTypes = [".jpg", ".jpeg", ".png", ".webp"];
    private static readonly string[] DocumentTypes = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

    private string Root => Path.Combine(env.ContentRootPath, "App_Data", "uploads");

    public Task<string> SaveImageAsync(IFormFile file) => SaveAsync(file, ImageTypes);
    public Task<string> SaveDocumentAsync(IFormFile file) => SaveAsync(file, DocumentTypes);

    private async Task<string> SaveAsync(IFormFile file, string[] allowed)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowed.Contains(extension))
            throw new BadRequestException($"Allowed file types: {string.Join(", ", allowed)}");
        if (file.Length is 0 or > MaxBytes)
            throw new BadRequestException("Files must be between 1 byte and 8 MB.");

        Directory.CreateDirectory(Root);
        var name = $"{Guid.NewGuid():N}{extension}";
        await using var stream = File.Create(Path.Combine(Root, name));
        await file.CopyToAsync(stream);
        return name;
    }

    public string? Resolve(string name)
    {
        var path = Path.Combine(Root, Path.GetFileName(name));
        return File.Exists(path) ? path : null;
    }

    public static string ContentType(string name) => Path.GetExtension(name).ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".pdf" => "application/pdf",
        _ => "image/jpeg",
    };
}

public class BadRequestException(string message) : Exception(message);
public class NotFoundException(string message = "Not found.") : Exception(message);
public class ForbiddenException(string message = "You can't do that.") : Exception(message);
