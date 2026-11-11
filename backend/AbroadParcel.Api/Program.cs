using System.Text;
using System.Text.Json.Serialization;
using AbroadParcel.Api.Data;
using AbroadParcel.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

var jwtKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Set Jwt:Key to a secret of at least 32 characters.");

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(config.GetConnectionString("Default")));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = config["Jwt:Issuer"],
        ValidAudience = config["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
    };
});
builder.Services.AddAuthorization();

builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<FileStore>();
builder.Services.AddSingleton<FeeCalculator>();
builder.Services.AddSingleton<INotifier, LogNotifier>();
builder.Services.AddScoped<BookingWorkflow>();

if (string.IsNullOrWhiteSpace(config["Adyen:ApiKey"]))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Adyen:ApiKey is required outside Development.");
    builder.Services.AddSingleton<IPaymentGateway, SimulatedPaymentGateway>();
}
else
{
    builder.Services.AddHttpClient<IPaymentGateway, AdyenPaymentGateway>(http =>
    {
        http.BaseAddress = new Uri(config["Adyen:BaseUrl"]!);
        http.DefaultRequestHeaders.Add("X-API-Key", config["Adyen:ApiKey"]);
    });
}

var app = builder.Build();

app.UseExceptionHandler(error => error.Run(async context =>
{
    var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    (context.Response.StatusCode, var message) = exception switch
    {
        BadRequestException e => (400, e.Message),
        ForbiddenException e => (403, e.Message),
        NotFoundException e => (404, e.Message),
        _ => (500, "Something went wrong. Please try again."),
    };
    await context.Response.WriteAsJsonAsync(new { message });
}));

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
