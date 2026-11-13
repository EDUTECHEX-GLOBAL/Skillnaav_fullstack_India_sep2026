/**
 * Phoneme-to-Viseme mapping and real-time audio-driven articulation engine.
 * Slot indices align 1:1 with assets/avatar-rig/viseme_sprites.png.
 */

export const VISEME = Object.freeze({
  REST: 0, // Calm relaxed closed smile
  MBP: 1,  // Pressed bilabial lips (M, B, P)
  FV: 2,   // Labiodental upper teeth on lower lip (F, V)
  TH: 3,   // Dental / sibilant / liquid (TH, SH, CH, S, Z, L, R)
  EH: 4,   // Mid-open front/neutral vowel & alveolars (E, I, UH, T, D, N, K, G)
  AA: 5,   // Open jaw vowel (A, AH, AW)
  AE: 6,   // Wide bright open vowel (AY, AI, wide A)
  OH: 7,   // Rounded open vowel (O, AO, OY)
  OO: 8,   // Tight pursed rounded lips (OO, U, W, Q)
  EE: 9,   // Wide horizontal teeth (EE, EA, IY)
});

// Relative articulatory duration weights for smooth natural syllable timing
const VISEME_WEIGHT = {
  [VISEME.REST]: 1.0,
  [VISEME.MBP]: 0.85,
  [VISEME.FV]: 0.92,
  [VISEME.TH]: 0.95,
  [VISEME.EH]: 1.15,
  [VISEME.AA]: 1.48,
  [VISEME.AE]: 1.42,
  [VISEME.OH]: 1.38,
  [VISEME.OO]: 1.32,
  [VISEME.EE]: 1.28,
};

const OPENNESS_BY_VISEME = {
  [VISEME.REST]: 0.0,
  [VISEME.MBP]: 0.03,
  [VISEME.FV]: 0.20,
  [VISEME.TH]: 0.28,
  [VISEME.EH]: 0.36,
  [VISEME.AA]: 0.64,
  [VISEME.AE]: 0.60,
  [VISEME.OH]: 0.54,
  [VISEME.OO]: 0.44,
  [VISEME.EE]: 0.38,
};

/**
 * Convert a single normalized English word into a sequence of viseme cues with weights.
 */
export function wordToVisemeCues(rawWord) {
  const word = String(rawWord || "").toLowerCase().replace(/[^a-z']/g, "");
  if (!word) return [];

  const cues = [];
  let i = 0;

  while (i < word.length) {
    const two = word.slice(i, i + 2);
    const three = word.slice(i, i + 3);
    const ch = word[i];

    // Trigraphs (emit single clear syllable posture, never choppy double-jumps)
    if (three === "igh" || three === "air" || three === "are") {
      cues.push(VISEME.AE);
      i += 3;
      continue;
    }
    if (three === "ear" || three === "eer" || three === "ing") {
      cues.push(VISEME.EE);
      i += 3;
      continue;
    }

    // Digraphs (emit single smooth primary posture per syllable cluster)
    if (two === "ph") {
      cues.push(VISEME.FV);
      i += 2;
      continue;
    }
    if (two === "th" || two === "sh" || two === "ch" || two === "zh") {
      cues.push(VISEME.TH);
      i += 2;
      continue;
    }
    if (two === "qu" || two === "oo" || two === "ew" || two === "ue" || two === "ui" || two === "wh") {
      cues.push(VISEME.OO);
      i += 2;
      continue;
    }
    if (two === "ee" || two === "ea" || two === "ie") {
      cues.push(VISEME.EE);
      i += 2;
      continue;
    }
    if (two === "ai" || two === "ay" || two === "ey") {
      cues.push(VISEME.AE);
      i += 2;
      continue;
    }
    if (two === "ou" || two === "ow" || two === "oa" || two === "oi" || two === "oy") {
      cues.push(two === "ou" || two === "ow" ? VISEME.OO : VISEME.OH);
      i += 2;
      continue;
    }
    if (two === "au" || two === "aw") {
      cues.push(VISEME.AA);
      i += 2;
      continue;
    }
    if (two === "er" || two === "ir" || two === "ur") {
      cues.push(VISEME.EH);
      i += 2;
      continue;
    }

    // Skip silent trailing 'e' on multi-syllable words (except short "be/he/me/we/the")
    if (ch === "e" && i === word.length - 1 && word.length > 3) {
      i += 1;
      continue;
    }

    // Skip glide 'y' directly before vowel (e.g. "you", "your", "yes") so 1-syllable words hold 1 crisp shape
    if (ch === "y" && i === 0 && word[1] && "aeiou".includes(word[1])) {
      i += 1;
      continue;
    }

    // Single graphemes: track syllable nuclei + clear labials (~3-4 smooth strokes/sec)
    const prevCue = cues.length > 0 ? cues[cues.length - 1] : null;
    if ((ch === "m" || ch === "b" || ch === "p") && (i === 0 || prevCue !== VISEME.MBP)) {
      if (i === 0 || (prevCue !== VISEME.FV && prevCue !== VISEME.TH && cues.length < 2)) {
        cues.push(VISEME.MBP);
      }
    } else if (ch === "f" || ch === "v") {
      cues.push(VISEME.FV);
    } else if (ch === "w") {
      cues.push(VISEME.OO);
    } else if (ch === "u") {
      cues.push(i === 0 ? VISEME.EH : VISEME.OO);
    } else if (ch === "o") {
      cues.push(VISEME.OH);
    } else if (ch === "a") {
      cues.push(VISEME.AA);
    } else if (ch === "e") {
      cues.push(word.length <= 2 ? VISEME.EE : VISEME.EH);
    } else if (ch === "i" || ch === "y") {
      cues.push(i === word.length - 1 ? VISEME.EE : VISEME.EH);
    } else if ((ch === "s" || ch === "z" || ch === "l" || ch === "r") && i === 0 && cues.length === 0) {
      cues.push(VISEME.TH);
    }

    i += 1;
  }

  // Collapse identical consecutive visemes and cap shapes per word so mouth glides slowly & clearly
  const compact = [];
  for (const v of cues) {
    if (compact.length === 0 || compact[compact.length - 1] !== v) {
      compact.push(v);
    }
  }
  const maxCues = word.length <= 4 ? 2 : 3;
  if (compact.length > maxCues) {
    if (maxCues === 2) return [compact[0], compact[compact.length - 1]];
    return [compact[0], compact[Math.floor(compact.length / 2)], compact[compact.length - 1]];
  }
  return compact.length > 0 ? compact : [VISEME.EH];
}

/**
 * Build a timed viseme sequence over [0, totalDurationSec] including punctuation pauses.
 */
export function textToVisemeTimeline(text, totalDurationSec = 1.0) {
  const safeDuration = Math.max(0.15, Number(totalDurationSec) || 1.0);
  const tokens = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      duration: safeDuration,
      events: [{ tStart: 0, tEnd: safeDuration, viseme: VISEME.REST, wordIndex: -1 }],
      wordOffsets: [],
    };
  }

  const rawUnits = [];
  const wordCharMap = [];
  let charCursor = 0;

  tokens.forEach((tok, wordIndex) => {
    const wordCues = wordToVisemeCues(tok);
    const startUnitIdx = rawUnits.length;

    wordCues.forEach((v) => {
      rawUnits.push({
        viseme: v,
        weight: VISEME_WEIGHT[v] || 1.0,
        wordIndex,
      });
    });

    // Real punctuation breath pauses only (avoid robotic open-close-open snapping between connected words)
    const trailingPunct = tok.match(/([.!?,;:]+)$/)?.[1] || "";
    if (/[.!?]/.test(trailingPunct)) {
      rawUnits.push({ viseme: VISEME.REST, weight: 3.2, wordIndex });
    } else if (/[,;:]/.test(trailingPunct)) {
      rawUnits.push({ viseme: VISEME.REST, weight: 1.75, wordIndex });
    }

    wordCharMap.push({
      wordIndex,
      charIndex: charCursor,
      startUnitIdx,
      endUnitIdx: rawUnits.length - 1,
    });
    charCursor += tok.length + 1;
  });

  // Trailing rest closure
  rawUnits.push({ viseme: VISEME.REST, weight: 0.9, wordIndex: tokens.length - 1 });

  const totalWeight = rawUnits.reduce((acc, u) => acc + u.weight, 0) || 1;
  const events = [];
  let t = 0;
  for (const unit of rawUnits) {
    const dt = (unit.weight / totalWeight) * safeDuration;
    events.push({
      tStart: t,
      tEnd: t + dt,
      viseme: unit.viseme,
      wordIndex: unit.wordIndex,
    });
    t += dt;
  }

  // Record expected timestamp of each word start for SpeechSynthesis boundary resync
  const wordOffsets = wordCharMap.map((m) => ({
    charIndex: m.charIndex,
    tStart: events[m.startUnitIdx]?.tStart ?? 0,
  }));

  return { duration: safeDuration, events, wordOffsets };
}

/**
 * Build a timed viseme sequence directly from character-level alignment timestamps
 * (compatible with ElevenLabs character_start_times_seconds / character_end_times_seconds).
 * Falls back cleanly to textToVisemeTimeline if alignment data is empty.
 */
export function alignmentToVisemeTimeline(alignment, fallbackDurationSec = 1.0) {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;

  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends) || chars.length === 0) {
    return null;
  }

  const count = Math.min(chars.length, starts.length, ends.length);
  const fullText = chars.slice(0, count).join("");
  const lastEnd = Math.max(0.15, Number(ends[count - 1]) || fallbackDurationSec || 1.0);

  // Extract word spans [startCharIdx, endCharIdx] mapped to actual audio start/end timestamps
  const events = [];
  const wordOffsets = [];
  let cursor = 0;
  let wordIndex = 0;

  while (cursor < count) {
    while (cursor < count && /\s/.test(chars[cursor])) cursor += 1;
    if (cursor >= count) break;

    const wStartIdx = cursor;
    while (cursor < count && !/\s/.test(chars[cursor])) cursor += 1;
    const wEndIdx = cursor - 1;

    const rawWord = fullText.slice(wStartIdx, wEndIdx + 1);
    const tWordStart = Number(starts[wStartIdx]) || 0;
    const tWordEnd = Math.max(tWordStart + 0.06, Number(ends[wEndIdx]) || tWordStart + 0.12);

    wordOffsets.push({ charIndex: wStartIdx, tStart: tWordStart });

    const cues = wordToVisemeCues(rawWord);
    const weights = cues.map((v) => VISEME_WEIGHT[v] || 1.0);
    const sumW = weights.reduce((a, b) => a + b, 0) || 1;
    let t = tWordStart;
    const wordDur = tWordEnd - tWordStart;

    for (let j = 0; j < cues.length; j++) {
      const dt = (weights[j] / sumW) * wordDur;
      events.push({ tStart: t, tEnd: t + dt, viseme: cues[j], wordIndex });
      t += dt;
    }

    // Insert real REST closure for silence gap after word if gap > 140ms or trailing punctuation
    let peek = cursor;
    while (peek < count && /\s/.test(chars[peek])) peek += 1;
    const nextStart = peek < count ? Number(starts[peek]) : lastEnd;
    if (nextStart - tWordEnd > 0.14 || /[.!?,;:]$/.test(rawWord)) {
      events.push({
        tStart: tWordEnd,
        tEnd: Math.max(tWordEnd + 0.05, nextStart),
        viseme: VISEME.REST,
        wordIndex,
      });
    }
    wordIndex += 1;
  }

  if (events.length === 0) {
    return textToVisemeTimeline(fullText, lastEnd);
  }

  const finalEnd = Math.max(lastEnd, events[events.length - 1].tEnd);
  events.push({ tStart: finalEnd, tEnd: finalEnd + 0.08, viseme: VISEME.REST, wordIndex });
  return { duration: finalEnd + 0.08, events, wordOffsets };
}

/**
 * Binary-search lookup of active viseme at elapsedSec.
 */
export function getVisemeAtTime(timeline, elapsedSec) {
  if (!timeline || !timeline.events || timeline.events.length === 0) {
    return VISEME.REST;
  }
  const events = timeline.events;
  if (elapsedSec <= 0) return events[0].viseme;
  if (elapsedSec >= timeline.duration) return VISEME.REST;

  let lo = 0;
  let hi = events.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ev = events[mid];
    if (elapsedSec < ev.tStart) {
      hi = mid - 1;
    } else if (elapsedSec >= ev.tEnd) {
      lo = mid + 1;
    } else {
      return ev.viseme;
    }
  }
  return VISEME.REST;
}

/**
 * Sample live Web Audio AnalyserNode to extract RMS energy and vowel/fricative band energies.
 */
export function sampleAnalyserMetrics(analyser, freqData, timeData) {
  if (!analyser || !freqData || !timeData) {
    return { rms: 0, lowVowel: 0, midVowel: 0, highFric: 0 };
  }
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const norm = (timeData[i] - 128) / 128;
    sumSq += norm * norm;
  }
  const rms = Math.sqrt(sumSq / timeData.length);

  // Typical 48kHz / 512 fftSize -> ~93.75 Hz per bin
  // Bin 2..9 (~187-850 Hz): fundamental + F1 vowels (AA, OH, OO)
  // Bin 9..26 (~850-2450 Hz): F2 clarity (EH, EE, AE)
  // Bin 27..68 (~2500-6400 Hz): fricatives & sibilants (FV, TH, S)
  const avgBand = (start, end) => {
    const hi = Math.min(end, freqData.length);
    if (hi <= start) return 0;
    let total = 0;
    for (let i = start; i < hi; i++) total += freqData[i];
    return total / ((hi - start) * 255);
  };

  return {
    rms,
    lowVowel: avgBand(2, 9),
    midVowel: avgBand(9, 26),
    highFric: avgBand(27, 68),
  };
}

function isClosedViseme(v) {
  return v === VISEME.REST || v === VISEME.MBP || v === VISEME.FV;
}

function isWideOpenViseme(v) {
  return (
    v === VISEME.TH ||
    v === VISEME.AA ||
    v === VISEME.AE ||
    v === VISEME.OH ||
    v === VISEME.EE
  );
}

/**
 * Step between closed and wide-open shapes via an anatomical half-open posture (EH / OO)
 * so lips smoothly part and close without snapping or double-exposing closed lips over teeth.
 */
function resolveNextVisemeStep(current, target) {
  if (isClosedViseme(current) && isWideOpenViseme(target)) {
    return {
      next: target === VISEME.OH ? VISEME.OO : VISEME.EH,
      isBridge: true,
    };
  }
  if (isWideOpenViseme(current) && isClosedViseme(target)) {
    return {
      next: current === VISEME.OH ? VISEME.OO : VISEME.EH,
      isBridge: true,
    };
  }
  return { next: target, isBridge: false };
}

/**
 * Fuse timeline phoneme cue with live Web Audio energy & spectrum at 60fps.
 * Falls back cleanly when analyser is absent (e.g. Web Speech fallback with known elapsed time).
 */
export function computeFrameViseme({
  analyser,
  freqData,
  timeData,
  timeline,
  elapsedSec,
  isSpeaking,
  prevState,
  dt,
}) {
  const safeDt = Math.min(0.05, Math.max(0.004, dt || 0.016));

  if (!isSpeaking) {
    const closeAlpha = 1 - Math.exp(-safeDt / 0.065);
    const energy = prevState.energy * (1 - closeAlpha);
    const blend = prevState.blend * (1 - closeAlpha);
    return {
      primaryViseme: energy < 0.04 ? VISEME.REST : prevState.primaryViseme,
      secondaryViseme: VISEME.REST,
      blend: energy < 0.04 ? 0 : blend,
      openness: prevState.openness * (1 - closeAlpha),
      energy,
      holdSec: 0,
    };
  }

  const timelineViseme = getVisemeAtTime(timeline, elapsedSec);
  let targetViseme = timelineViseme;
  let targetEnergy = 0.68;

  if (analyser && freqData && timeData) {
    const { rms, lowVowel, midVowel, highFric } = sampleAnalyserMetrics(analyser, freqData, timeData);
    // Boost dynamic vocal range cleanly into [0..1]
    const rawEnergy = Math.min(1.0, Math.max(0.0, (rms - 0.012) / 0.14));

    if (rawEnergy < 0.06) {
      // Actual audio pause/silence between words/clauses -> keep mouth cleanly closed!
      targetViseme = VISEME.REST;
      targetEnergy = 0.0;
    } else {
      targetEnergy = Math.min(1.0, rawEnergy * 0.8 + lowVowel * 0.25 + midVowel * 0.2);

      // Audio-reactive phoneme refinement:
      if (targetViseme === VISEME.REST) {
        // Timeline thinks it's a brief gap, but live audio still has energy -> shape from spectrum
        if (highFric > lowVowel * 1.15 && highFric > 0.18) {
          targetViseme = VISEME.TH;
        } else if (lowVowel > 0.36 && targetEnergy > 0.58) {
          targetViseme = VISEME.AA;
        } else if (midVowel > lowVowel * 1.15) {
          targetViseme = VISEME.EE;
        } else {
          targetViseme = VISEME.EH;
        }
      } else if (targetViseme === VISEME.AA && targetEnergy < 0.36) {
        targetViseme = VISEME.EH;
      } else if (targetViseme === VISEME.EH && targetEnergy > 0.72 && lowVowel > 0.35) {
        targetViseme = VISEME.AA;
      }
    }
  } else {
    // Web Speech API fallback (no AudioContext analyser stream available):
    // Timeline itself runs off real utterance elapsed clock + onboundary word resync.
    targetEnergy = timelineViseme === VISEME.REST ? 0.0 : (OPENNESS_BY_VISEME[timelineViseme] ?? 0.58);
  }

  // Anatomical progressive stepping (Closed <-> Half-Open <-> Wide-Open) + crisp 36ms crossfade
  // so lips part & close naturally without sudden 1-frame snaps or double-teeth ghosting
  let primary = prevState.primaryViseme;
  let secondary = prevState.secondaryViseme;
  let blend = prevState.blend;
  let holdSec = (prevState.holdSec || 0) + safeDt;
  const minHold = prevState.isBridge ? 0.048 : 0.085;

  const canSwitch =
    holdSec >= minHold ||
    (targetViseme === VISEME.REST && !prevState.isBridge);

  let isBridge = Boolean(prevState.isBridge);
  if (targetViseme !== secondary && canSwitch) {
    const step = resolveNextVisemeStep(secondary, targetViseme);
    if (step.next !== secondary) {
      if (blend > 0.45) {
        primary = secondary;
        blend = 0.08;
      } else {
        blend = Math.max(0.0, blend * 0.25);
      }
      secondary = step.next;
      isBridge = step.isBridge;
      holdSec = 0;
    } else {
      isBridge = false;
    }
  } else if (targetViseme === secondary) {
    isBridge = false;
  }

  const tau = secondary === VISEME.REST ? 0.045 : 0.036;
  const alpha = 1 - Math.exp(-safeDt / tau);
  blend = Math.min(1.0, blend + alpha * (1 - blend));
  if (blend >= 0.985) {
    primary = secondary;
    blend = 1.0;
  }

  const eTau =
    targetEnergy === 0
      ? 0.082
      : targetEnergy > prevState.energy
        ? 0.065
        : 0.085;
  const eAlpha = 1 - Math.exp(-safeDt / eTau);
  const energy = prevState.energy + (targetEnergy - prevState.energy) * eAlpha;
  const activeShape = blend >= 0.45 ? secondary : primary;
  const targetOpen = OPENNESS_BY_VISEME[activeShape] ?? 0.0;
  const dampedOpen = activeShape === VISEME.REST ? 0.0 : targetOpen * Math.min(1.0, 0.45 + energy * 0.65);
  const openness = prevState.openness + (dampedOpen - prevState.openness) * eAlpha;

  return {
    primaryViseme: primary,
    secondaryViseme: secondary,
    blend,
    openness,
    energy,
    holdSec,
    isBridge,
  };
}

