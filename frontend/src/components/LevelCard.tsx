import { forwardRef } from 'react';
import type { ResolvedSlot, SlotDef } from '../types';

type Props = {
  levelId: number;
  levelName: string;
  isActive: boolean;
  isLeader: boolean;
  slots: SlotDef[];
  resolved: ResolvedSlot[];
  onSelect: () => void;
};

const LevelCard = forwardRef<HTMLDivElement, Props>(function LevelCard(
  { levelId, levelName, isActive, isLeader, slots, resolved, onSelect },
  ref,
) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(slots.length, 1)}, minmax(120px, 1fr))`,
  };
  return (
    <div
      ref={ref}
      className={`level-card${isActive ? ' active' : ''}${isLeader ? ' leader' : ''}`}
      onClick={isLeader ? onSelect : undefined}
      role={isLeader ? 'button' : undefined}
      tabIndex={isLeader ? 0 : undefined}
      onKeyDown={
        isLeader
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <div className='level-card-header'>
        <span className='level-card-id'>#{levelId}</span>
        <span className='level-card-name'>{levelName}</span>
        {isActive && <span className='level-card-badge'>ACTIVE</span>}
      </div>
      {slots.length === 0 ? (
        <p className='gear-empty'>No slots defined for this role.</p>
      ) : (
        <div className='slot-row' style={gridStyle}>
          {resolved.map((rs) => {
            const showValue = rs.state === 'set' && rs.value;
            const fallback = rs.state !== 'set' ? rs.defaultValue : null;
            const colorSource = showValue ? rs.value : fallback;
            const cellClass = `slot-cell state-${rs.state}${rs.changed ? ' changed' : ' inherited'}${fallback ? ' has-default' : ''}`;
            return (
              <div
                key={rs.slot}
                className={cellClass}
                style={
                  colorSource?.color
                    ? { ['--slot-color' as never]: colorSource.color }
                    : undefined
                }
                title={`${rs.slot}${rs.changed ? ' (changed at this level)' : ' (inherited)'}`}
              >
                {showValue ? (
                  <>
                    <div className='slot-value'>{rs.value!.name}</div>
                    {rs.value!.notes && (
                      <div className='slot-notes'>{rs.value!.notes}</div>
                    )}
                  </>
                ) : fallback ? (
                  <>
                    <div className='slot-value'>{fallback.name}</div>
                    {fallback.notes && (
                      <div className='slot-notes'>{fallback.notes}</div>
                    )}
                  </>
                ) : rs.state === 'cleared' ? (
                  <div className='slot-value muted'>— cleared —</div>
                ) : (
                  <div className='slot-value muted'>—</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default LevelCard;
