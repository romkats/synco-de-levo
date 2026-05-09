import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { acceptTransfer, getScenario, heartbeat, setActiveLevel } from '../api/scenarios';
import { clearLeaderToken, getLeaderToken, setLeaderToken } from '../state/leaderTokens';
import { getSelectedRole, setSelectedRole } from '../state/roleSelection';
import { useLevelHub } from '../hooks/useLevelHub';
import LevelList from '../components/LevelList';
import ShareBar from '../components/ShareBar';
import { type RoleId, type Scenario } from '../types';

export default function ScenarioPage() {
  const { scenarioId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [activeLevelId, setActiveLevelIdState] = useState<number | null>(null);
  const [leaderToken, setLeaderTokenState] = useState<string | null>(() => getLeaderToken(scenarioId));
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [transferAcceptError, setTransferAcceptError] = useState<string | null>(null);
  const [acceptingTransfer, setAcceptingTransfer] = useState(false);
  const [demotedNotice, setDemotedNotice] = useState(false);
  const [role, setRoleState] = useState<RoleId>(() => getSelectedRole(scenarioId, ''));

  function handleRoleChange(next: RoleId) {
    setRoleState(next);
    setSelectedRole(scenarioId, next);
  }

  const transferToken = searchParams.get('transfer');

  useEffect(() => {
    let cancelled = false;
    getScenario(scenarioId)
      .then(s => {
        if (cancelled) return;
        setScenario(s);
        setActiveLevelIdState(s.activeLevelId);
        setRoleState(prev => {
          if (prev && s.roles.some(r => r.id === prev)) return prev;
          return s.roles[0]?.id ?? '';
        });
      })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [scenarioId]);

  useLevelHub(scenarioId, {
    onActiveLevelChanged: (levelId) => setActiveLevelIdState(levelId),
    onLeaderChanged: () => {
      const myToken = getLeaderToken(scenarioId);
      if (!myToken) return;
      heartbeat(scenarioId, myToken).then(ok => {
        if (!ok) {
          clearLeaderToken(scenarioId);
          setLeaderTokenState(null);
          setDemotedNotice(true);
        }
      });
    },
    onScenarioRemoved: () => setRemoved(true)
  });

  useEffect(() => {
    if (!leaderToken) return;
    const id = window.setInterval(() => { heartbeat(scenarioId, leaderToken).catch(() => {}); }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [leaderToken, scenarioId]);

  const acceptingRef = useRef(false);
  useEffect(() => {
    if (!transferToken || acceptingRef.current) return;
    acceptingRef.current = true;
    setAcceptingTransfer(true);
    acceptTransfer(scenarioId, transferToken)
      .then(newToken => {
        setLeaderToken(scenarioId, newToken);
        setLeaderTokenState(newToken);
        const next = new URLSearchParams(searchParams);
        next.delete('transfer');
        setSearchParams(next, { replace: true });
      })
      .catch(e => setTransferAcceptError((e as Error).message))
      .finally(() => setAcceptingTransfer(false));
  }, [transferToken, scenarioId, searchParams, setSearchParams]);

  async function handleSelect(levelId: number) {
    if (!leaderToken) return;
    try {
      await setActiveLevel(scenarioId, levelId, leaderToken);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (removed) {
    return (
      <div className="page">
        <h1>Scenario closed</h1>
        <p>This scenario is no longer available.</p>
        <button onClick={() => navigate('/')}>Create a new one</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>Could not load scenario</h1>
        <p className="error">{error}</p>
        <button onClick={() => navigate('/')}>Back home</button>
      </div>
    );
  }

  if (!scenario) {
    return <div className="page"><p>Loading…</p></div>;
  }

  const isLeader = !!leaderToken;

  return (
    <div className="page scenario">
      <header className="scenario-header">
        <div>
          <h1>{scenario.name}</h1>
          <div className="scenario-meta">
            <span className={`role-badge ${isLeader ? 'leader' : 'member'}`}>{isLeader ? 'LEADER' : 'MEMBER'}</span>
            <span className="scenario-id">#{scenario.id}</span>
          </div>
        </div>
        <button className="link-btn" onClick={() => navigate('/')}>+ New scenario</button>
      </header>

      {acceptingTransfer && <div className="banner info">Accepting leadership…</div>}
      {transferAcceptError && <div className="banner error">Transfer failed: {transferAcceptError}</div>}
      {demotedNotice && <div className="banner warn">Leadership was transferred to someone else. You are now a member.</div>}

      {isLeader && <ShareBar scenarioId={scenarioId} leaderToken={leaderToken!} />}
      {!isLeader && (
        <div className="member-hint">
          You are watching as a member. The leader will set the active level.
        </div>
      )}

      <div className="role-selector" role="radiogroup" aria-label="Your role">
        <span className="role-selector-label">Your role:</span>
        {scenario.roles.map(r => (
          <button
            type="button"
            key={r.id}
            role="radio"
            aria-checked={role === r.id}
            className={`role-pill${role === r.id ? ' active' : ''}`}
            onClick={() => handleRoleChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <LevelList
        levels={scenario.levels}
        slots={scenario.slots}
        activeLevelId={activeLevelId}
        isLeader={isLeader}
        role={role}
        onSelect={handleSelect}
      />
    </div>
  );
}
