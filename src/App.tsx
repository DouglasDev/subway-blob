import { useEffect, useRef, useState } from 'react';
import { createScene } from './render/scene';
import { STATIONS } from './sim/crowd.ts';
import { Ride } from './sim/ride.ts';
import type { Phase } from './sim/ride.ts';
import {
  Best,
  BestValue,
  Brand,
  Bullet,
  Button,
  Card,
  Controls,
  Dashboard,
  Flow,
  Game,
  Gauge,
  GaugeBar,
  GaugeCaption,
  GaugeValue,
  Header,
  Keys,
  Line,
  Metric,
  MetricName,
  MetricValue,
  Overlay,
  Pad,
  PadButton,
  Prompt,
  PromptTitle,
  Route,
  RouteDot,
  RouteLabel,
  Shell,
  Stage,
  Status,
  Stop,
  Title,
  View,
} from './ui';

const bestKey = 'subway-blob:best';
const directions = [
  { id: 'up', icon: '↑', label: 'Move away from camera' },
  { id: 'left', icon: '←', label: 'Move left' },
  { id: 'down', icon: '↓', label: 'Move toward camera' },
  { id: 'right', icon: '→', label: 'Move right' },
];

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

const phaseText: Record<Phase, string> = {
  ready: 'At platform',
  arriving: 'Arriving',
  doors: 'Doors open',
  closing: 'Doors closing',
  running: 'In transit',
  popped: 'Ride ended',
  complete: 'Route complete',
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
    pressure: ride.phase === 'popped' ? 100 : Math.round(ride.fluid.pressure * 100),
  };
}

function StopMarker({ name, label, current }: { name: string; label: string; current?: boolean }) {
  return (
    <Stop data-current={!!current}>
      <RouteLabel>{label}</RouteLabel>
      <RouteDot data-current={!!current} />
      <span>{name}</span>
    </Stop>
  );
}

export function App() {
  const [ride, setRide] = useState(() => new Ride());
  const [hud, setHud] = useState(() => snapshot(ride));
  const [best, setBest] = useState(loadBest);
  const [graphicsError, setGraphicsError] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const touches = useRef(new Map<number, string>());

  useEffect(() => {
    const clear = () => {
      keys.current.clear();
      touches.current.clear();
    };

    const down = (event: KeyboardEvent) => {
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
  }, []);

  useEffect(() => {
    if (!canvas.current) return;

    let view: ReturnType<typeof createScene>;

    try {
      view = createScene(canvas.current, ride);
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

      for (const direction of touches.current.values()) movement.add(direction);

      ride.advance(dt, {
        x: Number(movement.has('right')) - Number(movement.has('left')),
        z: Number(movement.has('down')) - Number(movement.has('up')),
      });

      view.draw(dt);

      if (ride.time !== lastTime || ride.phase !== lastPhase) {
        setHud(snapshot(ride));
        lastTime = ride.time;
        lastPhase = ride.phase;
      }

      if (ride.phase === 'popped') {
        if (poppedAt < 0) poppedAt = now;
        if (now - poppedAt > 640) setShowResult(true);
      }

      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      view.dispose();
    };
  }, [ride]);

  useEffect(() => {
    if (hud.score <= best) return;

    setBest(hud.score);

    try {
      localStorage.setItem(bestKey, String(hud.score));
    } catch {
      // Keep the current tab's best when storage is disabled.
    }
  }, [best, hud.score]);

  function restart() {
    const next = new Ride();

    next.start();
    keys.current.clear();
    touches.current.clear();
    setShowResult(false);
    setHud(snapshot(next));
    setRide(next);
  }

  const ended = hud.phase === 'popped' || hud.phase === 'complete';
  const result = hud.phase === 'complete' || showResult;

  return (
    <Shell>
      <Header>
        <Brand>
          <Bullet aria-label="1 train">1</Bullet>
          <div>
            <Title>Subway Blob</Title>
            <Line>Broadway–7 Av Local · Northbound</Line>
          </div>
        </Brand>
        <Best>
          Personal best
          <BestValue>
            {best} {best === 1 ? 'stop' : 'stops'}
          </BestValue>
        </Best>
      </Header>

      <Game aria-label="Subway Blob simulator">
        <Route aria-label="Train route">
          <StopMarker label="Previous" name={STATIONS[hud.stop - 1] ?? '—'} />
          <StopMarker
            label={hud.phase === 'running' ? 'Departed' : 'Station'}
            name={STATIONS[hud.stop]}
            current
          />
          <StopMarker label="Next" name={STATIONS[hud.stop + 1] ?? '—'} />
        </Route>

        <Stage>
          <View ref={canvas} aria-label="3D view of the subway car and your green blob" />
          <Status data-doors={hud.phase === 'doors' || hud.phase === 'closing'} role="status">
            {phaseText[hud.phase]}
          </Status>
          {(hud.phase === 'doors' || hud.phase === 'closing') && (
            <Flow>
              −{hud.exited} exiting · +{hud.boarded} boarding
            </Flow>
          )}

          {!ended && hud.phase !== 'ready' && (
            <Pad aria-label="Movement controls">
              {directions.map(({ id, icon, label }) => (
                <PadButton
                  key={id}
                  type="button"
                  data-dir={id}
                  aria-label={label}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    touches.current.set(event.pointerId, id);
                  }}
                  onLostPointerCapture={(event) => touches.current.delete(event.pointerId)}
                  onPointerUp={(event) => touches.current.delete(event.pointerId)}
                  onPointerCancel={(event) => touches.current.delete(event.pointerId)}
                >
                  {icon}
                </PadButton>
              ))}
            </Pad>
          )}

          {(graphicsError || hud.phase === 'ready' || result) && (
            <Overlay>
              <Card>
                <Prompt>
                  <PromptTitle>
                    {graphicsError
                      ? '3D view unavailable'
                      : result
                        ? hud.phase === 'popped'
                          ? 'You popped'
                          : 'Route complete'
                        : 'Ride the 1 train'}
                  </PromptTitle>
                  {graphicsError
                    ? 'Enable WebGL in your browser to play.'
                    : result
                      ? `${STATIONS[hud.stop]} · ${hud.score} ${hud.score === 1 ? 'stop' : 'stops'} survived`
                      : 'Steer into open gaps before riders crowd you out.'}
                </Prompt>
                {!graphicsError && (
                  <Button type="button" onClick={result ? restart : () => ride.start()}>
                    {result ? 'Ride again' : 'Start ride'}
                  </Button>
                )}
              </Card>
            </Overlay>
          )}
        </Stage>

        <Dashboard>
          <Metric>
            <MetricName>Stops survived</MetricName>
            <MetricValue>{String(hud.score).padStart(2, '0')}</MetricValue>
          </Metric>
          <Metric>
            <MetricName>Riders in car</MetricName>
            <MetricValue>{String(hud.onboard).padStart(2, '0')}</MetricValue>
          </Metric>
          <Gauge>
            <GaugeCaption>
              <MetricName>Squeeze</MetricName>
              <GaugeValue>{hud.pressure}%</GaugeValue>
            </GaugeCaption>
            <GaugeBar
              max={100}
              value={hud.pressure}
              data-high={hud.pressure > 70}
              aria-label="Squeeze"
            />
          </Gauge>
          <Controls>
            <Keys>W A S D</Keys>
            <Keys>↑ ← ↓ →</Keys> Move
          </Controls>
        </Dashboard>
      </Game>
    </Shell>
  );
}
