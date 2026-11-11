using AbroadParcel.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AbroadParcel.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<ParcelListing> Listings => Set<ParcelListing>();
    public DbSet<ListingPhoto> ListingPhotos => Set<ListingPhoto>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Withdrawal> Withdrawals => Set<Withdrawal>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<UserRole>().HaveConversion<string>().HaveMaxLength(20);
        builder.Properties<ReviewStatus>().HaveConversion<string>().HaveMaxLength(20);
        builder.Properties<ListingStatus>().HaveConversion<string>().HaveMaxLength(20);
        builder.Properties<BookingStatus>().HaveConversion<string>().HaveMaxLength(20);
        builder.Properties<WithdrawalMethod>().HaveConversion<string>().HaveMaxLength(20);
        builder.Properties<WithdrawalStatus>().HaveConversion<string>().HaveMaxLength(20);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.FullName).HasMaxLength(120);
            e.Property(u => u.Email).HasMaxLength(200);
            e.Property(u => u.PhoneNumber).HasMaxLength(30);
            e.Property(u => u.PhoneCode).HasMaxLength(6);
            e.Property(u => u.IdDocumentFile).HasMaxLength(100);
            e.Ignore(u => u.IsVerified);
        });

        b.Entity<ParcelListing>(e =>
        {
            e.Property(l => l.Title).HasMaxLength(120);
            e.Property(l => l.Description).HasMaxLength(2000);
            e.Property(l => l.WeightKg).HasPrecision(6, 2);
            e.Property(l => l.OriginCity).HasMaxLength(80);
            e.Property(l => l.DestinationCity).HasMaxLength(80);
            e.Property(l => l.OriginCountry).HasMaxLength(2);
            e.Property(l => l.DestinationCountry).HasMaxLength(2);
            e.HasMany(l => l.Photos).WithOne().HasForeignKey(p => p.ListingId);
        });

        b.Entity<ListingPhoto>().Property(p => p.FileName).HasMaxLength(100);

        b.Entity<Trip>(e =>
        {
            e.Property(t => t.FromAirport).HasMaxLength(3);
            e.Property(t => t.ToAirport).HasMaxLength(3);
            e.Property(t => t.FromCountry).HasMaxLength(2);
            e.Property(t => t.ToCountry).HasMaxLength(2);
            e.Property(t => t.AvailableKg).HasPrecision(6, 2);
            e.Property(t => t.BookingDocumentFile).HasMaxLength(100);
        });

        b.Entity<Conversation>().HasIndex(c => new { c.ListingId, c.TripId }).IsUnique();
        b.Entity<Message>(e =>
        {
            e.Property(m => m.Body).HasMaxLength(2000);
            e.HasIndex(m => new { m.ConversationId, m.SentAt });
        });

        b.Entity<Booking>(e =>
        {
            e.Property(x => x.MeetingPlace).HasMaxLength(200);
            e.Property(x => x.PickupPlace).HasMaxLength(200);
            e.Property(x => x.RecipientName).HasMaxLength(120);
            e.Property(x => x.RecipientPhone).HasMaxLength(30);
            e.Property(x => x.RecipientToken).HasMaxLength(64);
            e.Property(x => x.HandoverCode).HasMaxLength(6);
            e.Property(x => x.DeliveryPin).HasMaxLength(6);
            e.Property(x => x.PaymentReference).HasMaxLength(64);
            e.HasIndex(x => x.RecipientToken).IsUnique();
            e.Ignore(x => x.TotalCents);
        });

        b.Entity<Review>(e =>
        {
            e.Property(r => r.Comment).HasMaxLength(1000);
            e.HasIndex(r => new { r.BookingId, r.AuthorId }).IsUnique();
            e.HasOne(r => r.Author).WithMany().HasForeignKey(r => r.AuthorId);
            e.HasOne(r => r.Subject).WithMany().HasForeignKey(r => r.SubjectId);
        });

        // SQL Server rejects multiple cascade paths, and these records must outlive their parents anyway.
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.NoAction;
    }
}
