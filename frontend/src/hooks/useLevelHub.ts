import { useEffect, useRef, useState } from 'react';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

export type LevelHubEvents = {
  onActiveLevelChanged?: (levelId: number) => void;
  onLeaderChanged?: () => void;
  onScenarioRemoved?: () => void;
};

export function useLevelHub(scenarioId: string | undefined, events: LevelHubEvents) {
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<HubConnection | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/level')
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connectionRef.current = conn;

    conn.on('ActiveLevelChanged', (sid: string, levelId: number) => {
      if (sid === scenarioId) eventsRef.current.onActiveLevelChanged?.(levelId);
    });
    conn.on('LeaderChanged', (sid: string) => {
      if (sid === scenarioId) eventsRef.current.onLeaderChanged?.();
    });
    conn.on('ScenarioRemoved', (sid: string) => {
      if (sid === scenarioId) eventsRef.current.onScenarioRemoved?.();
    });

    (async () => {
      try {
        await conn.start();
        if (cancelled) { await conn.stop(); return; }
        await conn.invoke('JoinScenario', scenarioId);
        setConnected(true);
      } catch (err) {
        console.error('SignalR connect failed', err);
      }
    })();

    return () => {
      cancelled = true;
      setConnected(false);
      const c = connectionRef.current;
      connectionRef.current = null;
      if (c && c.state !== HubConnectionState.Disconnected) {
        c.invoke('LeaveScenario', scenarioId).catch(() => {}).finally(() => c.stop().catch(() => {}));
      }
    };
  }, [scenarioId]);

  return { connected };
}
