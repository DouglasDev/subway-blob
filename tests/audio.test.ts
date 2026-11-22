import assert from 'node:assert/strict';
import test from 'node:test';
import { RideAudio } from '../src/audio.ts';

class Media extends EventTarget {
  static played: Media[] = [];
  static rejectPlayback = false;
  paused = true;
  ended = false;

  constructor(readonly url: string) {
    super();
  }

  async play() {
    Media.played.push(this);
    if (Media.rejectPlayback) throw new Error('Playback requires interaction');

    this.paused = false;
    this.ended = false;
  }

  pause() {
    this.paused = true;
  }

  finish() {
    this.ended = true;
    this.dispatchEvent(new Event('ended'));
  }
}

const buffer = new ArrayBuffer(1);

class Node {
  gain = { value: 0, setTargetAtTime() {} };
  threshold = { value: 0 };
  ratio = { value: 0 };
  buffer?: ArrayBuffer;
  onended?: () => void;
  stopped = false;

  connect(next: Node) {
    return next;
  }

  start() {}

  stop() {
    this.stopped = true;
    this.onended?.();
  }
}

class Context {
  static players: Node[] = [];
  static resume?: () => void;
  destination = new Node();
  state = 'suspended';

  resume() {
    return new Promise<void>((resolve) => {
      Context.resume = () => {
        this.state = 'running';
        resolve();
      };
    });
  }

  createGain() {
    return new Node();
  }

  createDynamicsCompressor() {
    return new Node();
  }

  createBufferSource() {
    const node = new Node();

    Context.players.push(node);

    return node;
  }

  async decodeAudioData() {
    return buffer;
  }

  async close() {
    this.state = 'closed';
  }
}

test('audio cues mix independently and preserve the passenger voice rotation', async (t) => {
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: Media });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => buffer }));
  const audio = new RideAudio();

  t.after(() => {
    audio.dispose();
    Reflect.deleteProperty(globalThis, 'Audio');
    Reflect.deleteProperty(globalThis, 'AudioContext');
  });

  audio.unlock();

  // An HTML media fallback rejected during a suspended session still gets one retry.
  Media.rejectPlayback = true;
  audio.cue('annoy');
  Context.resume!();
  await new Promise(setImmediate);
  assert.equal(Context.players.length, 1);

  Media.rejectPlayback = false;
  audio.cue('annoy');
  audio.cue('omny');
  assert.equal(Context.players.length, 3);
  assert.ok(Context.players.every((source) => !source.stopped));
  audio.cue('murmur');
  assert.equal(Media.played.length, 1, 'background voices yield to the alarm');

  audio.reset();
  assert.ok(Context.players.every((source) => source.stopped));

  audio.setMute(true);
  audio.cue('annoy');
  assert.equal(Context.players.length, 3);

  audio.setMute(false);
  const rotation = new Set<string>();

  for (let i = 0; i < 18; i++) {
    audio.cue('murmur');
    const line = Media.played.at(-1)!;

    rotation.add(line.url);
    line.finish();
  }

  assert.equal(rotation.size, 18);
  assert.equal([...rotation].filter((url) => url.includes('/passengers/')).length, 12);
  const last = Media.played.at(-1)!;

  audio.cue('murmur');
  assert.notEqual(Media.played.at(-1), last);
});

test('overlapping fallback clips play independently when Web Audio is unavailable', (t) => {
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: Media });
  const audio = new RideAudio();

  t.after(() => {
    audio.dispose();
    Reflect.deleteProperty(globalThis, 'Audio');
  });

  audio.unlock();
  audio.cue('annoy');
  audio.cue('annoy');
  const [first, second] = Media.played.slice(-2);

  assert.notEqual(first, second);
  assert.equal(first.paused, false);
  assert.equal(second.paused, false);

  audio.reset();
  assert.equal(first.paused, true);
  assert.equal(second.paused, true);
});
