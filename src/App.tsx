import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arcadeEmbedded, arcadeMode } from './arcade';
import { createScene } from './render/scene';
import { STATIONS, stationIndex } from './sim/route.ts';
import { ENCOUNTERS } from './sim/encounters.ts';
import { COOL_POINTS, POWERS } from './sim/powers.ts';
import { ACROBAT_MOVES, MUSICIAN_SONGS, PRANKS } from './sim/guestContent.ts';
import { RideAudio } from './audio';
import { MovementPad, powerSlotLabel, TouchControls } from './TouchControls';
import { Ride } from './sim/ride.ts';
import type { Input, Phase } from './sim/ride.ts';
import {
  Best,
  BestValue,
  Brand,
  Bullet,
  Button,
  Card,
  Controls,
  Dashboard,
  EncounterNotice,
  Flow,
  Game,
  Gauge,
  GaugeBar,
  GaugeCaption,
  GaugeValue,
  Header,
  Inventory,
  InventoryKey,
  InventorySlot,
  Keys,
  Line,
  Metric,
  MetricName,
  MetricValue,
  Overlay,
  SoundButton,
  Speech,
  Prompt,
  PromptTitle,
  PowerNotice,
  Route,
  RouteDot,
  RouteLabel,
  Shell,
  Stage,
  Stop,
  StopName,
  Title,
  View,
} from './ui';

const bestKey = 'subway-blob:best:4';
const soundKey = 'subway-blob:muted';

function newRide() {
  const seed = new URLSearchParams(location.search).get('seed');

  return new Ride(
    seed && /^\d+$/.test(seed) ? Number(seed) : crypto.getRandomValues(new Uint32Array(1))[0],
  );
}

function soundMuted() {
  try {
    return localStorage.getItem(soundKey) === 'true';
  } catch {
    return false;
  }
}

const compactRoute = window.matchMedia('(max-width: 520px)');
const touchQuery = window.matchMedia('(any-pointer: coarse)');

function subscribeToTouchLayout(update: () => void) {
  touchQuery.addEventListener('change', update);

  return () => touchQuery.removeEventListener('change', update);
}

function subscribeToCompactRoute(update: () => void) {
  compactRoute.addEventListener('change', update);

  return () => compactRoute.removeEventListener('change', update);
}

function getCompactRoute() {
  return compactRoute.matches;
}

function getTouchLayout() {
  return !arcadeMode && (navigator.maxTouchPoints > 0 || touchQuery.matches);
}

const keyDirection: Record<string, string> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
};

function loadBest() {
  try {
    return Math.max(0, Number(localStorage.getItem(bestKey)) || 0);
  } catch {
    return 0;
  }
}

function snapshot(ride: Ride) {
  return {
    stop: ride.stop,
    score: ride.score,
    phase: ride.phase,
    onboard: ride.crowd.onboard,
    boarded: ride.crowd.boarded,
    exited: ride.crowd.exited,
    squished: Math.floor((1 - ride.tolerance) * 100 + 1e-9),
    encounter: ride.encounter?.kind,
    inventory: [...ride.inventory],
    speech: ride.speech,
    guestPressure: ride.guestPressure,
    sustainedPower:
      ride.shieldUntil > ride.time
        ? ('shield' as const)
        : ride.fluidUntil > ride.time
          ? ('fluid' as const)
          : ride.expressUntil > ride.time
            ? ('express' as const)
            : undefined,
    variant: ride.encounter?.variant ?? 0,
    squeeze: ride.squeeze,
    sticky: ride.sticky,
    power: ride.animation && ride.animation.until > ride.time ? ride.animation.cue : undefined,
  };
}

function StopMarker({ name, label, current }: { name: string; label: string; current?: boolean }) {
  return (
    <Stop data-current={!!current}>
      <RouteLabel>{label}</RouteLabel>
      <RouteDot data-current={!!current} />
      <StopName title={name}>{name}</StopName>
    </Stop>
  );
}

export function App() {
  const touchLayout = useSyncExternalStore(subscribeToTouchLayout, getTouchLayout);
  const twoStations = useSyncExternalStore(subscribeToCompactRoute, getCompactRoute);
  const [ride, setRide] = useState(newRide);
  const [hud, setHud] = useState(() => snapshot(ride));
  const [best, setBest] = useState(loadBest);
  const [graphicsError, setGraphicsError] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [sound, setSound] = useState(soundMuted);
  const [audio] = useState(() => new RideAudio());
  const bubble = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const stick = useRef<Input>({ x: 0, z: 0 });
  const touches = useRef(new Map<number, string>());
  const arcade = useRef<typeof import('@rcade/plugin-input-classic') | null>(null);
  const actions = useRef(new Set<'a' | 'b' | 'start' | 'mute'>());

  const restart = useCallback(() => {
    const next = newRide();

    audio.reset();
    next.start();
    keys.current.clear();
    touches.current.clear();
    stick.current = { x: 0, z: 0 };
    setShowResult(false);
    setHud(snapshot(next));
    setRide(next);
  }, [audio]);

  const toggleSound = useCallback(() => {
    audio.unlock();
    setSound((muted) => !muted);
  }, [audio]);

  useEffect(() => {
    audio.setMute(sound);

    try {
      localStorage.setItem(soundKey, String(sound));
    } catch {
      // Cabinet storage is scoped to this session.
    }
  }, [audio, sound]);

  useEffect(() => () => audio.dispose(), [audio]);

  useEffect(() => {
    stick.current = { x: 0, z: 0 };
  }, [touchLayout]);

  useEffect(() => {
    if (!arcadeEmbedded) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import('@rcade/plugin-input-classic').then((controls) => {
      if (!active) return;

      arcade.current = controls;

      unsubscribe = controls.on('press', ({ player, button }) => {
        if (player === 1 && (button === 'A' || button === 'B')) {
          audio.unlock();
          actions.current.add(button === 'A' ? 'a' : 'b');
        }

        if (button === 'ONE_PLAYER') {
          audio.unlock();
          actions.current.add('start');
        }

        if (button === 'TWO_PLAYER') actions.current.add('mute');
      });
    });

    return () => {
      unsubscribe?.();
      active = false;
      arcade.current = null;
    };
  }, [audio]);

  useEffect(() => {
    if (arcadeEmbedded) return;

    const clear = () => {
      keys.current.clear();
      touches.current.clear();
      stick.current = { x: 0, z: 0 };
    };

    const down = (event: KeyboardEvent) => {
      if (
        !event.repeat &&
        (event.code === 'Enter' || event.code === 'Space') &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        audio.unlock();
        actions.current.add('start');
      }

      if (!event.repeat && (event.code === 'KeyZ' || event.code === 'KeyX')) {
        audio.unlock();
        actions.current.add(event.code === 'KeyZ' ? 'a' : 'b');
      }

      if (!event.repeat && event.code === 'KeyM') toggleSound();
      if (!keyDirection[event.code]) return;

      event.preventDefault();
      keys.current.add(event.code);
    };

    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [audio, toggleSound]);

  useEffect(() => {
    if (!canvas.current) return;

    let view: ReturnType<typeof createScene>;

    try {
      view = createScene(canvas.current, ride, arcadeMode);
    } catch {
      setGraphicsError(true);

      return;
    }

    let frame = 0;
    let previous = performance.now();
    let lastTime = -1;
    let lastPhase: Phase | undefined;
    let poppedAt = -1;

    function animate(now: number) {
      const dt = Math.min(0.1, (now - previous) / 1000);

      previous = now;
      const movement = new Set(Array.from(keys.current, (key) => keyDirection[key]));
      const controls = arcade.current;

      for (const direction of touches.current.values()) movement.add(direction);

      if (controls) {
        for (const [direction, held] of Object.entries(controls.PLAYER_1.DPAD)) {
          if (held) movement.add(direction);
        }
      }

      const activate = actions.current.has('start') || (arcadeEmbedded && actions.current.has('a'));
      const activeRide = ride.phase !== 'ready' && ride.phase !== 'popped';

      if (actions.current.has('mute')) toggleSound();

      if (activate && ride.phase === 'ready') {
        audio.unlock();
        ride.start();
      } else if (activate && poppedAt >= 0 && now - poppedAt > 1060) {
        audio.unlock();
        restart();
      } else if (activeRide) {
        if (actions.current.has('a')) ride.usePower(0);
        if (actions.current.has('b')) ride.usePower(1);
      }

      actions.current.clear();

      ride.advance(dt, {
        x: Number(movement.has('right')) - Number(movement.has('left')) + stick.current.x,
        z: Number(movement.has('down')) - Number(movement.has('up')) + stick.current.z,
      });

      for (const cue of ride.cues.splice(0)) {
        const source = cue === 'speaker' ? ride.encounter?.location : undefined;

        audio.cue(cue, source ? (source.x - ride.fluid.x) / 4.5 : 0);
      }

      view.draw(dt);

      audio.performance(
        ride.phase === 'popped' ? undefined : ride.act?.role,
        ride.encounter?.variant,
      );

      audio.travel(ride.phase === 'running', ride.renderSpeed);

      const speaker = ride.act;

      if (bubble.current && speaker) {
        const { left, top } = view.speechPosition(speaker.x, speaker.z);

        bubble.current.style.left = `${left}%`;
        bubble.current.style.top = `${top}%`;
      }

      if (ride.time !== lastTime || ride.phase !== lastPhase) {
        setHud(snapshot(ride));
        lastTime = ride.time;
        lastPhase = ride.phase;
      }

      if (ride.phase === 'popped') {
        if (poppedAt < 0) poppedAt = now;
        if (now - poppedAt > 1060) setShowResult(true);
      }

      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      view.dispose();
    };
  }, [audio, restart, ride, toggleSound]);

  useEffect(() => {
    if (hud.score <= best) return;

    setBest(hud.score);

    try {
      localStorage.setItem(bestKey, String(hud.score));
    } catch {
      // Keep the current tab's best when storage is disabled.
    }
  }, [best, hud.score]);

  const actTitle =
    hud.encounter === 'acrobat'
      ? ACROBAT_MOVES[hud.variant]
      : hud.encounter === 'musician'
        ? MUSICIAN_SONGS[hud.variant]
        : hud.encounter === 'prank'
          ? PRANKS[hud.variant].name
          : undefined;
  const activePower = hud.power ?? hud.sustainedPower;
  const ended = hud.phase === 'popped';
  const result = showResult;

  function usePower(slot: 0 | 1) {
    audio.unlock();
    ride.usePower(slot);
  }

  function setTouchDirection(pointer: number, direction?: string) {
    if (direction) touches.current.set(pointer, direction);
    else touches.current.delete(pointer);
  }

  const startButton = !graphicsError && (hud.phase === 'ready' || result) && (
    <Button
      type="button"
      data-touch={touchLayout}
      onClick={() => {
        audio.unlock();
        if (result) restart();
        else ride.start();
      }}
    >
      {arcadeMode ? (result ? 'A · Retry' : 'A · Start') : result ? 'Ride again' : 'Start ride'}
    </Button>
  );
  const soundButton = (
    <SoundButton
      type="button"
      data-touch={touchLayout}
      onClick={toggleSound}
      aria-label={sound ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={sound}
    >
      {arcadeMode ? '2 · ' : ''}
      {sound ? 'Muted' : 'Sound'}
    </SoundButton>
  );

  return (
    <Shell data-touch={touchLayout}>
      <Header data-touch={touchLayout}>
        <Brand>
          <Bullet aria-label="4 train">4</Bullet>
          <div>
            <Title>Subway Blob</Title>
            <Line data-touch={touchLayout}>
              Lexington Av Express · {ride.direction === 1 ? 'Southbound' : 'Northbound'}
            </Line>
          </div>
        </Brand>
        <Best>
          {arcadeMode ? 'Best' : 'Personal best'}
          <BestValue>
            {best} {best === 1 ? 'stop' : 'stops'}
          </BestValue>
        </Best>
        {soundButton}
      </Header>

      <Game aria-label="Subway Blob simulator" data-touch={touchLayout}>
        <Route
          aria-label="Train route"
          data-touch={touchLayout}
          data-two={touchLayout && twoStations}
        >
          {!arcadeMode && !(touchLayout && twoStations) && (
            <StopMarker label="Previous" name={STATIONS[stationIndex(hud.stop - 1)] ?? '—'} />
          )}
          <StopMarker
            label={hud.phase === 'running' ? 'Departed' : 'Station'}
            name={STATIONS[stationIndex(hud.stop)]}
            current
          />
          <StopMarker label="Next" name={STATIONS[stationIndex(hud.stop + 1)] ?? '—'} />
        </Route>

        <Stage data-touch={touchLayout}>
          <View
            data-touch={touchLayout}
            ref={canvas}
            aria-label="3D view of the subway car and your blob"
          />
          {(hud.phase === 'doors' || hud.phase === 'closing') && (
            <Flow>
              −{hud.exited} exiting · +{hud.boarded} boarding
            </Flow>
          )}

          {hud.encounter && (
            <EncounterNotice data-danger={hud.guestPressure > 0}>
              {ENCOUNTERS[hud.encounter].name}
              {actTitle ? ' · ' + actTitle : ''}
              {hud.guestPressure > 0 && ' · Too close'}
            </EncounterNotice>
          )}
          {hud.sticky && !ended && <PowerNotice data-mode="sticky">Sticky floor</PowerNotice>}
          {activePower && !ended && !hud.sticky && (
            <PowerNotice data-mode={activePower}>{POWERS[activePower].name}</PowerNotice>
          )}
          {hud.speech && <Speech ref={bubble}>{hud.speech}</Speech>}

          {arcadeMode && !ended && hud.phase !== 'ready' && (
            <MovementPad cabinet onDirection={setTouchDirection} />
          )}

          {(graphicsError || hud.phase === 'ready' || result) && (
            <Overlay data-touch={touchLayout}>
              <Card data-touch={touchLayout}>
                <Prompt>
                  <PromptTitle>
                    {graphicsError
                      ? '3D view unavailable'
                      : result
                        ? 'You popped'
                        : 'Ride the 4 train'}
                  </PromptTitle>
                  {graphicsError
                    ? 'Enable WebGL in your browser to play.'
                    : result
                      ? `Survived ${hud.score} ${hud.score === 1 ? 'stop' : 'stops'} · ${STATIONS[stationIndex(hud.stop)]}`
                      : arcadeMode
                        ? 'Miserable blob from track grime. Dodge the crowd before you get squished.'
                        : 'You’re a miserable blob formed from subway-track grime. Slip through the crowd and grab power-ups to avoid getting squished.'}
                </Prompt>
                {!touchLayout && startButton}
              </Card>
            </Overlay>
          )}
        </Stage>

        <Dashboard data-touch={touchLayout}>
          <Metric data-touch={touchLayout}>
            <MetricName>{arcadeMode ? 'Stops' : 'Stops survived'}</MetricName>
            <MetricValue>{String(hud.score).padStart(2, '0')}</MetricValue>
          </Metric>
          <Metric data-touch={touchLayout}>
            <MetricName>{arcadeMode ? 'Riders' : 'Riders in car'}</MetricName>
            <MetricValue>{String(hud.onboard).padStart(2, '0')}</MetricValue>
          </Metric>
          <Gauge data-touch={touchLayout}>
            <GaugeCaption>
              <MetricName>Squished</MetricName>
              <GaugeValue>{hud.squished}%</GaugeValue>
            </GaugeCaption>
            <GaugeBar
              max={100}
              value={hud.squished}
              data-high={hud.squished >= 65 || hud.squeeze >= 0.75}
              aria-label="Squished"
            />
          </Gauge>
          {!touchLayout && (
            <Controls>
              <Keys>W A S D</Keys>
              <Keys>↑ ← ↓ →</Keys> Move
            </Controls>
          )}
        </Dashboard>

        {touchLayout ? (
          <TouchControls
            inventory={hud.inventory}
            disabled={graphicsError || ended || hud.phase === 'ready'}
            onStick={(input) => {
              stick.current = input;
            }}
            onPower={usePower}
          >
            {startButton || null}
          </TouchControls>
        ) : (
          <Inventory aria-label="Power-up slots">
            {hud.inventory.map((power, slot) => {
              const key = (arcadeMode ? ['A', 'B'] : ['Z', 'X'])[slot];

              return (
                <InventorySlot
                  key={slot}
                  type="button"
                  disabled={!power || ended}
                  aria-label={powerSlotLabel(power, slot)}
                  onClick={() => usePower(slot === 0 ? 0 : 1)}
                >
                  <InventoryKey>{key}</InventoryKey> {power ? POWERS[power].name : 'Empty'}
                  {power === 'cool' && ` · −${COOL_POINTS} Squished`}
                </InventorySlot>
              );
            })}
          </Inventory>
        )}
      </Game>
    </Shell>
  );
}
