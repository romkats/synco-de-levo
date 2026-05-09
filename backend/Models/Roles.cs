namespace SyncoDeLevo.Api.Models;

public record Role(string Id, string Label);

/// <summary>
/// Built-in starter roles. Used as suggested defaults when seeding new
/// scenarios from the UI; the backend no longer constrains scenarios to
/// these roles — any non-empty role id is accepted.
/// </summary>
public static class Roles
{
    public const string Tank = "tank";
    public const string Healer = "healer";
    public const string Dps = "dps";

    public static readonly IReadOnlyList<Role> Defaults = new[]
    {
        new Role(Tank, "Tank"),
        new Role(Healer, "Healer"),
        new Role(Dps, "DPS"),
    };
}
