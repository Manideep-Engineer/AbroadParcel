BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261101171237_AddPickupPlace'
)
BEGIN
    ALTER TABLE [Bookings] ADD [PickupPlace] nvarchar(200) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261101171237_AddPickupPlace'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261101171237_AddPickupPlace', N'10.0.14');
END;

COMMIT;
GO

