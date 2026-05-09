using System.Text.Json;
using SyncoDeLevo.Api.Models;

namespace SyncoDeLevo.Api.Services;

public interface ITemplateService
{
    IReadOnlyCollection<Template> List();
    Template? Get(string id);
}

public class TemplateService : ITemplateService
{
    private readonly Dictionary<string, Template> _templates = new(StringComparer.OrdinalIgnoreCase);

    public TemplateService(IWebHostEnvironment env, ILogger<TemplateService> logger)
    {
        var dir = Path.Combine(env.ContentRootPath, "Data", "templates");
        if (!Directory.Exists(dir))
        {
            logger.LogWarning("Template directory not found: {Dir}", dir);
            return;
        }
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
        foreach (var file in Directory.EnumerateFiles(dir, "*.json"))
        {
            try
            {
                using var stream = File.OpenRead(file);
                var template = JsonSerializer.Deserialize<Template>(stream, options);
                if (template is null || string.IsNullOrWhiteSpace(template.Id))
                {
                    logger.LogWarning("Skipping template (missing id): {File}", file);
                    continue;
                }
                var normalized = TemplateNormalization.Normalize(
                    template.Roles, template.Slots, template.Levels, file, logger);
                var fixedTemplate = template with
                {
                    Roles = normalized.Roles,
                    Slots = normalized.Slots,
                    Levels = normalized.Levels
                };
                _templates[fixedTemplate.Id] = fixedTemplate;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to load template {File}", file);
            }
        }
        logger.LogInformation("Loaded {Count} templates", _templates.Count);
    }

    public IReadOnlyCollection<Template> List() => _templates.Values;
    public Template? Get(string id) => _templates.TryGetValue(id, out var t) ? t : null;
}

public static class TemplateNormalization
{
    public record Result(
        List<Role> Roles,
        Dictionary<string, List<SlotDef>> Slots,
        List<Level> Levels);

    /// <summary>
    /// Normalizes role list, slot definitions and level gear maps:
    /// - Roles are free-form. The canonical role set is the union of the
    ///   explicit roles list and any role keys appearing in slots, in that
    ///   order. Each role gets an entry in the resulting Slots dict (possibly
    ///   empty). Role ids/labels are trimmed; entries with blank ids are
    ///   dropped.
    /// - Slot definitions: blank names dropped, duplicates collapsed (first
    ///   wins), defaults preserved.
    /// - Level.Gear is restricted to known role ids; per role, only slot names
    ///   declared in Slots[roleId] are kept. Unknown roles/slots produce a
    ///   warning and are dropped. A null value for a slot key means "explicit
    ///   clear" and is preserved.
    /// </summary>
    public static Result Normalize(
        List<Role>? rawRoles,
        Dictionary<string, List<SlotDef>>? rawSlots,
        List<Level>? rawLevels,
        string sourceLabel,
        ILogger logger)
    {
        var roles = new List<Role>();
        var roleIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        void AddRole(string? id, string? label)
        {
            if (string.IsNullOrWhiteSpace(id)) return;
            var trimmedId = id.Trim();
            if (roleIndex.ContainsKey(trimmedId)) return;
            var trimmedLabel = string.IsNullOrWhiteSpace(label) ? trimmedId : label.Trim();
            roleIndex[trimmedId] = roles.Count;
            roles.Add(new Role(trimmedId, trimmedLabel));
        }

        if (rawRoles is not null)
        {
            foreach (var r in rawRoles) AddRole(r?.Id, r?.Label);
        }
        if (rawSlots is not null)
        {
            foreach (var kvp in rawSlots) AddRole(kvp.Key, null);
        }

        var slots = new Dictionary<string, List<SlotDef>>(StringComparer.OrdinalIgnoreCase);
        foreach (var role in roles) slots[role.Id] = new List<SlotDef>();

        if (rawSlots is not null)
        {
            foreach (var kvp in rawSlots)
            {
                if (string.IsNullOrWhiteSpace(kvp.Key)) continue;
                var roleId = kvp.Key.Trim();
                if (!roleIndex.ContainsKey(roleId)) continue;
                var ordered = new List<SlotDef>();
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var def in kvp.Value ?? new List<SlotDef>())
                {
                    if (def is null) continue;
                    var name = def.Name?.Trim();
                    if (string.IsNullOrEmpty(name)) continue;
                    if (!seen.Add(name)) continue;
                    ordered.Add(def with { Name = name });
                }
                slots[roleId] = ordered;
            }
        }

        var levels = new List<Level>();
        foreach (var level in rawLevels ?? new List<Level>())
        {
            var normalizedGear = new Dictionary<string, Dictionary<string, SlotValue?>>(
                StringComparer.OrdinalIgnoreCase);

            if (level.Gear is not null)
            {
                foreach (var roleKvp in level.Gear)
                {
                    if (string.IsNullOrWhiteSpace(roleKvp.Key)) continue;
                    var roleId = roleKvp.Key.Trim();
                    if (!roleIndex.ContainsKey(roleId))
                    {
                        logger.LogWarning(
                            "{Source} level {LevelId} has unknown role '{Role}' — ignoring",
                            sourceLabel, level.Id, roleId);
                        continue;
                    }
                    var allowedSlots = slots[roleId];
                    var allowedSet = new HashSet<string>(
                        allowedSlots.Select(d => d.Name), StringComparer.OrdinalIgnoreCase);
                    var slotMap = new Dictionary<string, SlotValue?>(StringComparer.OrdinalIgnoreCase);
                    foreach (var slotKvp in roleKvp.Value ?? new Dictionary<string, SlotValue?>())
                    {
                        if (!allowedSet.Contains(slotKvp.Key))
                        {
                            logger.LogWarning(
                                "{Source} level {LevelId} role '{Role}' has unknown slot '{Slot}' — ignoring",
                                sourceLabel, level.Id, roleId, slotKvp.Key);
                            continue;
                        }
                        var canonical = allowedSlots.First(
                            d => string.Equals(d.Name, slotKvp.Key, StringComparison.OrdinalIgnoreCase)).Name;
                        slotMap[canonical] = slotKvp.Value;
                    }
                    normalizedGear[roleId] = slotMap;
                }
            }
            foreach (var role in roles)
            {
                if (!normalizedGear.ContainsKey(role.Id))
                    normalizedGear[role.Id] = new Dictionary<string, SlotValue?>();
            }

            levels.Add(new Level(level.Id, level.Name, normalizedGear));
        }

        return new Result(roles, slots, levels);
    }
}
