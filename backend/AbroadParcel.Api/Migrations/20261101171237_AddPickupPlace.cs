using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AbroadParcel.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPickupPlace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PickupPlace",
                table: "Bookings",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PickupPlace",
                table: "Bookings");
        }
    }
}
