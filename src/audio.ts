import type { Cue } from './sim/encounters.ts';

const music = {
  roll: new URL('./assets/rolling.mp3', import.meta.url).href,
  announcement: new URL('./assets/announcement.mp3', import.meta.url).href,
  chime: new URL('./assets/chime.mp3', import.meta.url).href,
};

type Tone = { at: number; length: number; pitch: number; end?: number; shape?: OscillatorType };

const sounds: Partial<Record<Cue, Tone[]>> = {
  acrobat: [
    { at: 0, length: 0.07, pitch: 140, end: 74, shape: 'square' },
    { at: 0.1, length: 0.23, pitch: 1650, end: 1040 },
  ],
  musician: [
    { at: 0, length: 0.37, pitch: 196, shape: 'sawtooth' },
    { at: 0.26, length: 0.39, pitch: 254, shape: 'sawtooth' },
    { at: 0.66, length: 0.26, pitch: 175, end: 150, shape: 'sawtooth' },
  ],
  prank: [
    { at: 0, length: 0.35, pitch: 182, end: 33, shape: 'square' },
    { at: 0.11, length: 0.23, pitch: 521, end: 740 },
    { at: 0.33, length: 0.32, pitch: 710, end: 442 },
  ],
  crazy: [
    { at: 0, length: 0.16, pitch: 312, end: 630 },
    { at: 0.17, length: 0.14, pitch: 550, end: 277 },
    { at: 0.33, length: 0.17, pitch: 370, end: 900 },
  ],
  fart: [
    { at: 0, length: 0.52, pitch: 95, end: 33, shape: 'sawtooth' },
    { at: 0.22, length: 0.2, pitch: 63, end: 45, shape: 'triangle' },
  ],
  vomit: [
    { at: 0, length: 0.25, pitch: 148, end: 45, shape: 'square' },
    { at: 0.24, length: 0.2, pitch: 105, end: 31, shape: 'sawtooth' },
  ],
  pickup: [
    { at: 0, length: 0.15, pitch: 660 },
    { at: 0.1, length: 0.22, pitch: 960 },
  ],
  pop: [{ at: 0, length: 0.24, pitch: 325, end: 48, shape: 'triangle' }],
};

export class RideAudio {
  private readonly roll = new Audio(music.roll);
  private readonly announcement = new Audio(music.announcement);
  private readonly chime = new Audio(music.chime);
  private context?: AudioContext;
  private bus?: GainNode;
  private allowed = false;
  private muted = false;
  private rolling = false;

  constructor() {
    this.roll.loop = true;
    this.roll.volume = 0.26;
    this.announcement.volume = 0.48;
    this.chime.volume = 0.61;

    for (const clip of [this.roll, this.announcement, this.chime]) clip.preload = 'auto';
  }

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

    for (const clip of [this.roll, this.announcement, this.chime]) clip.muted = muted;
    if (this.bus && this.context)
      this.bus.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.035);
  }

  travel(running: boolean, progress: number) {
    if (running === this.rolling) {
      if (running) this.roll.volume = 0.11 + Math.sin(Math.PI * progress) * 0.32;

      return;
    }

    this.rolling = running;

    if (running && this.allowed) this.play(this.roll);
    else this.roll.pause();
  }

  cue(cue: Cue) {
    if (!this.allowed || this.muted) return;

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

    for (const clip of [this.roll, this.announcement, this.chime]) {
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
