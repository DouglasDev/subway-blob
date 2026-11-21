import { styled } from '@linaria/react';
import type { ReactNode } from 'react';
import { COOL_POINTS, POWERS } from './sim/powers.ts';
import type { Power } from './sim/powers.ts';

const directions = [
  { id: 'up', icon: '↑', label: 'Move away from camera' },
  { id: 'left', icon: '←', label: 'Move left' },
  { id: 'down', icon: '↓', label: 'Move toward camera' },
  { id: 'right', icon: '→', label: 'Move right' },
] as const;

const Deck = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 12px clamp(8px, 3vw, 20px) 8px;
  background: #1b2a23;
  border-top: 1px solid #475b4f;
  user-select: none;

  @media (orientation: landscape) and (max-height: 500px) {
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'pad utility powers';
    padding-block: 3px;
  }
`;

const Pad = styled.div`
  display: grid;
  grid-template: repeat(3, 44px) / repeat(3, 44px);
  grid-template-areas: '. up .' 'left hub right' '. down .';
  align-self: center;
  touch-action: none;

  @media (orientation: landscape) and (max-height: 500px) {
    grid-area: pad;
  }

  &[data-cabinet='true'] {
    position: absolute;
    bottom: 4px;
    left: 4px;
    grid-template: repeat(2, 27px) / repeat(3, 27px);
    grid-template-areas: '. up .' 'left down right';
    gap: 2px;

    @media (pointer: fine) {
      display: none;
    }
  }
`;

const Hub = styled.div`
  grid-area: hub;
  background: #121e1a;

  &::after {
    content: '';
    display: block;
    margin: 12px;
    aspect-ratio: 1;
    border: 1px solid #42534b;
    border-radius: 50%;
  }
`;

const DirectionButton = styled.button`
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: #121e1a;
  color: #dce9d6;
  font: 700 1.15rem var(--sans);
  touch-action: none;
  cursor: pointer;

  &[data-direction='up'] {
    grid-area: up;
    border-radius: 7px 7px 0 0;
    box-shadow: inset 0 2px #46584d;
  }

  &[data-direction='left'] {
    grid-area: left;
    border-radius: 7px 0 0 7px;
    box-shadow: inset 2px 0 #3c4d43;
  }

  &[data-direction='right'] {
    grid-area: right;
    border-radius: 0 7px 7px 0;
    box-shadow: inset -2px 0 #0c1512;
  }

  &[data-direction='down'] {
    grid-area: down;
    border-radius: 0 0 7px 7px;
    box-shadow: inset 0 -2px #0c1512;
  }

  &:active:not(:disabled) {
    background: #49634c;
  }

  &:disabled {
    color: #869a8a;
    cursor: default;
  }

  &[data-cabinet='true'] {
    border: 1px solid #789182;
    border-radius: 4px;
    font-size: 12px;
    box-shadow: none;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  flex-direction: row-reverse;
  align-items: start;
  justify-self: end;
  justify-content: end;
  gap: clamp(5px, 2vw, 12px);

  @media (orientation: landscape) and (max-height: 500px) {
    grid-area: powers;
  }
`;

const ActionSlot = styled.div`
  display: grid;
  width: clamp(56px, 19vw, 76px);
  justify-items: center;
  gap: 5px;
  margin-top: 14px;

  &[data-first='true'] {
    margin-top: 0;
  }
`;

const ActionButton = styled.button`
  display: grid;
  place-items: center;
  width: 49px;
  height: 49px;
  padding: 0;
  border: 1px solid #df9477;
  border-radius: 50%;
  background: #ad4a3d;
  color: #fff6e2;
  box-shadow:
    inset 0 2px #dc7b65,
    0 3px #4c261f;
  font: 800 1.15rem var(--sans);
  cursor: pointer;
  touch-action: manipulation;

  &[data-first='true'] {
    background: #ae3c5e;
    border-color: #e38ea9;
    box-shadow:
      inset 0 2px #d86c8d,
      0 3px #4b2635;
  }

  &:disabled {
    color: #d4bcb7;
    opacity: 0.64;
    cursor: default;
  }

  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: none;
  }
`;

const ActionLabel = styled.span`
  min-height: 2.35em;
  color: #e8edda;
  text-align: center;
  overflow-wrap: anywhere;
  font: 650 0.7rem/1.18 var(--sans);
`;

const Utility = styled.div`
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  justify-content: center;
  gap: 9px;

  @media (orientation: landscape) and (max-height: 500px) {
    grid-area: utility;
    flex-wrap: wrap;
  }
`;

export function powerSlotLabel(power: Power | null, slot: number) {
  if (!power) return `Empty power-up slot ${slot + 1}`;

  const effect = power === 'cool' ? `. Restore up to ${COOL_POINTS} squeeze tolerance points` : '';

  return `Use ${POWERS[power].name} in slot ${slot + 1}${effect}`;
}

type MovementProps = {
  onDirection: (pointer: number, direction?: string) => void;
  disabled?: boolean;
  cabinet?: boolean;
};

export function MovementPad({ onDirection, disabled, cabinet = false }: MovementProps) {
  return (
    <Pad role="group" aria-label="Movement controls" data-cabinet={cabinet}>
      {!cabinet && <Hub aria-hidden="true" />}
      {directions.map(({ id, icon, label }) => (
        <DirectionButton
          key={id}
          type="button"
          data-direction={id}
          data-cabinet={cabinet}
          aria-label={label}
          disabled={disabled}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onDirection(event.pointerId, id);
          }}
          onLostPointerCapture={(event) => onDirection(event.pointerId)}
          onPointerUp={(event) => onDirection(event.pointerId)}
          onPointerCancel={(event) => onDirection(event.pointerId)}
        >
          {icon}
        </DirectionButton>
      ))}
    </Pad>
  );
}

type TouchControlsProps = {
  inventory: (Power | null)[];
  disabled: boolean;
  onPower: (slot: 0 | 1) => void;
  onDirection: MovementProps['onDirection'];
  children: ReactNode;
};

export function TouchControls({
  inventory,
  disabled,
  onPower,
  onDirection,
  children,
}: TouchControlsProps) {
  return (
    <Deck role="group" aria-label="Touch controls">
      <MovementPad disabled={disabled} onDirection={onDirection} />
      <ActionButtons role="group" aria-label="Power-up slots">
        {([0, 1] as const).map((slot) => {
          const power = inventory[slot];

          return (
            <ActionSlot key={slot} data-first={slot === 0}>
              <ActionButton
                type="button"
                data-first={slot === 0}
                aria-label={powerSlotLabel(power, slot)}
                disabled={!power || disabled}
                onClick={() => onPower(slot)}
              >
                {slot === 0 ? 'A' : 'B'}
              </ActionButton>
              <ActionLabel>
                {power ? POWERS[power].name : 'Empty'}
                {power === 'cool' && ` · +${COOL_POINTS} tolerance`}
              </ActionLabel>
            </ActionSlot>
          );
        })}
      </ActionButtons>
      <Utility>{children}</Utility>
    </Deck>
  );
}
