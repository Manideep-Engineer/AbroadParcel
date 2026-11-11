using System.Security.Claims;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

[ApiController]
public abstract class ApiController(AppDbContext db) : ControllerBase
{
    protected AppDbContext Db => db;
    protected Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    protected async Task<User> CurrentUserAsync() =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == UserId) ?? throw new NotFoundException("Account not found.");

    protected async Task<User> VerifiedUserAsync()
    {
        var user = await CurrentUserAsync();
        if (!user.IsVerified)
            throw new ForbiddenException("Verify your phone number and government ID first.");
        return user;
    }

    protected async Task<object> PublicProfileAsync(Guid userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId) ?? throw new NotFoundException();
        var ratings = await db.Reviews.Where(r => r.SubjectId == userId).Select(r => r.Rating).ToListAsync();
        return new
        {
            user.Id,
            user.FullName,
            user.IsVerified,
            ReviewCount = ratings.Count,
            AverageRating = ratings.Count == 0 ? (double?)null : Math.Round(ratings.Average(), 1),
        };
    }
}
