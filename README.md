# synco-de-levo

Visually keep a group in sync about which level is currently active in a chosen scenario. The first person to open the app **creates a scenario** (from a built-in template or a custom builder), automatically becomes the **leader**, and shares a URL with the rest of the team. Anyone opening that URL is a **member** and watches live (no refresh) as the leader changes the active level — the level list smooth-scrolls to the active one.

Everything is in-memory — there is no database. Scenarios are evicted after 24 hours of leader inactivity (configurable). The backend will lose all scenarios on restart.

## Stack

- **Frontend:** React 18 + Vite + TypeScript, plain CSS, `react-router-dom`, `@microsoft/signalr` client.
- **Backend:** ASP.NET Core 8 (latest .NET LTS) Web API + SignalR.

## Prerequisites

- .NET SDK 8.0+
- Node.js 18+ (LTS) and npm

## Run it

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

## How leadership works

- When you create a scenario, the server returns a leader token (random GUID) which is stored in your browser's `localStorage` under `leaderToken:<scenarioId>`.
- Any leader-only action sends that token via the `X-Leader-Token` header.
- Anyone visiting `/s/:scenarioId` without a matching token is a member.
- The leader can transfer leadership using **Generate transfer link** in the share bar. The recipient opens `/s/:id?transfer=<token>`; on accept they receive a new leader token, the old one is invalidated, and all clients receive a `LeaderChanged` event over SignalR.

## Templates

Built-in templates live at `backend/Data/templates/*.json` and are loaded at startup. Add new ones by dropping JSON files in that folder following the schema below, then restart the backend.

Each template (and scenario) declares **slots per role** at the top level. Each level then sets values for *some* of those slots, **per role**:

- A slot **missing** from a level inherits its value from the previous level.
- A slot present with value `null` is **explicitly cleared** from this level on (until re-set in a later level).
- A slot present with an object is **set** at this level (and shown highlighted in the UI; inherited values are shown dimmed).

Each slot value is a single item: `{ name, tier?, notes?, color? }`. The optional `color` is a CSS color used as a background hint for that cell.

Supported role ids are defined in code (currently `tank`, `healer`, `dps`). Unknown roles or unknown slot names are logged and ignored at load time.

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

In Stage 2 above, the tank's `armor` is unchanged (inherited from Stage 1), the healer's `consumable` is explicitly cleared, and the dps inherits everything from Stage 1.

## Roles

Every viewer of a scenario picks a **role** (Tank / Healer / DPS) on the scenario page. The selection is stored locally in `localStorage` under `role:<scenarioId>` — it is per-user, per-scenario, and never sent to the server or synced via SignalR. Each role sees its own gear list per level. The active level is still shared across all viewers regardless of role.

To change the global role list, edit `backend/Models/Roles.cs` and `frontend/src/types.ts` (`ROLES`), then update template JSONs accordingly.

## API

- `GET  /api/templates` — list built-in templates.
- `GET  /api/templates/{id}` — full template.
- `POST /api/scenarios` `{ name, source: "template"|"custom", templateId?, levels? }` → `{ scenarioId, leaderToken, scenario }`.
- `GET  /api/scenarios/{id}` — scenario incl. `activeLevelId`.
- `POST /api/scenarios/{id}/active` `{ levelId }`, header `X-Leader-Token`.
- `POST /api/scenarios/{id}/transfer` (leader) → `{ transferToken }`.
- `POST /api/scenarios/{id}/transfer/accept` `{ transferToken }` → `{ leaderToken }`.
- `POST /api/scenarios/{id}/heartbeat` (leader) — refreshes idle timer.

### SignalR hub `/hubs/level`

- Client → `JoinScenario(scenarioId)`, `LeaveScenario(scenarioId)`.
- Server → `ActiveLevelChanged(scenarioId, levelId)`, `LeaderChanged(scenarioId)`, `ScenarioRemoved(scenarioId)`.

## Configuration

`backend/appsettings.json` (or environment variables) supports:

- `Cleanup:IntervalSeconds` (default `300`) — how often the cleanup loop runs.
- `Cleanup:IdleThresholdSeconds` (default `86400`) — leader inactivity before a scenario is evicted.

## Known limitations (MVP)

- No authentication; anyone with the URL can view; only token holders can lead.
- No database — backend restart loses everything.
- Scenarios cannot be edited after creation.
- Leader heartbeat depends on the leader's browser tab being open (~5 min interval).
