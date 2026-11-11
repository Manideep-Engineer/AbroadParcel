# AbroadParcel

Peer-to-peer airport parcel delivery connecting people across India–USA and Canada–USA routes.

- `backend/AbroadParcel.Api`: .NET 10 API, EF Core 10, SQL Server, JWT, Adyen
- `frontend`: Angular 21 website

## First-time setup

1. Create the database. The connection string in `appsettings.json` points to LocalDB.

   ```bash
   dotnet ef database update --project backend/AbroadParcel.Api
   ```

   Or run `backend/AbroadParcel.Api/Migrations/InitialCreate.sql` yourself.

2. Start the API from Visual Studio with the `http` profile (`http://localhost:5024`).

3. Start the website, then open `http://localhost:4200`.

   ```bash
   cd frontend && npm start
   ```

4. Register your own account, then make it the admin and log in again:

   ```sql
   UPDATE Users SET Role = 'Admin' WHERE Email = 'your-email@example.com';
   ```

## Testing without external services

- **Payments:** with no `Adyen:ApiKey` in Development, payments are simulated. "Pay securely" places the hold immediately.
- **Phone codes and recipient links:** no SMS or WhatsApp provider is connected yet, so these are written to the API log.

## Going live with Adyen

Set these outside source control:

| Setting | Value |
| --- | --- |
| `Jwt:Key` | A private random secret of at least 32 characters |
| `App:PublicUrl` | The website's public address |
| `Adyen:BaseUrl` | The live Checkout API URL for your account |
| `Adyen:ApiKey` | Your API key |
| `Adyen:MerchantAccount` | Your merchant account |
| `Adyen:HmacKey` | The webhook HMAC key |
| `Payments:ProcessingFeePercent` and `Payments:ProcessingFeeFixedCents` | The processing fee charged to senders |

Point Adyen's standard webhook at `/api/payments/adyen/webhook`.
