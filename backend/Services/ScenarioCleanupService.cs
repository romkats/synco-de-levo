using SyncoDeLevo.Api.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace SyncoDeLevo.Api.Services;

public class ScenarioCleanupService : BackgroundService
{
    private readonly IScenarioStore _store;
    private readonly IHubContext<LevelHub> _hub;
    private readonly ILogger<ScenarioCleanupService> _logger;
    private readonly TimeSpan _interval;
    private readonly TimeSpan _idleThreshold;

    public ScenarioCleanupService(
        IScenarioStore store,
        IHubContext<LevelHub> hub,
        IConfiguration config,
        ILogger<ScenarioCleanupService> logger)
    {
        _store = store;
        _hub = hub;
        _logger = logger;
        _interval = TimeSpan.FromSeconds(config.GetValue("Cleanup:IntervalSeconds", 300));
        _idleThreshold = TimeSpan.FromSeconds(config.GetValue("Cleanup:IdleThresholdSeconds", 24 * 60 * 60));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cleanup running every {Interval}, idle threshold {Threshold}", _interval, _idleThreshold);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var removed = _store.EvictIdle(_idleThreshold).ToList();
                foreach (var id in removed)
                {
                    _logger.LogInformation("Evicted idle scenario {Id}", id);
                    await _hub.Clients.Group(LevelHub.GroupName(id)).SendAsync("ScenarioRemoved", id, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Cleanup error");
            }
            try { await Task.Delay(_interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }
}
