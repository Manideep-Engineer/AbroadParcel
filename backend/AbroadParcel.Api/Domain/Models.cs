namespace AbroadParcel.Api.Domain;

public enum UserRole { User, Admin }
public enum ReviewStatus { NotSubmitted, Pending, Approved, Rejected }
public enum ListingStatus { Open, Booked, Delivered, Closed }
public enum BookingStatus { Proposed, Rejected, AwaitingPayment, Held, HandedOver, Delivered, Declined, Cancelled }
public enum WithdrawalMethod { BankAccount, DebitCard, DigitalPayout }
public enum WithdrawalStatus { Requested, Paid }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string PhoneNumber { get; set; }
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.User;
    public bool PhoneVerified { get; set; }
    public string? PhoneCode { get; set; }
    public DateTime? PhoneCodeExpiresAt { get; set; }
    public ReviewStatus IdStatus { get; set; } = ReviewStatus.NotSubmitted;
    public string? IdDocumentFile { get; set; }
    public string? IdRejectionReason { get; set; }
    public long WalletBalanceCents { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsVerified => PhoneVerified && IdStatus == ReviewStatus.Approved;
}

public class ParcelListing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;
    public required string Title { get; set; }
    public required string Description { get; set; }
    public decimal WeightKg { get; set; }
    public required string OriginCity { get; set; }
    public required string OriginCountry { get; set; }
    public required string DestinationCity { get; set; }
    public required string DestinationCountry { get; set; }
    public ListingStatus Status { get; set; } = ListingStatus.Open;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ListingPhoto> Photos { get; set; } = [];
}

public class ListingPhoto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ListingId { get; set; }
    public required string FileName { get; set; }
}

public class Trip
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TravelerId { get; set; }
    public User Traveler { get; set; } = null!;
    public required string FromAirport { get; set; }
    public required string FromCountry { get; set; }
    public required string ToAirport { get; set; }
    public required string ToCountry { get; set; }
    public DateOnly FlightDate { get; set; }
    public decimal AvailableKg { get; set; }
    public string? BookingDocumentFile { get; set; }
    public ReviewStatus FlightStatus { get; set; } = ReviewStatus.Pending;
    public string? RejectionReason { get; set; }
    public bool IsClosed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ListingId { get; set; }
    public ParcelListing Listing { get; set; } = null!;
    public Guid TripId { get; set; }
    public Trip Trip { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<Message> Messages { get; set; } = [];
}

public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;
    public required string Body { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public long DeliveryFeeCents { get; set; }
    public long ProcessingFeeCents { get; set; }
    public required string MeetingPlace { get; set; }
    public DateTime MeetingAt { get; set; }
    public required string PickupPlace { get; set; }
    public required string RecipientName { get; set; }
    public required string RecipientPhone { get; set; }
    public required string RecipientToken { get; set; }
    public required string HandoverCode { get; set; }
    public required string DeliveryPin { get; set; }
    public int FailedCodeAttempts { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Proposed;
    public string? PaymentReference { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? HandedOverAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public List<Review> Reviews { get; set; } = [];

    public long TotalCents => DeliveryFeeCents + ProcessingFeeCents;
}

public class Review
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BookingId { get; set; }
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public Guid SubjectId { get; set; }
    public User Subject { get; set; } = null!;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Withdrawal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public long AmountCents { get; set; }
    public WithdrawalMethod Method { get; set; }
    public WithdrawalStatus Status { get; set; } = WithdrawalStatus.Requested;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}

public static class Routes
{
    // PRD launch routes: India-USA and Canada-USA, both directions.
    public static bool IsAllowed(string from, string to) =>
        (from, to) is ("IN", "US") or ("US", "IN") or ("CA", "US") or ("US", "CA");
}
