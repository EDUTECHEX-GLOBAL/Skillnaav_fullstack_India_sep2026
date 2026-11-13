import {
  VISEME,
  wordToVisemeCues,
  textToVisemeTimeline,
  alignmentToVisemeTimeline,
  getVisemeAtTime,
  computeFrameViseme,
} from "../visemeEngine";
import {
  cleanForSpeech,
  splitIntoSpeechChunks,
  pickBestVoice,
  AudioSpeechEngine,
} from "../audioSpeechEngine";

describe("Viseme & Phoneme Articulation Engine", () => {
  test("maps key speech phonemes (A, E, I, O, U, M, B, P, F, TH) to distinct realistic visemes", () => {
    expect(wordToVisemeCues("mama")).toContain(VISEME.MBP);
    expect(wordToVisemeCues("mama")).toContain(VISEME.AA);
    expect(wordToVisemeCues("book")).toContain(VISEME.MBP);
    expect(wordToVisemeCues("book")).toContain(VISEME.OO);
    expect(wordToVisemeCues("free")).toContain(VISEME.FV);
    expect(wordToVisemeCues("free")).toContain(VISEME.EE);
    expect(wordToVisemeCues("phone")).toContain(VISEME.FV);
    expect(wordToVisemeCues("open")).toContain(VISEME.OH);
    expect(wordToVisemeCues("play")).toContain(VISEME.AE);
    expect(wordToVisemeCues("think")).toContain(VISEME.TH);

    // Ensure mouth doesn't just use one repetitive shape
    const sentenceTl = textToVisemeTimeline("Build five open AI tools smoothly.", 3.0);
    const uniqueVisemes = new Set(sentenceTl.events.map((e) => e.viseme));
    expect(uniqueVisemes.size).toBeGreaterThanOrEqual(6);
  });

  test("inserts REST pauses at punctuation and returns REST past end of timeline", () => {
    const tl = textToVisemeTimeline("Hello! How are you, today?", 4.0);
    const restEvents = tl.events.filter((e) => e.viseme === VISEME.REST);
    expect(restEvents.length).toBeGreaterThanOrEqual(4);
    expect(getVisemeAtTime(tl, -0.1)).toBe(tl.events[0].viseme);
    expect(getVisemeAtTime(tl, 4.05)).toBe(VISEME.REST);
  });

  test("closes mouth on audio silence even mid-utterance and tracks live audio energy", () => {
    // Fake AnalyserNode outputting silence (128 = 0 amplitude)
    const silentAnalyser = {
      getByteTimeDomainData: (arr) => arr.fill(128),
      getByteFrequencyData: (arr) => arr.fill(0),
    };
    const freqData = new Uint8Array(256);
    const timeData = new Uint8Array(512);
    const tl = textToVisemeTimeline("Artificial intelligence internships", 2.0);

    let state = { primaryViseme: VISEME.AA, secondaryViseme: VISEME.AA, blend: 1, openness: 0.9, energy: 0.9 };
    for (let step = 0; step < 12; step++) {
      state = computeFrameViseme({
        analyser: silentAnalyser,
        freqData,
        timeData,
        timeline: tl,
        elapsedSec: 0.4,
        isSpeaking: true,
        prevState: state,
        dt: 0.016,
      });
    }
    expect(state.secondaryViseme).toBe(VISEME.REST);
    expect(state.energy).toBeLessThan(0.15);

    // Active vocal energy drives non-REST articulation
    const loudAnalyser = {
      getByteTimeDomainData: (arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i % 2 === 0 ? 190 : 66;
      },
      getByteFrequencyData: (arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i < 20 ? 170 : 40;
      },
    };
    let active = state;
    for (let step = 0; step < 8; step++) {
      active = computeFrameViseme({
        analyser: loudAnalyser,
        freqData,
        timeData,
        timeline: tl,
        elapsedSec: 0.25,
        isSpeaking: true,
        prevState: active,
        dt: 0.016,
      });
    }
    expect(active.energy).toBeGreaterThan(0.5);
    expect(active.secondaryViseme).not.toBe(VISEME.REST);

    // Immediate closure when speaking ends
    let ended = active;
    for (let step = 0; step < 15; step++) {
      ended = computeFrameViseme({
        analyser: null,
        freqData: null,
        timeData: null,
        timeline: null,
        elapsedSec: 0,
        isSpeaking: false,
        prevState: ended,
        dt: 0.016,
      });
    }
    expect(ended.primaryViseme).toBe(VISEME.REST);
    expect(ended.energy).toBeLessThan(0.05);
  });
});

describe("Speech Sanitation, Chunking & AudioSpeechEngine Pipeline", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("cleans markdown/emoji and normalizes Edutechex & acronyms cleanly", () => {
    const out = cleanForSpeech("👋 **Welcome** to Edutechex! Check `AI` & B2B CVs at https://edutechex.com for ₹500.");
    expect(out).toBe("Welcome to Edu tech ex! Check A I and B to B C Vs at for 500 rupees.");
  });

  test("splits 2-minute long text (>320 words) smoothly without dropping sentences or breaking abbreviations", () => {
    const sentence =
      "Dr. Sharma explains how Edutechex connects students with verified A.I. internships in 3.5 steps, including CV reviews and interview practice. ";
    const longSpeech = sentence.repeat(18); // ~360 words (~2.5 minutes spoken)
    const chunks = splitIntoSpeechChunks(longSpeech, 260);
    expect(chunks.length).toBeGreaterThanOrEqual(10);
    expect(chunks.every((c) => c.length <= 260)).toBe(true);
    expect(chunks[0]).toContain("Dr. Sharma");
    expect(chunks[0]).toContain("3.5 steps");
  });

  test("reuses singleton AudioContext, schedules consecutive chunks gaplessly, and stops cleanly on interruption", async () => {
    const createdContexts = [];
    const startedSources = [];
    const stoppedSources = [];

    class MockAudioContext {
      constructor() {
        createdContexts.push(this);
        this.state = "running";
        this.currentTime = 1.0;
        this.destination = {};
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        this.state = "closed";
        return Promise.resolve();
      }
      createDynamicsCompressor() {
        return {
          threshold: { value: 0 },
          knee: { value: 0 },
          ratio: { value: 0 },
          attack: { value: 0 },
          release: { value: 0 },
          connect: jest.fn(),
        };
      }
      createGain() {
        return { gain: { value: 1 }, connect: jest.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 512,
          frequencyBinCount: 256,
          smoothingTimeConstant: 0.45,
          connect: jest.fn(),
          getByteTimeDomainData: jest.fn(),
          getByteFrequencyData: jest.fn(),
        };
      }
      decodeAudioData() {
        return Promise.resolve({ duration: 1.5 });
      }
      createBufferSource() {
        const src = {
          buffer: null,
          onended: null,
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn((t) => startedSources.push({ src, t })),
          stop: jest.fn(() => stoppedSources.push(src)),
        };
        return src;
      }
    }

    global.AudioContext = MockAudioContext;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    );

    const engine = new AudioSpeechEngine();
    const onStart = jest.fn();
    const onEnd = jest.fn();

    // Turn 1: two sentences
    await engine.speak("Hello student. Welcome to Edutechex internships today!", {
      ttsUrl: "/api/tts",
      onStart,
      onEnd,
    });

    expect(createdContexts).toHaveLength(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(startedSources).toHaveLength(2);
    // Chunk 2 starts right when Chunk 1 ends (gapless Web Audio timeline!)
    expect(startedSources[1].t).toBeCloseTo(startedSources[0].t + 1.5, 4);

    // Mid-speech user interruption halts active sources immediately without closing singleton AudioContext
    engine.stop();
    expect(stoppedSources.length).toBe(2);
    expect(engine.isSpeaking).toBe(false);
    expect(engine.getPlaybackSnapshot().isSpeaking).toBe(false);

    // Turn 2 reuses exact same AudioContext instance (zero leaks!)
    await engine.speak("Short answer.", { ttsUrl: "/api/tts" });
    expect(createdContexts).toHaveLength(1);

    // Simulate last chunk ending naturally
    const lastSrc = startedSources[startedSources.length - 1].src;
    lastSrc.onended();
    expect(engine.isSpeaking).toBe(false);

    engine.dispose();
  });

  test("recovers gracefully via Web Speech fallback when /api/tts returns 503", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
    );
    const spokenUtterances = [];
    window.speechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ name: "Google UK English Male", lang: "en-GB" }],
      cancel: jest.fn(),
      resume: jest.fn(),
      speak: jest.fn((u) => {
        spokenUtterances.push(u);
        u.onstart?.();
        u.onboundary?.({ charIndex: 0 });
        u.onend?.();
      }),
    };
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };

    const engine = new AudioSpeechEngine();
    const onEnd = jest.fn();
    await engine.speak("Testing offline recovery smoothly.", { ttsUrl: "/api/tts", onEnd });

    expect(spokenUtterances).toHaveLength(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  test("pickBestVoice prioritizes Natural/Google voices over legacy SAPI voices", () => {
    const voices = [
      { name: "Microsoft David Desktop", lang: "en-US" },
      { name: "Microsoft Neerja Online (Natural)", lang: "en-IN" },
      { name: "Google UK English Male", lang: "en-GB" },
    ];
    expect(pickBestVoice(voices).name).toContain("Natural");
  });

  test("scales fast and slow speech timelines proportionally without drift", () => {
    const text = "Edutechex offers verified A.I. internships across leading startups.";
    const slowTl = textToVisemeTimeline(text, 6.0);
    const fastTl = textToVisemeTimeline(text, 2.0);
    expect(slowTl.events[slowTl.events.length - 1].tEnd).toBeCloseTo(6.0, 4);
    expect(fastTl.events[fastTl.events.length - 1].tEnd).toBeCloseTo(2.0, 4);
    expect(slowTl.wordOffsets[1].tStart / fastTl.wordOffsets[1].tStart).toBeCloseTo(3.0, 2);
  });

  test("handles transient network hiccup with automatic retry recovery", async () => {
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject(new Error("Temporary socket reset"));
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });

    class SimpleCtx {
      constructor() {
        this.state = "running";
        this.currentTime = 0;
        this.destination = {};
      }
      resume() { return Promise.resolve(); }
      close() { this.state = "closed"; return Promise.resolve(); }
      createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: jest.fn() }; }
      createGain() { return { gain: { value: 1 }, connect: jest.fn() }; }
      createAnalyser() { return { fftSize: 512, frequencyBinCount: 256, connect: jest.fn() }; }
      decodeAudioData() { return Promise.resolve({ duration: 1.0 }); }
      createBufferSource() {
        return { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
      }
    }
    global.AudioContext = SimpleCtx;

    const engine = new AudioSpeechEngine();
    const onStart = jest.fn();
    await engine.speak("Network recovery test.", { ttsUrl: "/api/tts", onStart });
    expect(calls).toBe(2);
    expect(onStart).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  test("handles multi-chunk HTTP 404 on /api/tts without unhandled rejections and falls back cleanly", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
    );
    const spokenUtterances = [];
    window.speechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [{ name: "Google UK English Male", lang: "en-GB" }],
      cancel: jest.fn(),
      resume: jest.fn(),
      speak: jest.fn((u) => {
        spokenUtterances.push(u);
        u.onstart?.();
        u.onend?.();
      }),
    };
    window.SpeechSynthesisUtterance = function (text) {
      this.text = text;
    };

    const unhandled = [];
    const rejectionListener = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", rejectionListener);

    const engine = new AudioSpeechEngine();
    const onEnd = jest.fn();
    await engine.speak("Welcome to Edutechex! How can I help you today?", {
      ttsUrl: "/api/tts",
      onEnd,
    });

    // Wait a microtask turn so any detached rejection would surface if present
    await Promise.resolve();
    await Promise.resolve();
    process.removeListener("unhandledRejection", rejectionListener);

    expect(unhandled).toHaveLength(0);
    // 2 chunks prefetched once each (no retry on 404), then fallback speaks 2 chunks
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(spokenUtterances).toHaveLength(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  test("smooths jaw/mouth speed organically without robotic inter-word snaps or excessive opening", () => {
    // Connected fluent words without punctuation should coarticulate cleanly (only trailing REST)
    const tl = textToVisemeTimeline("Build real career skills quickly", 2.4);
    const nonTrailingRest = tl.events.slice(0, -1).filter((e) => e.viseme === VISEME.REST);
    expect(nonTrailingRest).toHaveLength(0);

    // Frame-to-frame openness changes must be smoothly damped (never jumping wildly > 0.22/frame)
    let state = { primaryViseme: VISEME.REST, secondaryViseme: VISEME.REST, blend: 1, openness: 0, energy: 0 };
    const deltas = [];
    let maxOpen = 0;
    for (let f = 0; f < 80; f++) {
      const next = computeFrameViseme({
        analyser: null,
        freqData: null,
        timeData: null,
        timeline: tl,
        elapsedSec: f * 0.016,
        isSpeaking: true,
        prevState: state,
        dt: 0.016,
      });
      deltas.push(Math.abs(next.openness - state.openness));
      maxOpen = Math.max(maxOpen, next.openness);
      state = next;
    }
    expect(Math.max(...deltas)).toBeLessThan(0.22);
    expect(maxOpen).toBeGreaterThan(0.25);
    expect(maxOpen).toBeLessThan(0.85);
  });

  test("maps character-level ElevenLabs alignment timestamps and JSON audioBase64 payloads cleanly", async () => {
    const alignment = {
      characters: ["H", "i", ",", " ", " ", "A", "I"],
      character_start_times_seconds: [0.02, 0.09, 0.16, 0.2, 0.36, 0.42, 0.54],
      character_end_times_seconds: [0.09, 0.16, 0.19, 0.25, 0.42, 0.54, 0.7],
    };
    const alignedTl = alignmentToVisemeTimeline(alignment, 0.8);
    expect(alignedTl).not.toBeNull();
    expect(alignedTl.duration).toBeCloseTo(0.78, 2);

    // Gap from 0.19s ("Hi,") to 0.42s ("AI") is 230ms (>140ms) -> REST pause present
    const midPause = getVisemeAtTime(alignedTl, 0.28);
    expect(midPause).toBe(VISEME.REST);

    const activeSpeech = getVisemeAtTime(alignedTl, 0.5);
    expect(activeSpeech).not.toBe(VISEME.REST);

    // Verify JSON { audioBase64, alignment } payload path in AudioSpeechEngine
    const captured = [];
    const createdSources = [];
    const mockCtx = {
      state: "running",
      currentTime: 10,
      destination: {},
      resume: jest.fn(() => Promise.resolve()),
      close: jest.fn(() => Promise.resolve()),
      createDynamicsCompressor: jest.fn(() => ({
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
        connect: jest.fn(),
      })),
      createGain: jest.fn(() => ({
        gain: { value: 1 },
        connect: jest.fn(),
      })),
      createAnalyser: jest.fn(() => ({
        fftSize: 512,
        smoothingTimeConstant: 0.45,
        frequencyBinCount: 256,
        connect: jest.fn(),
        disconnect: jest.fn(),
        getByteTimeDomainData: jest.fn(),
        getByteFrequencyData: jest.fn(),
      })),
      createBufferSource: jest.fn(() => {
        const src = {
          buffer: null,
          playbackRate: { value: 1 },
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn(() => {
            captured.push(engine.scheduledChunks[0]?.timeline);
          }),
          stop: jest.fn(),
          onended: null,
        };
        createdSources.push(src);
        return src;
      }),
      decodeAudioData: jest.fn(() => Promise.resolve({ duration: 0.8 })),
    };
    global.AudioContext = jest.fn(() => mockCtx);
    window.AudioContext = global.AudioContext;
    window.webkitAudioContext = global.AudioContext;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ audioBase64: "AAAA", alignment }),
      })
    );

    const engine = new AudioSpeechEngine();
    const onEnd = jest.fn();
    await engine.speak("Hi, AI", { ttsUrl: "/api/tts", onEnd });

    expect(captured).toHaveLength(1);
    expect(captured[0].events.some((e) => e.viseme === VISEME.REST && e.tStart >= 0.18 && e.tEnd <= 0.43)).toBe(true);
    createdSources[createdSources.length - 1].onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
    engine.dispose();
  });
});
