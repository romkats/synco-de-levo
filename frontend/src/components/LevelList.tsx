import { useEffect, useMemo, useRef } from 'react';
import { effectiveSlots, type Level, type RoleId, type SlotsByRole } from '../types';
import LevelCard from './LevelCard';

type Props = {
  levels: Level[];
  slots: SlotsByRole;
  activeLevelId: number | null;
  isLeader: boolean;
  role: RoleId;
  onSelect: (levelId: number) => void;
};

export default function LevelList({ levels, slots, activeLevelId, isLeader, role, onSelect }: Props) {
  const refs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const roleSlots = slots?.[role] ?? [];

  const resolvedPerLevel = useMemo(
    () => effectiveSlots(levels, role, roleSlots),
    [levels, role, roleSlots]
  );

  useEffect(() => {
    if (activeLevelId == null) return;
    const el = refs.current.get(activeLevelId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = window.innerHeight / 3;
    const top = rect.top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }, [activeLevelId]);

  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(roleSlots.length, 1)}, minmax(120px, 1fr))`,
  };

  return (
    <div className="level-list">
      {roleSlots.length > 0 && (
        <div className="level-list-header" style={gridStyle}>
          {roleSlots.map((s) => (
            <div key={s.name} className="level-list-header-cell" title={s.name}>
              {s.name}
            </div>
          ))}
        </div>
      )}
      {levels.map((l, idx) => (
        <LevelCard
          key={l.id}
          ref={el => { refs.current.set(l.id, el); }}
          levelId={l.id}
          levelName={l.name}
          isActive={l.id === activeLevelId}
          isLeader={isLeader}
          slots={roleSlots}
          resolved={resolvedPerLevel[idx] ?? []}
          onSelect={() => onSelect(l.id)}
        />
      ))}
    </div>
  );
}
