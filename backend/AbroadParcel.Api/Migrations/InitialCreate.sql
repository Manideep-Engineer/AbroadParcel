IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Users] (
        [Id] uniqueidentifier NOT NULL,
        [FullName] nvarchar(120) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [PhoneNumber] nvarchar(30) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [Role] nvarchar(20) NOT NULL,
        [PhoneVerified] bit NOT NULL,
        [PhoneCode] nvarchar(6) NULL,
        [PhoneCodeExpiresAt] datetime2 NULL,
        [IdStatus] nvarchar(20) NOT NULL,
        [IdDocumentFile] nvarchar(100) NULL,
        [IdRejectionReason] nvarchar(max) NULL,
        [WalletBalanceCents] bigint NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Listings] (
        [Id] uniqueidentifier NOT NULL,
        [SenderId] uniqueidentifier NOT NULL,
        [Title] nvarchar(120) NOT NULL,
        [Description] nvarchar(2000) NOT NULL,
        [WeightKg] decimal(6,2) NOT NULL,
        [OriginCity] nvarchar(80) NOT NULL,
        [OriginCountry] nvarchar(2) NOT NULL,
        [DestinationCity] nvarchar(80) NOT NULL,
        [DestinationCountry] nvarchar(2) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Listings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Listings_Users_SenderId] FOREIGN KEY ([SenderId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Trips] (
        [Id] uniqueidentifier NOT NULL,
        [TravelerId] uniqueidentifier NOT NULL,
        [FromAirport] nvarchar(3) NOT NULL,
        [FromCountry] nvarchar(2) NOT NULL,
        [ToAirport] nvarchar(3) NOT NULL,
        [ToCountry] nvarchar(2) NOT NULL,
        [FlightDate] date NOT NULL,
        [AvailableKg] decimal(6,2) NOT NULL,
        [BookingDocumentFile] nvarchar(100) NULL,
        [FlightStatus] nvarchar(20) NOT NULL,
        [RejectionReason] nvarchar(max) NULL,
        [IsClosed] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Trips] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Trips_Users_TravelerId] FOREIGN KEY ([TravelerId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Withdrawals] (
        [Id] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [AmountCents] bigint NOT NULL,
        [Method] nvarchar(20) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [PaidAt] datetime2 NULL,
        CONSTRAINT [PK_Withdrawals] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Withdrawals_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [ListingPhotos] (
        [Id] uniqueidentifier NOT NULL,
        [ListingId] uniqueidentifier NOT NULL,
        [FileName] nvarchar(100) NOT NULL,
        CONSTRAINT [PK_ListingPhotos] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ListingPhotos_Listings_ListingId] FOREIGN KEY ([ListingId]) REFERENCES [Listings] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Conversations] (
        [Id] uniqueidentifier NOT NULL,
        [ListingId] uniqueidentifier NOT NULL,
        [TripId] uniqueidentifier NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Conversations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Conversations_Listings_ListingId] FOREIGN KEY ([ListingId]) REFERENCES [Listings] ([Id]),
        CONSTRAINT [FK_Conversations_Trips_TripId] FOREIGN KEY ([TripId]) REFERENCES [Trips] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Bookings] (
        [Id] uniqueidentifier NOT NULL,
        [ConversationId] uniqueidentifier NOT NULL,
        [DeliveryFeeCents] bigint NOT NULL,
        [ProcessingFeeCents] bigint NOT NULL,
        [MeetingPlace] nvarchar(200) NOT NULL,
        [MeetingAt] datetime2 NOT NULL,
        [RecipientName] nvarchar(120) NOT NULL,
        [RecipientPhone] nvarchar(30) NOT NULL,
        [RecipientToken] nvarchar(64) NOT NULL,
        [HandoverCode] nvarchar(6) NOT NULL,
        [DeliveryPin] nvarchar(6) NOT NULL,
        [FailedCodeAttempts] int NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [PaymentReference] nvarchar(64) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [HandedOverAt] datetime2 NULL,
        [DeliveredAt] datetime2 NULL,
        CONSTRAINT [PK_Bookings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Bookings_Conversations_ConversationId] FOREIGN KEY ([ConversationId]) REFERENCES [Conversations] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Messages] (
        [Id] uniqueidentifier NOT NULL,
        [ConversationId] uniqueidentifier NOT NULL,
        [SenderId] uniqueidentifier NOT NULL,
        [Body] nvarchar(2000) NOT NULL,
        [SentAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Messages_Conversations_ConversationId] FOREIGN KEY ([ConversationId]) REFERENCES [Conversations] ([Id]),
        CONSTRAINT [FK_Messages_Users_SenderId] FOREIGN KEY ([SenderId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE TABLE [Reviews] (
        [Id] uniqueidentifier NOT NULL,
        [BookingId] uniqueidentifier NOT NULL,
        [AuthorId] uniqueidentifier NOT NULL,
        [SubjectId] uniqueidentifier NOT NULL,
        [Rating] int NOT NULL,
        [Comment] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Reviews] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Reviews_Bookings_BookingId] FOREIGN KEY ([BookingId]) REFERENCES [Bookings] ([Id]),
        CONSTRAINT [FK_Reviews_Users_AuthorId] FOREIGN KEY ([AuthorId]) REFERENCES [Users] ([Id]),
        CONSTRAINT [FK_Reviews_Users_SubjectId] FOREIGN KEY ([SubjectId]) REFERENCES [Users] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Bookings_ConversationId] ON [Bookings] ([ConversationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Bookings_RecipientToken] ON [Bookings] ([RecipientToken]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Conversations_ListingId_TripId] ON [Conversations] ([ListingId], [TripId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Conversations_TripId] ON [Conversations] ([TripId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ListingPhotos_ListingId] ON [ListingPhotos] ([ListingId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Listings_SenderId] ON [Listings] ([SenderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Messages_ConversationId_SentAt] ON [Messages] ([ConversationId], [SentAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Messages_SenderId] ON [Messages] ([SenderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Reviews_AuthorId] ON [Reviews] ([AuthorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Reviews_BookingId_AuthorId] ON [Reviews] ([BookingId], [AuthorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Reviews_SubjectId] ON [Reviews] ([SubjectId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Trips_TravelerId] ON [Trips] ([TravelerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Withdrawals_UserId] ON [Withdrawals] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261031194634_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261031194634_InitialCreate', N'10.0.14');
END;

COMMIT;
GO

