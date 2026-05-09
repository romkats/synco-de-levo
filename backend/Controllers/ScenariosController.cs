using SyncoDeLevo.Api.Hubs;
using SyncoDeLevo.Api.Models;
using SyncoDeLevo.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace SyncoDeLevo.Api.Controllers;

[ApiController]
[Route("api/scenarios")]
public class ScenariosController : ControllerBase
{
    private const string LeaderTokenHeader = "X-Leader-Token";

    private readonly IScenarioStore _store;
    private readonly ITemplateService _templates;
    private readonly IHubContext<LevelHub> _hub;
    private readonly ILogger<ScenariosController> _logger;

    public ScenariosController(
        IScenarioStore store,
        ITemplateService templates,
        IHubContext<LevelHub> hub,
        ILogger<ScenariosController> logger)
    {
        _store = store;
        _templates = templates;
        _hub = hub;
        _logger = logger;
    }

    [HttpPost]
    public IActionResult Create([FromBody] CreateScenarioRequest req)
    {
        if (req is null || string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "name is required" });

        List<Role> roles;
        Dictionary<string, List<SlotDef>> slots;
        List<Level> levels;
        if (string.Equals(req.Source, "template", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(req.TemplateId))
                return BadRequest(new { error = "templateId is required for source=template" });
            var t = _templates.Get(req.TemplateId);
            if (t is null) return NotFound(new { error = "template not found" });
            roles = (t.Roles ?? new List<Role>()).Select(r => new Role(r.Id, r.Label)).ToList();
            slots = CloneSlots(t.Slots);
            levels = t.Levels.Select(CloneLevel).ToList();
        }
        else if (string.Equals(req.Source, "custom", StringComparison.OrdinalIgnoreCase))
        {
            if (req.Levels is null || req.Levels.Count == 0)
                return BadRequest(new { error = "levels required for source=custom" });
            var normalized = TemplateNormalization.Normalize(
                req.Roles, req.Slots, req.Levels, "custom-scenario", _logger);
            roles = normalized.Roles;
            slots = normalized.Slots;
            levels = normalized.Levels;
            if (roles.Count == 0)
                return BadRequest(new { error = "at least one role is required" });
        }
        else
        {
            return BadRequest(new { error = "source must be 'template' or 'custom'" });
        }

        var scenario = _store.Create(req.Name.Trim(), roles, slots, levels);
        var token = _store.GetLeaderTokenInternal(scenario.Id);
        return Ok(new CreateScenarioResponse(scenario.Id, token, scenario));
    }

    private static Dictionary<string, List<SlotDef>> CloneSlots(Dictionary<string, List<SlotDef>> src) =>
        src.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.Select(d => d with { }).ToList(), StringComparer.OrdinalIgnoreCase);

    private static Level CloneLevel(Level l) => new(
        l.Id,
        l.Name,
        l.Gear.ToDictionary(
            kvp => kvp.Key,
            kvp => new Dictionary<string, SlotValue?>(kvp.Value, StringComparer.OrdinalIgnoreCase),
            StringComparer.OrdinalIgnoreCase));

    [HttpGet("{id}")]
    public IActionResult Get(string id)
    {
        var s = _store.Get(id);
        return s is null ? NotFound() : Ok(s);
    }

    [HttpPost("{id}/active")]
    public async Task<IActionResult> SetActive(string id, [FromBody] SetActiveRequest req)
    {
        var token = Request.Headers[LeaderTokenHeader].ToString();
        if (string.IsNullOrEmpty(token)) return Unauthorized(new { error = "missing leader token" });
        var result = _store.TrySetActive(id, token, req.LevelId);
        return result switch
        {
            SetActiveResult.Ok => await BroadcastActiveAndOk(id, req.LevelId),
            SetActiveResult.ScenarioNotFound => NotFound(),
            SetActiveResult.LevelNotFound => NotFound(new { error = "level not found" }),
            SetActiveResult.NotLeader => StatusCode(403, new { error = "not the leader" }),
            _ => StatusCode(500)
        };
    }

    private async Task<IActionResult> BroadcastActiveAndOk(string scenarioId, int levelId)
    {
        await _hub.Clients.Group(LevelHub.GroupName(scenarioId))
            .SendAsync("ActiveLevelChanged", scenarioId, levelId);
        return NoContent();
    }

    [HttpPost("{id}/transfer")]
    public IActionResult StartTransfer(string id)
    {
        var token = Request.Headers[LeaderTokenHeader].ToString();
        if (string.IsNullOrEmpty(token)) return Unauthorized();
        var (result, transferToken) = _store.TryStartTransfer(id, token);
        return result switch
        {
            TransferStartResult.Ok => Ok(new TransferStartResponse(transferToken!)),
            TransferStartResult.ScenarioNotFound => NotFound(),
            TransferStartResult.NotLeader => StatusCode(403),
            _ => StatusCode(500)
        };
    }

    [HttpPost("{id}/transfer/accept")]
    public async Task<IActionResult> AcceptTransfer(string id, [FromBody] TransferAcceptRequest req)
    {
        var (result, newToken) = _store.TryAcceptTransfer(id, req.TransferToken ?? string.Empty);
        if (result == TransferAcceptResult.Ok)
        {
            await _hub.Clients.Group(LevelHub.GroupName(id)).SendAsync("LeaderChanged", id);
            return Ok(new TransferAcceptResponse(newToken!));
        }
        return result switch
        {
            TransferAcceptResult.ScenarioNotFound => NotFound(),
            TransferAcceptResult.InvalidToken => BadRequest(new { error = "invalid transfer token" }),
            _ => StatusCode(500)
        };
    }

    [HttpPost("{id}/heartbeat")]
    public IActionResult Heartbeat(string id)
    {
        var token = Request.Headers[LeaderTokenHeader].ToString();
        if (string.IsNullOrEmpty(token)) return Unauthorized();
        return _store.Heartbeat(id, token) ? NoContent() : StatusCode(403);
    }

}
