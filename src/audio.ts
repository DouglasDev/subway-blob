import { ENCOUNTERS } from './sim/encounters.ts';
import type { Cue, Encounter } from './sim/encounters.ts';

const music = {
  roll: new URL('./assets/rolling.mp3', import.meta.url).href,
  announcement: new URL('./assets/announcement.mp3', import.meta.url).href,
  loudspeaker: new URL('./assets/muffled-pa.mp3', import.meta.url).href,
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

const reactions: Partial<Record<Encounter, string>> = {
  acrobat: new URL('./assets/reaction-acrobat.mp3', import.meta.url).href,
  musician: new URL('./assets/reaction-musician.mp3', import.meta.url).href,
  prank: new URL('./assets/reaction-prank.mp3', import.meta.url).href,
  smoker: new URL('./assets/reaction-smoker.mp3', import.meta.url).href,
  takes: new URL('./assets/reaction-takes.mp3', import.meta.url).href,
  weird: new URL('./assets/reaction-weird.mp3', import.meta.url).href,
  ac: new URL('./assets/reaction-ac.mp3', import.meta.url).href,
  shover: new URL('./assets/reaction-prank.mp3', import.meta.url).href,
  spreader: new URL('./assets/reaction-weird.mp3', import.meta.url).href,
  speaker: music.loudspeaker,
};

function isEncounter(cue: Cue): cue is Encounter {
  return Object.hasOwn(ENCOUNTERS, cue);
}

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
  fluid: [
    { at: 0, length: 0.28, pitch: 330, end: 990 },
    { at: 0.22, length: 0.6, pitch: 790, end: 270 },
  ],
  soda: [
    { at: 0, length: 0.15, pitch: 1100, end: 450 },
    { at: 0.11, length: 0.43, pitch: 460, end: 140 },
  ],
  trackJolt: [{ at: 0, length: 0.22, pitch: 71, end: 35 }],
  brakeJolt: [
    { at: 0, length: 0.42, pitch: 76, end: 29 },
    { at: 0.06, length: 0.28, pitch: 134, end: 48 },
  ],
  shove: [{ at: 0, length: 0.2, pitch: 205, end: 75 }],
  rhino: [
    { at: 0, length: 0.32, pitch: 118, end: 62, shape: 'sawtooth' },
    { at: 0.19, length: 0.27, pitch: 112, end: 48 },
  ],
  pop: [
    { at: 0, length: 0.41, pitch: 390, end: 34, shape: 'triangle' },
    { at: 0.025, length: 0.5, pitch: 119, end: 38 },
  ],
};

const impacts: Partial<Record<Cue, readonly [number, number, number]>> = {
  pop: [0.49, 1450, 0.37],
  trackJolt: [0.25, 290, 0.19],
  brakeJolt: [0.52, 360, 0.25],
  soda: [0.26, 3250, 0.11],
  shove: [0.16, 860, 0.21],
  rhino: [0.24, 410, 0.16],
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
  private readonly guestReactions = new Map(
    (Object.entries(reactions) as [Encounter, string][]).map(([kind, url]) => [
      kind,
      clip(url, kind === 'speaker' ? 1 : 0.82),
    ]),
  );
  private readonly murmurs = [
    reactions.acrobat!,
    reactions.takes!,
    reactions.weird!,
    reactions.ac!,
    new URL('./assets/brooklyn-complaint.mp3', import.meta.url).href,
    new URL('./assets/brooklyn-figures.mp3', import.meta.url).href,
  ].map((url) => clip(url, 0.31));
  private murmurIndex = -1;
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
    ...this.guestReactions.values(),
    ...this.murmurs,
    ...Object.values(this.effects),
  ];
  private context?: AudioContext;
  private bus?: GainNode;
  private speakerPan?: StereoPannerNode;
  private allowed = false;
  private muted = false;
  private rolling = false;
  private activePerformance?: HTMLAudioElement;
  private activeReaction?: HTMLAudioElement;

  unlock() {
    this.allowed = true;

    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.bus = this.context.createGain();
        this.bus.connect(this.context.destination);
        this.bus.gain.value = this.muted ? 0 : 1;
        const speaker = this.guestReactions.get('speaker');

        if (speaker && typeof this.context.createStereoPanner === 'function') {
          this.speakerPan = this.context.createStereoPanner();
          this.speakerPan.connect(this.bus);
          this.context.createMediaElementSource(speaker).connect(this.speakerPan);
        }
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

  travel(running: boolean, speed: number) {
    if (running === this.rolling) {
      if (running) {
        this.roll.volume = (0.08 + speed * 0.35) * (this.activePerformance ? 0.55 : 1);
        this.roll.playbackRate = 0.75 + 0.27 * speed;
      }

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

    if (active) {
      const volume = kind === 'musician' ? 0.54 : kind === 'acrobat' ? 0.59 : 0.61;
      const reacting =
        this.activeReaction && !this.activeReaction.paused && !this.activeReaction.ended;

      active.volume = reacting ? volume * 0.42 : volume;
    }

    if (active === this.activePerformance) return;

    this.activePerformance?.pause();
    this.activePerformance = active;

    if (active && this.allowed) this.play(active);
  }

  cue(cue: Cue, pan = 0) {
    if (cue === 'pop') this.activeReaction?.pause();
    if (!this.allowed || this.muted) return;

    const reaction = isEncounter(cue) ? this.guestReactions.get(cue) : undefined;

    if (reaction) {
      if (cue === 'speaker' && this.speakerPan && this.context)
        this.speakerPan.pan.setValueAtTime(
          Math.max(-1, Math.min(1, pan)),
          this.context.currentTime,
        );
      this.activeReaction?.pause();
      this.activeReaction = reaction;
      this.play(reaction);

      return;
    }

    if (cue === 'murmur') {
      if (this.activeReaction && !this.activeReaction.paused && !this.activeReaction.ended) return;

      this.murmurIndex =
        (this.murmurIndex + 1 + Math.floor(Math.random() * (this.murmurs.length - 1))) %
        this.murmurs.length;

      this.play(this.murmurs[this.murmurIndex]);

      return;
    }

    if (cue === 'crazy' || cue === 'fart' || cue === 'vomit') {
      this.play(this.effects[cue]);

      return;
    }

    if (cue === 'announcement' || cue === 'chime') {
      this.play(cue === 'announcement' ? this.announcement : this.chime);

      return;
    }

    if (!this.context || this.context.state !== 'running' || !this.bus) return;

    const impact = impacts[cue];

    if (impact) this.impact(...impact);

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

  private impact(duration: number, cutoff: number, level: number) {
    const context = this.context!;
    const start = context.currentTime;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 1.8;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.value = level;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.bus!);
    source.start(start);
  }

  reset() {
    this.rolling = false;
    this.activePerformance = undefined;
    this.activeReaction = undefined;

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
