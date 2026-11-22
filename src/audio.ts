import { ENCOUNTERS } from './sim/encounters.ts';
import type { Cue, Encounter } from './sim/encounters.ts';

const rolling = new URL('./assets/rolling.mp3', import.meta.url).href;

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
  sneezy: new URL('./assets/reaction-acrobat.mp3', import.meta.url).href,
  spreader: new URL('./assets/reaction-weird.mp3', import.meta.url).href,
};

function isEncounter(cue: Cue): cue is Encounter {
  return Object.hasOwn(ENCOUNTERS, cue);
}

const sampleFiles = {
  sneeze: { url: new URL('./assets/sneeze.mp3', import.meta.url).href, volume: 0.82 },
  announcement: { url: new URL('./assets/announcement.mp3', import.meta.url).href, volume: 0.48 },
  chime: { url: new URL('./assets/chime.mp3', import.meta.url).href, volume: 0.61 },
  crazy: { url: new URL('./assets/crazy.mp3', import.meta.url).href, volume: 0.75 },
  fart: { url: new URL('./assets/fart.mp3', import.meta.url).href, volume: 0.91 },
  vomit: { url: new URL('./assets/vomit.mp3', import.meta.url).href, volume: 0.75 },
  annoy: { url: new URL('./assets/alarm-siren.mp3', import.meta.url).href, volume: 0.93 },
  omny: { url: new URL('./assets/omny-toss.mp3', import.meta.url).href, volume: 0.91 },
  omnyLand: { url: new URL('./assets/omny-land.mp3', import.meta.url).href, volume: 0.85 },
  rhino: { url: new URL('./assets/rhino-bump.mp3', import.meta.url).href, volume: 0.91 },
  speaker: { url: new URL('./assets/muffled-pa.mp3', import.meta.url).href, volume: 1 },
};

type SampleCue = keyof typeof sampleFiles;

function isSample(cue: Cue): cue is SampleCue {
  return Object.hasOwn(sampleFiles, cue);
}

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
};

export class RideAudio {
  private readonly roll = clip(rolling, 0.26, true);
  private readonly performanceClips = {
    acrobat: clip(performances.acrobat, 0.59, true),
    musician: performances.musician.map((url) => clip(url, 0.54, true)),
    prank: clip(performances.prank, 0.61, true),
  };
  private readonly guestReactions = new Map(
    (Object.entries(reactions) as [Encounter, string][]).map(([kind, url]) => [
      kind,
      clip(url, 0.82),
    ]),
  );
  private readonly murmurs = [
    reactions.acrobat!,
    reactions.takes!,
    reactions.weird!,
    reactions.ac!,
    new URL('./assets/brooklyn-complaint.mp3', import.meta.url).href,
    new URL('./assets/brooklyn-figures.mp3', import.meta.url).href,
    ...Array.from({ length: 12 }, (_, i) => {
      const name = String(i + 1).padStart(2, '0');

      return new URL(`./assets/passengers/complaint-${name}.mp3`, import.meta.url).href;
    }),
  ].map((url) => clip(url, 0.39));
  private readonly murmurBag: HTMLAudioElement[] = [];
  private activeMurmur?: HTMLAudioElement;
  private readonly samples = new Map<SampleCue, Promise<AudioBuffer | undefined>>();
  private readonly sampleBuffers = new Map<SampleCue, AudioBuffer>();
  private readonly playingSamples = new Map<SampleCue, Set<() => void>>();
  private readonly fallbackPlayers = new Set<HTMLAudioElement>();
  private readonly clips = [
    this.roll,
    this.performanceClips.acrobat,
    ...this.performanceClips.musician,
    this.performanceClips.prank,
    ...this.guestReactions.values(),
    ...this.murmurs,
  ];
  private context?: AudioContext;
  private bus?: GainNode;
  private resuming?: Promise<void>;
  private playbackGeneration = 0;
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
        const limiter = this.context.createDynamicsCompressor();

        limiter.threshold.value = -8;
        limiter.ratio.value = 5;
        this.bus.connect(limiter).connect(this.context.destination);
        this.bus.gain.value = this.muted ? 0 : 1;
        this.loadSamples(this.context);
      }

      this.resumeAudio();
    } catch {
      // Recorded audio and gameplay can operate independently.
    }
  }

  setMute(muted: boolean) {
    this.muted = muted;

    if (muted) this.playbackGeneration++;

    for (const clip of this.clips) clip.muted = muted;
    for (const clip of this.fallbackPlayers) clip.muted = muted;
    if (this.bus && this.context)
      this.bus.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.035);
  }

  travel(running: boolean, speed: number) {
    if (running === this.rolling) {
      if (running) {
        const duck = this.playingSamples.has('annoy') ? 0.27 : this.activePerformance ? 0.55 : 1;

        this.roll.volume = (0.08 + speed * 0.35) * duck;
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
        this.playingSamples.has('annoy') ||
        this.playingSamples.has('speaker') ||
        (this.activeReaction && !this.activeReaction.paused && !this.activeReaction.ended);

      active.volume = reacting ? volume * 0.42 : volume;
    }

    if (active === this.activePerformance) return;

    this.activePerformance?.pause();
    this.activePerformance = active;

    if (active && this.allowed) this.play(active);
  }

  cue(cue: Cue, pan = 0) {
    if (cue === 'pop') {
      this.playbackGeneration++;
      this.activeReaction?.pause();
      this.activeMurmur?.pause();
      this.stopSample('speaker');
    }

    if (!this.allowed || this.muted) return;

    if (isSample(cue)) {
      if (cue === 'speaker') this.activeReaction?.pause();
      if (cue === 'speaker' || cue === 'annoy') this.activeMurmur?.pause();
      this.playSample(cue, pan);

      return;
    }

    const reaction = isEncounter(cue) ? this.guestReactions.get(cue) : undefined;

    if (reaction) {
      this.activeMurmur?.pause();
      this.activeReaction?.pause();
      this.activeReaction = reaction;
      this.play(reaction);

      return;
    }

    if (cue === 'murmur') {
      this.playMurmur();

      return;
    }

    if (!sounds[cue] && !impacts[cue]) return;

    if (this.context?.state === 'running') this.playSynth(cue);
    else this.whenAudioResumes(() => this.playSynth(cue));
  }

  private playMurmur() {
    if (this.playingSamples.has('speaker') || this.playingSamples.has('annoy')) return;
    if (this.activeReaction && !this.activeReaction.paused && !this.activeReaction.ended) return;
    if (this.activeMurmur && !this.activeMurmur.paused && !this.activeMurmur.ended) return;

    if (this.murmurBag.length === 0) {
      this.murmurBag.push(...this.murmurs);

      for (let i = this.murmurBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [this.murmurBag[i], this.murmurBag[j]] = [this.murmurBag[j], this.murmurBag[i]];
      }

      const last = this.murmurBag.length - 1;

      if (this.murmurBag[last] === this.activeMurmur)
        [this.murmurBag[last], this.murmurBag[0]] = [this.murmurBag[0], this.murmurBag[last]];
    }

    const line = this.murmurBag.pop()!;

    this.activeMurmur = line;
    this.play(line);
  }

  private playSynth(cue: Cue) {
    const { context, bus } = this;

    if (!context || !bus) return;

    const impact = impacts[cue];

    if (impact) this.impact(...impact);

    for (const note of sounds[cue] ?? []) {
      const start = context.currentTime + note.at;
      const end = start + note.length;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = note.shape ?? 'triangle';
      oscillator.frequency.setValueAtTime(note.pitch, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.end ?? note.pitch, end);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.073, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(gain);
      gain.connect(bus);
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

  private resumeAudio() {
    const { context } = this;

    if (!context || context.state === 'running' || context.state === 'closed') return;

    this.resuming ??= context
      .resume()
      .catch(() => {})
      .finally(() => {
        this.resuming = undefined;
      });

    return this.resuming;
  }

  private recentPlayback() {
    const generation = this.playbackGeneration;
    const deadline = performance.now() + 750;

    return () => this.playbackGeneration === generation && performance.now() <= deadline;
  }

  private whenAudioResumes(play: () => void) {
    const recent = this.recentPlayback();

    void this.resumeAudio()?.then(() => {
      if (recent() && this.context?.state === 'running') play();
    });
  }

  private loadSamples(context: AudioContext) {
    for (const cue of Object.keys(sampleFiles) as SampleCue[]) {
      const sample = fetch(sampleFiles[cue].url)
        .then((response) => {
          if (!response.ok) throw new Error('Could not load sound effect');

          return response.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data))
        .then((buffer) => {
          this.sampleBuffers.set(cue, buffer);

          return buffer;
        })
        .catch(() => undefined);

      this.samples.set(cue, sample);
    }
  }

  private trackSample(cue: SampleCue, stop: () => void) {
    const instances = this.playingSamples.get(cue) ?? new Set<() => void>();

    instances.add(stop);
    this.playingSamples.set(cue, instances);

    return () => {
      instances.delete(stop);

      if (instances.size === 0 && this.playingSamples.get(cue) === instances)
        this.playingSamples.delete(cue);
    };
  }

  private stopSample(cue: SampleCue) {
    const instances = this.playingSamples.get(cue);

    this.playingSamples.delete(cue);

    for (const stop of instances ?? []) stop();
  }

  private playSample(cue: SampleCue, pan: number) {
    const buffer = this.sampleBuffers.get(cue);

    if (buffer && this.context?.state === 'running') {
      this.playBuffer(cue, buffer, pan);

      return;
    }

    const { url, volume } = sampleFiles[cue];
    const fallback = clip(url, volume);
    const recent = this.recentPlayback();
    let stopped = false;
    const cleanup = this.trackSample(cue, () => {
      stopped = true;
      fallback.pause();
      this.fallbackPlayers.delete(fallback);
    });

    const ended = () => {
      cleanup();
      this.fallbackPlayers.delete(fallback);
    };

    fallback.addEventListener('ended', ended, { once: true });
    fallback.addEventListener('error', ended, { once: true });
    this.fallbackPlayers.add(fallback);

    void fallback.play().catch(async () => {
      ended();

      if (stopped || !recent()) return;

      const decoded = await this.samples.get(cue);

      if (!decoded || !recent()) return;

      await this.resumeAudio();
      if (recent() && this.context?.state === 'running') this.playBuffer(cue, decoded, pan);
    });
  }

  private playBuffer(cue: SampleCue, buffer: AudioBuffer, pan: number) {
    const { context, bus } = this;

    if (!context || !bus) return;

    const player = context.createBufferSource();
    const gain = context.createGain();

    player.buffer = buffer;
    gain.gain.value = sampleFiles[cue].volume;
    player.connect(gain);

    if (
      (cue === 'speaker' || cue === 'sneeze') &&
      typeof context.createStereoPanner === 'function'
    ) {
      const placement = context.createStereoPanner();

      placement.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(placement).connect(bus);
    } else gain.connect(bus);

    player.onended = this.trackSample(cue, () => player.stop());
    player.start();
  }

  reset() {
    this.playbackGeneration++;
    this.rolling = false;
    this.activePerformance = undefined;
    this.activeReaction = undefined;
    this.activeMurmur = undefined;
    this.murmurBag.length = 0;

    for (const cue of this.playingSamples.keys()) this.stopSample(cue);

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
