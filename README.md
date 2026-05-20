# synco-de-levo

Keep your team in sync about which level is currently active in a scenario. One person becomes the leader, creates a scenario, and shares a link with the team. Everyone sees live updates as the leader changes levels—no refresh needed.

## Quick Start

1. **Open the app** — Go to http://localhost:5173 (or wherever it's hosted)
2. **Create a scenario** — Click "Create Scenario," pick a template (or build custom), and give it a name
3. **You're the leader** — A share bar appears at the bottom with a URL
4. **Invite your team** — Copy the URL and send it to teammates
5. **Select your role** — Everyone picks their role (Tank, Healer, DPS) to see their specific gear list
6. **Leader controls the level** — As the leader, click any level to make it active; everyone else sees it update instantly
7. **Transfer leadership** — Click "Generate transfer link" to pass control to someone else

That's it! The scenario and all updates happen in real-time across everyone's browsers.

## Using the App

### Create a Scenario
- Click **Create Scenario** on the home page
- Choose from a built-in template (predefined role/level structure) or **Build Custom** to define your own
- Name your scenario and confirm
- You automatically become the **leader**

### Share with Your Team
- A **share bar** appears at the bottom of the scenario page
- Copy the URL and send it to teammates
- They can open the link anytime to join as members and watch in real-time

### Select Your Role
- On the scenario page, pick your role: **Tank**, **Healer**, or **DPS**
- Your selection is personal and stored in your browser (not shared with others)
- Each role sees its own gear/equipment list for each level
- Everyone still sees the same active level

### Navigate Levels (Leader Only)
- As the leader, click any level in the list to make it active
- All members instantly see the level change and the list auto-scrolls to it
- The currently active level is highlighted

### Transfer Leadership
- Click **Generate transfer link** in the share bar
- Send the link to the person you want to make leader
- They open the link and confirm to accept leadership
- You lose leader control; they gain it (and a leader token for future actions)
- Everyone gets notified of the leadership change

### Keep Your Scenario Alive (Leader)
- Scenarios auto-save as long as the leader's browser is open
- If the leader closes the tab or goes inactive for 24 hours, the scenario is removed
- The longer you keep it open, the longer it stays available for your team

## For Developers

### Prerequisites

- .NET SDK 8.0+
- Node.js 18+ (LTS) and npm

### Local Development Setup

In two terminals:

```powershell
# Terminal 1 — backend (http://localhost:5080)
cd backend
dotnet run

# Terminal 2 — frontend dev server (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 → create a scenario → copy the URL from the share bar → open it in another browser to test the live member view.

### Stack

- **Frontend:** React 18 + Vite + TypeScript, plain CSS, `react-router-dom`, `@microsoft/signalr` client.
- **Backend:** ASP.NET Core 8 (latest .NET LTS) Web API + SignalR.

### How Leadership Works

- When you create a scenario, the server returns a leader token (random GUID) stored in `localStorage` under `leaderToken:<scenarioId>`
- Any leader-only action sends that token via the `X-Leader-Token` header
- Anyone visiting `/s/:scenarioId` without a matching token is a member
- Leadership transfer uses a temporary `transferToken`; the recipient exchanges it for a new `leaderToken`, and the old one is invalidated
- All clients get notified via SignalR when leadership changes

### Architecture Notes

- **In-memory store** — No database. Scenarios are stored in memory and lost on backend restart
- **Leader inactivity cleanup** — Scenarios are evicted after 24 hours of leader inactivity (configurable)
- **Real-time sync** — SignalR handles live updates for all connected clients

### Templates

Built-in templates live at `backend/Data/templates/*.json` and are loaded at startup. Add new ones by dropping JSON files in that folder following the schema below, then restart the backend.

Each template declares **slots per role** at the top level. Each level then sets values for *some* of those slots, **per role**:

- A slot **missing** from a level inherits its value from the previous level
- A slot present with value `null` is **explicitly cleared** from this level on
- A slot present with an object is **set** at this level (shown highlighted in the UI; inherited values are dimmed)

Each slot value is a single item: `{ name, tier?, notes?, color? }`. The optional `color` is a CSS color background hint.

Supported role IDs: `tank`, `healer`, `dps` (defined in code). Unknown roles or slot names are logged and ignored at load time.

**Example template:**

```json
{
  "id": "raid-alpha",
  "name": "Raid Alpha",
  "description": "Optional description.",
  "slots": {
    "tank":   ["weapon", "armor", "consumable"],
    "healer": ["weapon", "armor", "consumable"],
    "dps":    ["weapon", "armor", "consumable"]
  },
  "levels": [
    { "id": 1, "name": "Stage 1", "gear": {
        "tank":   { "weapon": { "name": "Heavy Shield", "tier": "T1" }, "armor": { "name": "Plate", "tier": "T1" } },
        "healer": { "weapon": { "name": "Med Kit",      "tier": "T1" } },
        "dps":    { "weapon": { "name": "Rifle",        "tier": "T1", "color": "#5a3a8a" } }
    }},
    { "id": 2, "name": "Stage 2", "gear": {
        "tank":   { "weapon": { "name": "Greatshield", "tier": "T2" } },
        "healer": { "consumable": null }
    }}
  ]
}
```

In Stage 2, the tank's `armor` is unchanged (inherited), the healer's `consumable` is cleared, and the DPS inherits everything from Stage 1.

### Role Selection

Every viewer picks a **role** on the scenario page. Selection is stored locally in `localStorage` under `role:<scenarioId>` and is per-user, per-scenario. Roles are never sent to the server or synced via SignalR.

To change the global role list, edit `backend/Models/Roles.cs` and `frontend/src/types.ts` (`ROLES`), then update template JSONs accordingly.

### API Reference

- `GET  /api/templates` — list built-in templates
- `GET  /api/templates/{id}` — full template
- `POST /api/scenarios` `{ name, source: "template"|"custom", templateId?, levels? }` → `{ scenarioId, leaderToken, scenario }`
- `GET  /api/scenarios/{id}` — scenario including `activeLevelId`
- `POST /api/scenarios/{id}/active` `{ levelId }`, header `X-Leader-Token`
- `POST /api/scenarios/{id}/transfer` (leader) → `{ transferToken }`
- `POST /api/scenarios/{id}/transfer/accept` `{ transferToken }` → `{ leaderToken }`
- `POST /api/scenarios/{id}/heartbeat` (leader) — refreshes idle timer

#### SignalR Hub `/hubs/level`

**Client → Server:**
- `JoinScenario(scenarioId)`
- `LeaveScenario(scenarioId)`

**Server → Clients:**
- `ActiveLevelChanged(scenarioId, levelId)`
- `LeaderChanged(scenarioId)`
- `ScenarioRemoved(scenarioId)`

### Configuration

`backend/appsettings.json` (or environment variables) supports:

- `Cleanup:IntervalSeconds` (default `300`) — how often the cleanup loop runs
- `Cleanup:IdleThresholdSeconds` (default `86400`) — leader inactivity before a scenario is evicted

### Known Limitations (MVP)

- No authentication; anyone with the URL can view; only token holders can lead
- No database — backend restart loses everything
- Scenarios cannot be edited after creation
- Leader heartbeat depends on the leader's browser tab being open (~5 min interval)
