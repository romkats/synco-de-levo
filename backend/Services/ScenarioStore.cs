using System.Collections.Concurrent;
using SyncoDeLevo.Api.Models;

namespace SyncoDeLevo.Api.Services;

public class ScenarioState
{
    public required Scenario Scenario { get; init; }
    public required string LeaderToken { get; set; }
    public string? PendingTransferToken { get; set; }
    public DateTime LeaderLastSeenUtc { get; set; }
}

public enum SetActiveResult { Ok, ScenarioNotFound, NotLeader, LevelNotFound }
public enum TransferStartResult { Ok, ScenarioNotFound, NotLeader }
public enum TransferAcceptResult { Ok, ScenarioNotFound, InvalidToken }

public interface IScenarioStore
{
    Scenario Create(string name, List<Role> roles, Dictionary<string, List<SlotDef>> slots, List<Level> levels);
    string GetLeaderTokenInternal(string scenarioId);
    Scenario? Get(string scenarioId);
    SetActiveResult TrySetActive(string scenarioId, string leaderToken, int levelId);
    (TransferStartResult Result, string? TransferToken) TryStartTransfer(string scenarioId, string leaderToken);
    (TransferAcceptResult Result, string? NewLeaderToken) TryAcceptTransfer(string scenarioId, string transferToken);
    bool Heartbeat(string scenarioId, string leaderToken);
    IEnumerable<string> EvictIdle(TimeSpan threshold);
}

public class ScenarioStore : IScenarioStore
{
    private readonly ConcurrentDictionary<string, ScenarioState> _store = new();
    private readonly IIdGenerator _ids;
    private readonly TimeProvider _clock;

    public ScenarioStore(IIdGenerator ids, TimeProvider clock)
    {
        _ids = ids;
        _clock = clock;
    }

    public Scenario Create(string name, List<Role> roles, Dictionary<string, List<SlotDef>> slots, List<Level> levels)
    {
        string id;
        var attempts = 0;
        do
        {
            id = _ids.NewScenarioId();
            attempts++;
            if (attempts > 10) throw new InvalidOperationException("Could not allocate scenario id");
        } while (_store.ContainsKey(id));

        var scenario = new Scenario
        {
            Id = id,
            Name = name,
            CreatedAt = _clock.GetUtcNow().UtcDateTime,
            Roles = roles,
            Slots = slots,
            Levels = levels,
            ActiveLevelId = null
        };
        var state = new ScenarioState
        {
            Scenario = scenario,
            LeaderToken = Guid.NewGuid().ToString("N"),
            LeaderLastSeenUtc = _clock.GetUtcNow().UtcDateTime
        };
        _store[id] = state;
        return scenario;
    }

    public string GetLeaderTokenInternal(string scenarioId)
        => _store.TryGetValue(scenarioId, out var s) ? s.LeaderToken : string.Empty;

    public Scenario? Get(string scenarioId)
        => _store.TryGetValue(scenarioId, out var s) ? s.Scenario : null;

    public SetActiveResult TrySetActive(string scenarioId, string leaderToken, int levelId)
    {
        if (!_store.TryGetValue(scenarioId, out var state)) return SetActiveResult.ScenarioNotFound;
        lock (state)
        {
            if (!string.Equals(state.LeaderToken, leaderToken, StringComparison.Ordinal))
                return SetActiveResult.NotLeader;
            if (state.Scenario.Levels.All(l => l.Id != levelId))
                return SetActiveResult.LevelNotFound;
            state.Scenario.ActiveLevelId = levelId;
            state.LeaderLastSeenUtc = _clock.GetUtcNow().UtcDateTime;
            return SetActiveResult.Ok;
        }
    }

    public (TransferStartResult, string?) TryStartTransfer(string scenarioId, string leaderToken)
    {
        if (!_store.TryGetValue(scenarioId, out var state)) return (TransferStartResult.ScenarioNotFound, null);
        lock (state)
        {
            if (!string.Equals(state.LeaderToken, leaderToken, StringComparison.Ordinal))
                return (TransferStartResult.NotLeader, null);
            state.PendingTransferToken = Guid.NewGuid().ToString("N");
            state.LeaderLastSeenUtc = _clock.GetUtcNow().UtcDateTime;
            return (TransferStartResult.Ok, state.PendingTransferToken);
        }
    }

    public (TransferAcceptResult, string?) TryAcceptTransfer(string scenarioId, string transferToken)
    {
        if (!_store.TryGetValue(scenarioId, out var state)) return (TransferAcceptResult.ScenarioNotFound, null);
        lock (state)
        {
            if (string.IsNullOrEmpty(state.PendingTransferToken) ||
                !string.Equals(state.PendingTransferToken, transferToken, StringComparison.Ordinal))
                return (TransferAcceptResult.InvalidToken, null);
            var newToken = Guid.NewGuid().ToString("N");
            state.LeaderToken = newToken;
            state.PendingTransferToken = null;
            state.LeaderLastSeenUtc = _clock.GetUtcNow().UtcDateTime;
            return (TransferAcceptResult.Ok, newToken);
        }
    }

    public bool Heartbeat(string scenarioId, string leaderToken)
    {
        if (!_store.TryGetValue(scenarioId, out var state)) return false;
        lock (state)
        {
            if (!string.Equals(state.LeaderToken, leaderToken, StringComparison.Ordinal)) return false;
            state.LeaderLastSeenUtc = _clock.GetUtcNow().UtcDateTime;
            return true;
        }
    }

    public IEnumerable<string> EvictIdle(TimeSpan threshold)
    {
        var cutoff = _clock.GetUtcNow().UtcDateTime - threshold;
        var removed = new List<string>();
        foreach (var kvp in _store)
        {
            if (kvp.Value.LeaderLastSeenUtc < cutoff)
            {
                if (_store.TryRemove(kvp.Key, out _)) removed.Add(kvp.Key);
            }
        }
        return removed;
    }
}
