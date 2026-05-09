using Microsoft.AspNetCore.SignalR;

namespace SyncoDeLevo.Api.Hubs;

public class LevelHub : Hub
{
    public static string GroupName(string scenarioId) => $"scenario:{scenarioId}";

    public Task JoinScenario(string scenarioId)
        => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(scenarioId));

    public Task LeaveScenario(string scenarioId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(scenarioId));
}
