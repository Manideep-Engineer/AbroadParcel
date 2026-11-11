using System.ComponentModel.DataAnnotations;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Domain;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Controllers;

public class CreateListingRequest
{
    [Required, MaxLength(120)] public string Title { get; set; } = "";
    [Required, MaxLength(2000)] public string Description { get; set; } = "";
    [Range(0.01, 100)] public decimal WeightKg { get; set; }
    [Required, MaxLength(80)] public string OriginCity { get; set; } = "";
    [Required, StringLength(2)] public string OriginCountry { get; set; } = "";
    [Required, MaxLength(80)] public string DestinationCity { get; set; } = "";
    [Required, StringLength(2)] public string DestinationCountry { get; set; } = "";
    public bool AcceptsItemRules { get; set; }
    public List<IFormFile> Photos { get; set; } = [];
}

public class CreateTripRequest
{
    [Required, StringLength(3)] public string FromAirport { get; set; } = "";
    [Required, StringLength(2)] public string FromCountry { get; set; } = "";
    [Required, StringLength(3)] public string ToAirport { get; set; } = "";
    [Required, StringLength(2)] public string ToCountry { get; set; } = "";
    public DateOnly FlightDate { get; set; }
    [Range(0.1, 100)] public decimal AvailableKg { get; set; }
    public IFormFile? BookingDocument { get; set; }
}

[Route("api")]
public class MarketplaceController(AppDbContext db, FileStore files) : ApiController(db)
{
    [HttpGet("listings")]
    public async Task<IActionResult> BrowseListings(string? from, string? to)
    {
        var query = Db.Listings.AsNoTracking().Where(l => l.Status == ListingStatus.Open);
        if (!string.IsNullOrEmpty(from)) query = query.Where(l => l.OriginCountry == from);
        if (!string.IsNullOrEmpty(to)) query = query.Where(l => l.DestinationCountry == to);
        var listings = await query.Include(l => l.Photos).Include(l => l.Sender)
            .OrderByDescending(l => l.CreatedAt).Take(100).ToListAsync();
        return Ok(listings.Select(ListingView));
    }

    [HttpGet("trips")]
    public async Task<IActionResult> BrowseTrips(string? from, string? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = Db.Trips.AsNoTracking()
            .Where(t => !t.IsClosed && t.FlightStatus == ReviewStatus.Approved && t.FlightDate >= today);
        if (!string.IsNullOrEmpty(from)) query = query.Where(t => t.FromCountry == from);
        if (!string.IsNullOrEmpty(to)) query = query.Where(t => t.ToCountry == to);
        var trips = await query.Include(t => t.Traveler).OrderBy(t => t.FlightDate).Take(100).ToListAsync();
        return Ok(trips.Select(TripView));
    }

    [Authorize, HttpGet("listings/mine")]
    public async Task<IActionResult> MyListings()
    {
        var listings = await Db.Listings.AsNoTracking().Include(l => l.Photos).Include(l => l.Sender)
            .Where(l => l.SenderId == UserId).OrderByDescending(l => l.CreatedAt).ToListAsync();
        return Ok(listings.Select(ListingView));
    }

    [Authorize, HttpGet("trips/mine")]
    public async Task<IActionResult> MyTrips()
    {
        var trips = await Db.Trips.AsNoTracking().Include(t => t.Traveler)
            .Where(t => t.TravelerId == UserId).OrderByDescending(t => t.FlightDate).ToListAsync();
        return Ok(trips.Select(TripView));
    }

    [Authorize, HttpPost("listings")]
    public async Task<IActionResult> CreateListing([FromForm] CreateListingRequest request)
    {
        var user = await VerifiedUserAsync();
        if (!request.AcceptsItemRules)
            throw new BadRequestException("Confirm the item is unsealed and not on the banned list.");
        if (!Routes.IsAllowed(request.OriginCountry, request.DestinationCountry))
            throw new BadRequestException("We currently serve India–USA and Canada–USA routes.");
        if (request.Photos.Count is 0 or > 5)
            throw new BadRequestException("Add between 1 and 5 photos.");

        var listing = new ParcelListing
        {
            SenderId = user.Id,
            Sender = user,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            WeightKg = request.WeightKg,
            OriginCity = request.OriginCity.Trim(),
            OriginCountry = request.OriginCountry,
            DestinationCity = request.DestinationCity.Trim(),
            DestinationCountry = request.DestinationCountry,
        };
        foreach (var photo in request.Photos)
            listing.Photos.Add(new ListingPhoto { FileName = await files.SaveImageAsync(photo) });

        Db.Listings.Add(listing);
        await Db.SaveChangesAsync();
        return Ok(ListingView(listing));
    }

    [Authorize, HttpPost("trips")]
    public async Task<IActionResult> CreateTrip([FromForm] CreateTripRequest request)
    {
        var user = await VerifiedUserAsync();
        if (!Routes.IsAllowed(request.FromCountry, request.ToCountry))
            throw new BadRequestException("We currently serve India–USA and Canada–USA routes.");
        if (request.FlightDate < DateOnly.FromDateTime(DateTime.UtcNow))
            throw new BadRequestException("The flight date must be in the future.");
        if (request.BookingDocument is null)
            throw new BadRequestException("Upload your flight booking so it can be verified.");

        var trip = new Trip
        {
            TravelerId = user.Id,
            Traveler = user,
            FromAirport = request.FromAirport.ToUpperInvariant(),
            FromCountry = request.FromCountry,
            ToAirport = request.ToAirport.ToUpperInvariant(),
            ToCountry = request.ToCountry,
            FlightDate = request.FlightDate,
            AvailableKg = request.AvailableKg,
            BookingDocumentFile = await files.SaveDocumentAsync(request.BookingDocument),
        };
        Db.Trips.Add(trip);
        await Db.SaveChangesAsync();
        return Ok(TripView(trip));
    }

    [Authorize, HttpPost("listings/{id:guid}/close")]
    public async Task<IActionResult> CloseListing(Guid id)
    {
        var listing = await Db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.SenderId == UserId) ?? throw new NotFoundException();
        if (listing.Status != ListingStatus.Open) throw new BadRequestException("Only open listings can be closed.");
        listing.Status = ListingStatus.Closed;
        await Db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize, HttpPost("trips/{id:guid}/close")]
    public async Task<IActionResult> CloseTrip(Guid id)
    {
        var trip = await Db.Trips.FirstOrDefaultAsync(t => t.Id == id && t.TravelerId == UserId) ?? throw new NotFoundException();
        trip.IsClosed = true;
        await Db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("users/{id:guid}/profile")]
    public async Task<IActionResult> Profile(Guid id) => Ok(await PublicProfileAsync(id));

    [HttpGet("photos/{name}")]
    public async Task<IActionResult> Photo(string name)
    {
        // Only listing photos are public; ID and booking documents share this folder and stay private.
        if (!await Db.ListingPhotos.AnyAsync(p => p.FileName == name)) return NotFound();
        var path = files.Resolve(name);
        return path is null ? NotFound() : PhysicalFile(path, FileStore.ContentType(name));
    }

    private static object ListingView(ParcelListing l) => new
    {
        l.Id,
        l.Title,
        l.Description,
        l.WeightKg,
        l.OriginCity,
        l.OriginCountry,
        l.DestinationCity,
        l.DestinationCountry,
        l.Status,
        l.CreatedAt,
        Sender = new { l.Sender.Id, l.Sender.FullName, l.Sender.IsVerified },
        Photos = l.Photos.Select(p => $"/api/photos/{p.FileName}"),
    };

    private static object TripView(Trip t) => new
    {
        t.Id,
        t.FromAirport,
        t.FromCountry,
        t.ToAirport,
        t.ToCountry,
        t.FlightDate,
        t.AvailableKg,
        t.FlightStatus,
        t.RejectionReason,
        t.IsClosed,
        Traveler = new { t.Traveler.Id, t.Traveler.FullName, t.Traveler.IsVerified },
    };
}
