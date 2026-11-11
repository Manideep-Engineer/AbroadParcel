using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public record RegisterRequest(
    [Required, MaxLength(120)] string FullName,
    [Required, EmailAddress, MaxLength(200)] string Email,
    [Required, Phone, MaxLength(30)] string PhoneNumber,
    [Required, MinLength(8), MaxLength(100)] string Password);

public record LoginRequest([Required] string Email, [Required] string Password);
public record PhoneCodeRequest([Required] string Code);

[Route("api/auth")]
public class AuthController(AppDbContext db, TokenService tokens, INotifier notifier, FileStore files) : ApiController(db)
{
    private static readonly PasswordHasher<User> Hasher = new();

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await Db.Users.AnyAsync(u => u.Email == email))
            throw new BadRequestException("An account with this email already exists.");

        var user = new User { FullName = request.FullName.Trim(), Email = email, PhoneNumber = request.PhoneNumber.Trim() };
        user.PasswordHash = Hasher.HashPassword(user, request.Password);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return Ok(new { token = tokens.Create(user), user = Me(user) });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await Db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || Hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Incorrect email or password." });
        return Ok(new { token = tokens.Create(user), user = Me(user) });
    }

    [Authorize, HttpGet("me")]
    public async Task<IActionResult> GetMe() => Ok(Me(await CurrentUserAsync()));

    [Authorize, HttpPost("phone/send-code")]
    public async Task<IActionResult> SendPhoneCode()
    {
        var user = await CurrentUserAsync();
        user.PhoneCode = Codes.SixDigits();
        user.PhoneCodeExpiresAt = DateTime.UtcNow.AddMinutes(10);
        await Db.SaveChangesAsync();
        await notifier.SendAsync(user.PhoneNumber, $"Your AbroadParcel code is {user.PhoneCode}");
        return NoContent();
    }

    [Authorize, HttpPost("phone/confirm")]
    public async Task<IActionResult> ConfirmPhone(PhoneCodeRequest request)
    {
        var user = await CurrentUserAsync();
        if (user.PhoneCode is null || user.PhoneCodeExpiresAt < DateTime.UtcNow || !Codes.Same(user.PhoneCode, request.Code.Trim()))
            throw new BadRequestException("That code is incorrect or has expired.");
        user.PhoneVerified = true;
        user.PhoneCode = null;
        await Db.SaveChangesAsync();
        return Ok(Me(user));
    }

    [Authorize, HttpPost("id-document")]
    public async Task<IActionResult> UploadIdDocument(IFormFile file)
    {
        var user = await CurrentUserAsync();
        if (user.IdStatus == ReviewStatus.Approved)
            throw new BadRequestException("Your ID is already approved.");
        user.IdDocumentFile = await files.SaveDocumentAsync(file);
        user.IdStatus = ReviewStatus.Pending;
        user.IdRejectionReason = null;
        await Db.SaveChangesAsync();
        return Ok(Me(user));
    }

    private static object Me(User user) => new
    {
        user.Id,
        user.FullName,
        user.Email,
        user.PhoneNumber,
        user.Role,
        user.PhoneVerified,
        user.IdStatus,
        user.IdRejectionReason,
        user.IsVerified,
        user.WalletBalanceCents,
    };
}
