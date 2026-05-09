# Render Deployment - Environment Variables Documentation

## Required Environment Variables

### Backend (API Service)

**CORS Configuration:**
- `Cors__AllowedOrigins__0` — Frontend URL (e.g., `https://your-frontend-service.onrender.com`)
  - Render uses double underscores (`__`) to represent JSON nesting in environment variables
  - Set as many `Cors__AllowedOrigins__N` as needed for multiple frontends

Example for Render:
```
Cors__AllowedOrigins__0=https://frontend-app.onrender.com
Cors__AllowedOrigins__1=https://www.your-domain.com  (if using custom domain)
```

**Scenario Cleanup (optional, uses defaults if not set):**
- `Cleanup__IntervalSeconds` — How often cleanup runs (default: 300 seconds)
- `Cleanup__IdleThresholdSeconds` — Leader inactivity before eviction (default: 86400 seconds = 24 hours)

### Frontend (Web Service)

- `VITE_API_URL` — Backend API endpoint (e.g., `https://your-backend-service.onrender.com`)
  - **Note:** This is only used if frontend hardcodes API calls; currently uses relative URLs, so may not be needed

## How to Set in Render Dashboard

1. Go to your Backend service → **Environment**
2. Add variables under "Environment Variables"
3. Render automatically injects them; no restart needed
4. To verify, check logs or test API endpoints

## Local Development

In `appsettings.Development.json` and `appsettings.json`:
- CORS defaults to `http://localhost:5173` and `http://127.0.0.1:5173`
- In `appsettings.prod.json`, `AllowedOrigins` is an empty array (filled by environment variable in production)

## SignalR Considerations

- SignalR uses WebSocket connections, which are fully supported by Render
- Ensure `AllowCredentials()` is enabled (already set in code)
- Make sure frontend and backend are on same domain or properly configured CORS
