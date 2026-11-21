import type { Cue, Encounter } from './sim/encounters.ts';

const music = {
  roll: new URL('./assets/rolling.mp3', import.meta.url).href,
  announcement: new URL('./assets/announcement.mp3', import.meta.url).href,
  chime: new URL('./assets/chime.mp3', import.meta.url).href,
};

const performances = {
  acrobat: new URL('./assets/showtime.mp3', import.meta.url).href,
  musician: [
    new URL('./assets/off-key.mp3', import.meta.url).href,
    new URL('./assets/crooked-waltz.mp3', import.meta.url).href,
    new URL('./assets/tin-can-blues.mp3', import.meta.url).href,
    new URL('./assets/cardboard-tango.mp3', import.meta.url).href,
    new URL('./assets/wrong-stop.mp3', import.meta.url).href,
  ],
  prank: new URL('./assets/pigeon.mp3', import.meta.url).href,
};

const powerEffects = {
  crazy: new URL('./assets/crazy.mp3', import.meta.url).href,
  fart: new URL('./assets/fart.mp3', import.meta.url).href,
  vomit: new URL('./assets/vomit.mp3', import.meta.url).href,
};

function clip(url: string, volume: number, loop = false) {
  const audio = new Audio(url);

  audio.volume = volume;
  audio.loop = loop;
  audio.preload = 'auto';

  return audio;
}

type Tone = { at: number; length: number; pitch: number; end?: number; shape?: OscillatorType };

const sounds: Partial<Record<Cue, Tone[]>> = {
  pickup: [
    { at: 0, length: 0.15, pitch: 660 },
    { at: 0.1, length: 0.22, pitch: 960 },
  ],
  cool: [
    { at: 0, length: 0.41, pitch: 680, end: 1046 },
    { at: 0.14, length: 0.46, pitch: 920, end: 1560 },
  ],
  shield: [
    { at: 0, length: 0.4, pitch: 280, end: 505 },
    { at: 0.13, length: 0.6, pitch: 420, end: 654 },
  ],
  annoy: [
    { at: 0, length: 0.29, pitch: 540, end: 725, shape: 'square' },
    { at: 0.34, length: 0.42, pitch: 765, end: 450, shape: 'square' },
  ],
  candy: [
    { at: 0, length: 0.25, pitch: 445, end: 670 },
    { at: 0.24, length: 0.39, pitch: 740, end: 1100 },
  ],
  express: [{ at: 0, length: 0.6, pitch: 110, end: 482, shape: 'sawtooth' }],
  fan: [
    { at: 0, length: 0.8, pitch: 342, end: 211 },
    { at: 0.12, length: 0.6, pitch: 675, end: 520 },
  ],
  pop: [{ at: 0, length: 0.24, pitch: 325, end: 48, shape: 'triangle' }],
};

export class RideAudio {
  private readonly roll = clip(music.roll, 0.26, true);
  private readonly announcement = clip(music.announcement, 0.48);
  private readonly chime = clip(music.chime, 0.61);
  private readonly performanceClips = {
    acrobat: clip(performances.acrobat, 0.59, true),
    musician: performances.musician.map((url) => clip(url, 0.54, true)),
    prank: clip(performances.prank, 0.61, true),
  };
  private readonly effects = {
    crazy: clip(powerEffects.crazy, 0.75),
    fart: clip(powerEffects.fart, 0.91),
    vomit: clip(powerEffects.vomit, 0.75),
  };
  private readonly clips = [
    this.roll,
    this.announcement,
    this.chime,
    this.performanceClips.acrobat,
    ...this.performanceClips.musician,
    this.performanceClips.prank,
    ...Object.values(this.effects),
  ];
  private context?: AudioContext;
  private bus?: GainNode;
  private allowed = false;
  private muted = false;
  private rolling = false;
  private activePerformance?: HTMLAudioElement;

  unlock() {
    this.allowed = true;

    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.bus = this.context.createGain();
        this.bus.connect(this.context.destination);
        this.bus.gain.value = this.muted ? 0 : 1;
      }

      void this.context.resume().catch(() => {});
    } catch {
      // Recorded audio and gameplay can operate independently.
    }
  }

  setMute(muted: boolean) {
    this.muted = muted;

    for (const clip of this.clips) clip.muted = muted;
    if (this.bus && this.context)
      this.bus.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.035);
  }

  travel(running: boolean, progress: number) {
    if (running === this.rolling) {
      if (running)
        this.roll.volume =
          (0.11 + Math.sin(Math.PI * progress) * 0.32) * (this.activePerformance ? 0.55 : 1);

      return;
    }

    this.rolling = running;

    if (running && this.allowed) this.play(this.roll);
    else this.roll.pause();
  }

  performance(kind: Encounter | undefined, variant = 0) {
    const active =
      kind === 'musician'
        ? this.performanceClips.musician[variant]
        : kind === 'acrobat' || kind === 'prank'
          ? this.performanceClips[kind]
          : undefined;

    if (active === this.activePerformance) return;

    this.activePerformance?.pause();
    this.activePerformance = active;

    if (active && this.allowed) this.play(active);
  }

  cue(cue: Cue) {
    if (!this.allowed || this.muted) return;

    if (cue === 'crazy' || cue === 'fart' || cue === 'vomit') {
      this.play(this.effects[cue]);

      return;
    }

    if (cue === 'announcement' || cue === 'chime') {
      this.play(cue === 'announcement' ? this.announcement : this.chime);

      return;
    }

    if (!this.context || this.context.state !== 'running' || !this.bus) return;

    for (const note of sounds[cue] ?? []) {
      const start = this.context.currentTime + note.at;
      const end = start + note.length;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = note.shape ?? 'triangle';
      oscillator.frequency.setValueAtTime(note.pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.end ?? note.pitch, end);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.073, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(gain);
      gain.connect(this.bus);
      oscillator.start(start);
      oscillator.stop(end + 0.01);
    }
  }

  reset() {
    this.rolling = false;
    this.activePerformance = undefined;

    for (const clip of this.clips) {
      clip.pause();
      clip.currentTime = 0;
    }
  }

  dispose() {
    this.reset();

    if (this.context) void this.context.close().catch(() => {});
  }

  private play(clip: HTMLAudioElement) {
    clip.currentTime = 0;
    void clip.play().catch(() => {});
  }
}
