import { textToVisemeTimeline, alignmentToVisemeTimeline } from "./visemeEngine";

/**
 * Clean markdown, emoji, URLs, and normalize brand/abbreviation pronunciation for clear speech.
 */
export function cleanForSpeech(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE00-\uFE0F]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
    .replace(/^[•\-*]\s+/gm, "")
    .replace(/[*#~]/g, "")
    .replace(/\bEdutechex\b/gi, "Edu tech ex")
    .replace(/\bAI\b/g, "A I")
    .replace(/\bCVs\b/g, "C Vs")
    .replace(/\bCV\b/g, "C V")
    .replace(/\bB2B\b/gi, "B to B")
    .replace(/\bB2C\b/gi, "B to C")
    .replace(/&/g, " and ")
    .replace(/₹\s*(\d+)/g, "$1 rupees")
    .replace(/₹/g, " rupees ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split long answers into natural speech chunks (~<=260 chars) without splitting decimals or abbreviations.
 */
export function splitIntoSpeechChunks(text, maxChars = 260) {
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return [];

  // Protect common abbreviations, initialisms (A.I., U.S.), and decimals from sentence splitting
  const guarded = cleaned
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|e\.g|i\.e|etc|vs)\./gi, "$1<DOT>")
    .replace(/\b([A-Za-z])\.([A-Za-z])\./g, "$1<DOT>$2<DOT>")
    .replace(/(\d)\.(\d)/g, "$1<DOT>$2");

  const rawSentences = guarded
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter(Boolean);

  const chunks = [];
  for (const sent of rawSentences) {
    if (sent.length <= maxChars) {
      chunks.push(sent);
      continue;
    }
    const clauses = sent.split(/(?<=[,;:])\s+/).map((c) => c.trim()).filter(Boolean);
    let buffer = "";
    for (const clause of clauses) {
      if (!buffer) {
        buffer = clause;
      } else if (buffer.length + 1 + clause.length <= maxChars) {
        buffer += " " + clause;
      } else {
        chunks.push(buffer);
        buffer = clause;
      }
    }
    if (buffer) chunks.push(buffer);
  }
  return chunks.filter((c) => c.length > 0);
}

/**
 * Rank browser SpeechSynthesis voices for high clarity when used as fallback.
 */
export function pickBestVoice(voices, preferredName = null) {
  if (!voices || voices.length === 0) return null;
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }

  const scored = voices.map((v) => {
    let score = 0;
    const name = v.name || "";
    const lang = v.lang || "";

    if (/Natural|Online/i.test(name)) score += 100;
    if (name.includes("Google UK English Male")) score += 85;
    else if (name.includes("Google US English")) score += 80;
    else if (name.includes("Google English India") || name.includes("हिन्दी")) score += 75;

    if (lang === "en-IN" || lang === "en_IN") {
      score += 55;
      if (/Prabhat|Ravi|Neerja|Madhav/i.test(name)) score += 20;
    }
    if (lang.startsWith("en")) score += 30;
    if (/David|Mark|Zira/i.test(name) && !/Natural|Online/i.test(name)) score -= 40;
    if (/Male|Guy|George|James|Ryan|Prabhat/i.test(name)) score += 15;
    if (/Female|Zira|Susan|Hazel|Samantha/i.test(name)) score -= 10;

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice || voices[0];
}

/**
 * Unified Web Audio + Gapless Chunked Neural TTS + Web Speech Fallback Engine.
 */
export class AudioSpeechEngine {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.gainNode = null;
    this.analyser = null;
    this.freqData = null;
    this.timeData = null;

    this.turnId = 0;
    this.activeSources = new Set();
    this.activeAbortControllers = new Set();
    this.pendingTimers = new Set();

    // Live playback sync metadata read at 60fps by AvatarCanvas
    this.isSpeaking = false;
    this.activeChunkTimeline = null;
    this.chunkStartAudioTime = 0;
    this.chunkDuration = 0;
    this.scheduledChunks = []; // { startTime, duration, timeline }
    this.fallbackMode = false;
    this.fallbackStartPerf = 0;
    this.fallbackDuration = 0;
    this.fallbackAnchorElapsed = 0;
    this.fallbackAnchorPerf = 0;
    this.serverTtsDisabledUntil = 0;
  }

  /**
   * Ensure a single AudioContext + Compressor + Gain + Analyser graph is ready and unlocked.
   */
  async ensureAudioContext() {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.15;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 1.0;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.45;

      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);

      this.compressor.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (_) {}
    }
    return this.ctx;
  }

  _trackTimer(id) {
    this.pendingTimers.add(id);
    return id;
  }

  _clearTimers() {
    for (const id of this.pendingTimers) clearTimeout(id);
    this.pendingTimers.clear();
  }

  /**
   * Immediately halt all speech audio, pending downloads, scheduled chunks, and fallback utterances.
   */
  stop() {
    this.turnId += 1;
    this._clearTimers();

    for (const ctrl of this.activeAbortControllers) {
      try {
        ctrl.abort();
      } catch (_) {}
    }
    this.activeAbortControllers.clear();

    for (const src of this.activeSources) {
      try {
        src.onended = null;
        src.stop(0);
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources.clear();
    this.scheduledChunks = [];

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.__currentAssistantUtterance = null;
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    this.isSpeaking = false;
    this.fallbackMode = false;
    this.activeChunkTimeline = null;
  }

  dispose() {
    this.stop();
    if (this.ctx && this.ctx.state !== "closed") {
      try {
        this.ctx.close();
      } catch (_) {}
    }
    this.ctx = null;
  }

  /**
   * Fetch and decode one TTS MP3 chunk with single transient-error retry.
   */
  async _fetchAndDecodeChunk(chunkText, { ttsUrl, token, voice, speed }, localTurnId) {
    const attemptFetch = async () => {
      if (this.turnId !== localTurnId) return null;
      const ctrl = new AbortController();
      this.activeAbortControllers.add(ctrl);
      const timeoutId = setTimeout(() => ctrl.abort(), 11000);
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const resp = await fetch(ttsUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: chunkText, voice, speed }),
          signal: ctrl.signal,
        });
        clearTimeout(timeoutId);
        this.activeAbortControllers.delete(ctrl);

        if (!resp.ok) {
          const err = new Error(`TTS HTTP ${resp.status}`);
          err.status = resp.status;
          throw err;
        }
        const contentType = resp.headers?.get?.("content-type") || "";
        let buf;
        let alignment = null;
        if (contentType.includes("application/json")) {
          const payload = await resp.json();
          alignment = payload?.alignment || null;
          const b64 = payload?.audioBase64 || payload?.audio_base64 || "";
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
          buf = bytes.buffer;
        } else {
          buf = await resp.arrayBuffer();
        }
        if (this.turnId !== localTurnId) return null;
        const ctx = await this.ensureAudioContext();
        if (!ctx) throw new Error("No Web Audio context");
        const audioBuffer = await ctx.decodeAudioData(buf);
        return { audioBuffer, alignment };
      } catch (e) {
        clearTimeout(timeoutId);
        this.activeAbortControllers.delete(ctrl);
        throw e;
      }
    };

    try {
      return await attemptFetch();
    } catch (firstErr) {
      if (firstErr?.name === "AbortError" || this.turnId !== localTurnId) return null;
      const status = firstErr?.status;
      if (status === 400 || status === 401 || status === 403 || status === 404 || status === 501 || status === 503) {
        throw firstErr;
      }
      // Single transient network retry after 450ms
      await new Promise((res) => {
        const tid = this._trackTimer(setTimeout(res, 450));
        return tid;
      });
      if (this.turnId !== localTurnId) return null;
      return await attemptFetch();
    }
  }

  /**
   * Speak full answer smoothly with gapless Web Audio chunk pipelining and SpeechSynthesis fallback.
   */
  async speak(text, opts = {}) {
    const {
      ttsUrl = "/api/tts",
      token = "",
      serverVoice = "onyx",
      fallbackVoiceName = "",
      speed = 1.0,
      onStart,
      onChunk,
      onEnd,
      onError,
    } = opts;

    this.stop();
    const localTurnId = this.turnId;
    const chunks = splitIntoSpeechChunks(text);

    if (chunks.length === 0) {
      onEnd?.();
      return;
    }

    const ctx = await this.ensureAudioContext();
    const canTryServer = ctx && Date.now() > this.serverTtsDisabledUntil;

    if (canTryServer) {
      try {
        // Prefetch pipeline: start fetching chunk 0 + chunk 1 concurrently for instant gapless flow.
        // Always catch inside the stored promise so an unselected prefetch never leaks an unhandled rejection.
        const decodedPromises = chunks.map(() => null);
        const startFetch = (idx) => {
          if (idx >= chunks.length || decodedPromises[idx] || this.turnId !== localTurnId) return;
          decodedPromises[idx] = this._fetchAndDecodeChunk(
            chunks[idx],
            { ttsUrl, token, voice: serverVoice, speed },
            localTurnId
          ).then(
            (buffer) => ({ buffer, error: null }),
            (error) => ({ buffer: null, error })
          );
        };

        startFetch(0);
        if (chunks.length > 1) startFetch(1);

        const firstResult = await decodedPromises[0];
        if (this.turnId !== localTurnId) return;
        if (firstResult?.error) throw firstResult.error;
        const firstPayload = firstResult?.buffer;
        const firstBuf = firstPayload?.audioBuffer || firstPayload;
        if (!firstBuf) throw new Error("Empty decoded buffer");

        this.isSpeaking = true;
        this.fallbackMode = false;
        onStart?.();

        let nextStartTime = ctx.currentTime + 0.025;
        let finalScheduledSource = null;
        let allScheduled = false;

        const attachOnEnded = (src) => {
          src.onended = () => {
            this.activeSources.delete(src);
            if (allScheduled && src === finalScheduledSource && this.turnId === localTurnId) {
              this.isSpeaking = false;
              this.scheduledChunks = [];
              this.activeChunkTimeline = null;
              onEnd?.();
            }
          };
        };

        for (let i = 0; i < chunks.length; i++) {
          if (this.turnId !== localTurnId) return;
          // Keep 1-2 chunks pre-decoded ahead of playback
          if (i + 2 < chunks.length) startFetch(i + 2);

          let chunkPayload = firstPayload;
          if (i > 0) {
            const res = await decodedPromises[i];
            if (this.turnId !== localTurnId) return;
            if (res?.error) throw res.error;
            chunkPayload = res?.buffer || null;
          }
          const audioBuffer = chunkPayload?.audioBuffer || chunkPayload;
          if (!audioBuffer) continue;

          const startTime = Math.max(ctx.currentTime + 0.01, nextStartTime);
          const timeline =
            alignmentToVisemeTimeline(chunkPayload?.alignment, audioBuffer.duration) ||
            textToVisemeTimeline(chunks[i], audioBuffer.duration);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.compressor);

          this.activeSources.add(source);
          this.scheduledChunks.push({
            index: i,
            text: chunks[i],
            startTime,
            endTime: startTime + audioBuffer.duration,
            duration: audioBuffer.duration,
            timeline,
          });

          finalScheduledSource = source;
          attachOnEnded(source);
          source.start(startTime);
          onChunk?.(i, chunks[i]);
          nextStartTime = startTime + audioBuffer.duration;
        }

        allScheduled = true;
        if (!finalScheduledSource && this.turnId === localTurnId) {
          this.isSpeaking = false;
          onEnd?.();
        } else if (finalScheduledSource && !this.activeSources.has(finalScheduledSource) && this.turnId === localTurnId) {
          this.isSpeaking = false;
          this.scheduledChunks = [];
          this.activeChunkTimeline = null;
          onEnd?.();
        }
        return;
      } catch (err) {
        if (this.turnId !== localTurnId) return;
        console.warn("[AudioSpeechEngine] Server TTS fallback triggered:", err?.message || err);
        if (
          err?.status === 401 ||
          err?.status === 403 ||
          err?.status === 404 ||
          err?.status === 501 ||
          err?.status === 503
        ) {
          // Back off server retries briefly when endpoint is unavailable/unconfigured
          this.serverTtsDisabledUntil = Date.now() + 60000;
        }
        // Clean up any partial scheduled audio before clean Web Speech fallback
        for (const src of this.activeSources) {
          try {
            src.onended = null;
            src.stop(0);
            src.disconnect();
          } catch (_) {}
        }
        this.activeSources.clear();
        this.scheduledChunks = [];
      }
    }

    // Fallback: Upgraded Web Speech API with boundary-anchored phoneme viseme sync
    this._speakWithWebSpeechFallback(chunks, {
      localTurnId,
      fallbackVoiceName,
      speed,
      onStart,
      onChunk,
      onEnd,
      onError,
    });
  }

  _speakWithWebSpeechFallback(chunks, { localTurnId, fallbackVoiceName, speed, onStart, onChunk, onEnd, onError }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.isSpeaking = false;
      onError?.(new Error("No speech engine available in this browser"));
      return;
    }

    this.fallbackMode = true;
    let startedNotified = false;

    const speakChunkIdx = (idx) => {
      if (this.turnId !== localTurnId) return;
      if (idx >= chunks.length) {
        this.isSpeaking = false;
        this.fallbackMode = false;
        this.activeChunkTimeline = null;
        onEnd?.();
        return;
      }

      const chunkText = chunks[idx];
      // Calibrated speaking rate (~10.5 chars/sec scaled by rate/speed, matched to live en-IN/UK voice timing)
      const speechRate = Math.min(1.4, Math.max(0.75, 0.96 * speed));
      const estDuration = Math.max(0.6, chunkText.length / (10.5 * speechRate));
      const timeline = textToVisemeTimeline(chunkText, estDuration);

      const utt = new SpeechSynthesisUtterance(chunkText);
      window.__currentAssistantUtterance = utt;
      utt.rate = speechRate;
      utt.pitch = 1.0;
      utt.volume = 1.0;

      const voices = window.speechSynthesis.getVoices() || [];
      const chosen = pickBestVoice(voices, fallbackVoiceName);
      if (chosen) utt.voice = chosen;

      utt.onstart = () => {
        if (this.turnId !== localTurnId) return;
        const now = performance.now();
        this.isSpeaking = true;
        this.activeChunkTimeline = timeline;
        this.fallbackDuration = estDuration;
        this.fallbackAnchorPerf = now;
        this.fallbackAnchorElapsed = 0;
        if (!startedNotified) {
          startedNotified = true;
          onStart?.();
        }
        onChunk?.(idx, chunkText);
      };

      utt.onboundary = (e) => {
        if (this.turnId !== localTurnId) return;
        if (typeof e.charIndex === "number" && timeline.wordOffsets.length > 0) {
          let matched = timeline.wordOffsets[0];
          for (const wo of timeline.wordOffsets) {
            if (wo.charIndex <= e.charIndex) matched = wo;
            else break;
          }
          const nowPerf = performance.now();
          const projected =
            this.fallbackAnchorElapsed + Math.max(0, (nowPerf - this.fallbackAnchorPerf) / 1000);
          const targetElapsed = matched.tStart;
          const drift = Math.abs(targetElapsed - projected);
          this.fallbackAnchorElapsed =
            drift > 0.22 ? targetElapsed : projected * 0.4 + targetElapsed * 0.6;
          this.fallbackAnchorPerf = nowPerf;
        }
      };

      utt.onend = () => {
        if (this.turnId !== localTurnId) return;
        speakChunkIdx(idx + 1);
      };

      utt.onerror = (e) => {
        if (this.turnId !== localTurnId) return;
        if (e.error === "interrupted" || e.error === "canceled") return;
        console.warn("[AudioSpeechEngine] WebSpeech chunk notice:", e.error);
        speakChunkIdx(idx + 1);
      };

      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(utt);
      } catch (err) {
        if (this.turnId === localTurnId) {
          this.isSpeaking = false;
          this.fallbackMode = false;
          onError?.(err);
        }
      }
    };

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      this._trackTimer(setTimeout(() => speakChunkIdx(0), 60));
    } else {
      speakChunkIdx(0);
    }
  }

  /**
   * 60fps timeline + Web Audio Analyser snapshot consumed by AvatarCanvas.
   */
  getPlaybackSnapshot() {
    if (!this.isSpeaking) {
      return {
        isSpeaking: false,
        analyser: null,
        freqData: null,
        timeData: null,
        timeline: null,
        elapsedSec: 0,
      };
    }

    if (this.fallbackMode) {
      const elapsedSec =
        this.fallbackAnchorElapsed + Math.max(0, (performance.now() - this.fallbackAnchorPerf) / 1000);
      return {
        isSpeaking: true,
        analyser: null,
        freqData: null,
        timeData: null,
        timeline: this.activeChunkTimeline,
        elapsedSec,
      };
    }

    const nowAudio = this.ctx ? this.ctx.currentTime : 0;
    let activeChunk = null;
    for (const c of this.scheduledChunks) {
      if (nowAudio >= c.startTime - 0.02 && nowAudio <= c.endTime + 0.03) {
        activeChunk = c;
        break;
      }
    }

    if (!activeChunk && this.scheduledChunks.length > 0) {
      // Between pre-buffered chunks or slightly before chunk 0 starts
      const upcoming = this.scheduledChunks.find((c) => nowAudio < c.startTime);
      if (upcoming) activeChunk = upcoming;
    }

    return {
      isSpeaking: true,
      analyser: this.analyser,
      freqData: this.freqData,
      timeData: this.timeData,
      timeline: activeChunk ? activeChunk.timeline : null,
      elapsedSec: activeChunk ? Math.max(0, nowAudio - activeChunk.startTime) : 0,
    };
  }
}
