using System.Text.Json.Serialization;

namespace SyncoDeLevo.Api.Models;

public record SlotValue(string Name, string? Notes = null, string? Color = null);

[JsonConverter(typeof(SlotDefJsonConverter))]
public record SlotDef(string Name, SlotValue? Default = null);

// Per role, a map from slot name to value.
//   - key absent          => inherit from previous level
//   - key present, value null => explicitly cleared
//   - key present, value set  => explicit value at this level
public record Level(int Id, string Name, Dictionary<string, Dictionary<string, SlotValue?>> Gear);

public class Scenario
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<Role> Roles { get; set; } = new();
    public Dictionary<string, List<SlotDef>> Slots { get; set; } = new();
    public List<Level> Levels { get; set; } = new();
    public int? ActiveLevelId { get; set; }
}

public record Template(
    string Id,
    string Name,
    string? Description,
    List<Role>? Roles,
    Dictionary<string, List<SlotDef>> Slots,
    List<Level> Levels);

public record CreateScenarioRequest(
    string Name,
    string Source,
    string? TemplateId,
    List<Role>? Roles,
    Dictionary<string, List<SlotDef>>? Slots,
    List<Level>? Levels);

public record CreateScenarioResponse(string ScenarioId, string LeaderToken, Scenario Scenario);

public record SetActiveRequest(int LevelId);

public record TransferAcceptRequest(string TransferToken);

public record TransferStartResponse(string TransferToken);

public record TransferAcceptResponse(string LeaderToken);
