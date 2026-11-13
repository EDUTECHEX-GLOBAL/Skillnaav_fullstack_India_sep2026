import React, { useEffect, useRef, useState } from "react";
import torsoBgImg from "../assets/avatar-rig/torso_bg.jpg";
import torsoFgImg from "../assets/avatar-rig/torso_fg.png";
import headBaseImg from "../assets/avatar-rig/head_base.png";
import eyeIrisesImg from "../assets/avatar-rig/eye_irises.png";
import eyeClosedLidsImg from "../assets/avatar-rig/eye_closed_lids.png";
import visemeSpritesImg from "../assets/avatar-rig/viseme_sprites.png";
import { VISEME, computeFrameViseme } from "../utils/visemeEngine";

export const AVATAR_STATE = Object.freeze({
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
  INTERRUPTED: "interrupted",
  ERROR: "error",
});

// Source rig world layout (1280x720)
const WORLD_W = 1280;
const WORLD_H = 720;
const TORSO_FG_X = 300;
const TORSO_FG_Y = 380;
const TORSO_PIVOT_X = 640;
const TORSO_PIVOT_Y = 720;
const HEAD_X = 430;
const HEAD_Y = 20;
const NECK_PIVOT_X = 640;
const NECK_PIVOT_Y = 442;

// Exact aligned eye & iris world coordinates (derived directly from head_base 420x440)
const EYE_LIDS_X = HEAD_X + 80;
const EYE_LIDS_Y = HEAD_Y + 166;
const EYE_LIDS_W = 260;
const EYE_LIDS_H = 122;

const IRIS_SLOT_SIZE = 60;
const LEFT_IRIS_CX = HEAD_X + 158.78;
const LEFT_IRIS_CY = HEAD_Y + 236.42;
const RIGHT_IRIS_CX = HEAD_X + 262.43;
const RIGHT_IRIS_CY = HEAD_Y + 240.83;

// Eye socket aperture polygons (head_base local coords translated to world)
const LEFT_EYE_POLY = [
  [HEAD_X + 128, HEAD_Y + 240],
  [HEAD_X + 132, HEAD_Y + 229],
  [HEAD_X + 144, HEAD_Y + 222],
  [HEAD_X + 160, HEAD_Y + 221],
  [HEAD_X + 176, HEAD_Y + 224],
  [HEAD_X + 188, HEAD_Y + 233],
  [HEAD_X + 191, HEAD_Y + 242],
  [HEAD_X + 185, HEAD_Y + 250],
  [HEAD_X + 172, HEAD_Y + 255],
  [HEAD_X + 156, HEAD_Y + 256],
  [HEAD_X + 140, HEAD_Y + 252],
  [HEAD_X + 131, HEAD_Y + 246],
];

const RIGHT_EYE_POLY = [
  [HEAD_X + 229, HEAD_Y + 244],
  [HEAD_X + 234, HEAD_Y + 234],
  [HEAD_X + 246, HEAD_Y + 226],
  [HEAD_X + 263, HEAD_Y + 224],
  [HEAD_X + 280, HEAD_Y + 227],
  [HEAD_X + 291, HEAD_Y + 235],
  [HEAD_X + 294, HEAD_Y + 244],
  [HEAD_X + 288, HEAD_Y + 252],
  [HEAD_X + 276, HEAD_Y + 258],
  [HEAD_X + 259, HEAD_Y + 259],
  [HEAD_X + 242, HEAD_Y + 255],
  [HEAD_X + 233, HEAD_Y + 249],
];

const LEFT_LID_POLY = [
  [HEAD_X + 126, HEAD_Y + 244],
  [HEAD_X + 130, HEAD_Y + 228],
  [HEAD_X + 142, HEAD_Y + 221],
  [HEAD_X + 160, HEAD_Y + 220],
  [HEAD_X + 178, HEAD_Y + 223],
  [HEAD_X + 190, HEAD_Y + 232],
  [HEAD_X + 193, HEAD_Y + 246],
  [HEAD_X + 187, HEAD_Y + 254],
  [HEAD_X + 174, HEAD_Y + 259],
  [HEAD_X + 156, HEAD_Y + 260],
  [HEAD_X + 138, HEAD_Y + 256],
  [HEAD_X + 129, HEAD_Y + 250],
];

const RIGHT_LID_POLY = [
  [HEAD_X + 227, HEAD_Y + 248],
  [HEAD_X + 232, HEAD_Y + 233],
  [HEAD_X + 244, HEAD_Y + 225],
  [HEAD_X + 263, HEAD_Y + 223],
  [HEAD_X + 282, HEAD_Y + 226],
  [HEAD_X + 293, HEAD_Y + 234],
  [HEAD_X + 296, HEAD_Y + 248],
  [HEAD_X + 290, HEAD_Y + 256],
  [HEAD_X + 278, HEAD_Y + 262],
  [HEAD_X + 259, HEAD_Y + 263],
  [HEAD_X + 240, HEAD_Y + 259],
  [HEAD_X + 231, HEAD_Y + 253],
];

const EYE_CONFIGS = [
  {
    eyePoly: LEFT_EYE_POLY,
    lidPoly: LEFT_LID_POLY,
    cx: LEFT_IRIS_CX,
    cy: LEFT_IRIS_CY,
    slotX: 0,
    topY: HEAD_Y + 220,
    lashRestY: HEAD_Y + 251,
    midX: HEAD_X + 160,
    rx: 33,
  },
  {
    eyePoly: RIGHT_EYE_POLY,
    lidPoly: RIGHT_LID_POLY,
    cx: RIGHT_IRIS_CX,
    cy: RIGHT_IRIS_CY,
    slotX: IRIS_SLOT_SIZE,
    topY: HEAD_Y + 223,
    lashRestY: HEAD_Y + 252,
    midX: HEAD_X + 262,
    rx: 34,
  },
];

const VISEME_X = 552;
const VISEME_Y = 306;
const VISEME_SLOT_W = 176;
const VISEME_SLOT_H = 108;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch (_) {}
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function nextBlinkIntervalMs(state) {
  const base = state === AVATAR_STATE.THINKING ? 3200 : 2400;
  const spread = state === AVATAR_STATE.LISTENING ? 3100 : 3800;
  return base + Math.pow(Math.random(), 1.35) * spread;
}

function nextNodIntervalMs(state) {
  if (state === AVATAR_STATE.SPEAKING) return 2400 + Math.random() * 2900;
  if (state === AVATAR_STATE.LISTENING) return 3200 + Math.random() * 3400;
  return 5800 + Math.random() * 4500;
}

/**
 * Natural human chest breath curve (~4.4s cycle):
 * inhale -> brief crest hold -> soft exhale -> resting pause before next breath.
 */
function sampleHumanBreath(timeSec) {
  const warped = timeSec + 0.22 * Math.sin(timeSec * 0.43);
  const period = 4.4;
  const phase = ((warped % period) + period) % period / period;
  if (phase < 0.34) {
    const u = phase / 0.34;
    return 0.5 - 0.5 * Math.cos(Math.PI * u);
  }
  if (phase < 0.41) {
    return 1.0 - 0.04 * ((phase - 0.34) / 0.07);
  }
  if (phase < 0.79) {
    const u = (phase - 0.41) / 0.38;
    return 0.96 * (0.5 + 0.5 * Math.cos(Math.PI * u));
  }
  return 0;
}

function clipPolygonPath(ctx, points) {
  if (!ctx.beginPath || !ctx.moveTo || !ctx.lineTo || !ctx.closePath || !ctx.clip) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.clip();
}

function clipLidCurtain(ctx, lidPoly, midX, rx, topY, currLashY, blinkAmount) {
  if (!ctx.beginPath || !ctx.moveTo || !ctx.lineTo || !ctx.closePath || !ctx.clip) return;
  ctx.beginPath();
  const minX = midX - rx - 4;
  const maxX = midX + rx + 4;
  ctx.moveTo(minX, topY - 12);
  ctx.lineTo(maxX, topY - 12);
  for (let sx = maxX; sx >= minX; sx -= 4) {
    const u = (sx - midX) / rx;
    const arch = (1 - Math.min(1, u * u)) * 3.5 * (1 - blinkAmount);
    ctx.lineTo(sx, currLashY + 2 + arch);
  }
  ctx.closePath();
  ctx.clip();
}

/**
 * 60fps Canvas Avatar Rig with single unified animation loop, strictly two
 * non-duplicated eyes with natural gaze + 3D eyelid blinking, smooth audio-driven
 * phoneme visemes, and coordinated jaw/lip/cheek/head expression.
 */
export default function AvatarCanvas({ avatarState = AVATAR_STATE.IDLE, audioEngineRef, isVisible = true }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [assetsReady, setAssetsReady] = useState(false);

  const stateRef = useRef(avatarState);
  stateRef.current = avatarState;

  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;

  const imagesRef = useRef(null);

  const animRef = useRef({
    viseme: {
      primaryViseme: VISEME.REST,
      secondaryViseme: VISEME.REST,
      blend: 1,
      openness: 0,
      energy: 0,
      holdSec: 0,
    },
    blink: {
      active: false,
      elapsedMs: 0,
      durationMs: 205,
      nextDelayMs: 2800,
      pendingDouble: false,
    },
    gaze: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      nextSaccadeMs: 2600,
    },
    pose: {
      tiltDeg: 0,
      driftX: 0,
      driftY: 0,
      scale: 1,
    },
    torso: {
      breathLiftY: 0,
      shoulderSpreadX: 1,
      chestScaleY: 1,
      leanX: 0,
      tiltDeg: 0,
    },
    nod: {
      active: false,
      elapsedMs: 0,
      durationMs: 520,
      amplitudeDeg: 0,
      amplitudeY: 0,
      nextDelayMs: 3600,
    },
    clockSec: 0,
  });

  // Load 6 single-layer aligned textures once on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadImage(torsoBgImg),
      loadImage(torsoFgImg),
      loadImage(headBaseImg),
      loadImage(eyeIrisesImg),
      loadImage(eyeClosedLidsImg),
      loadImage(visemeSpritesImg),
    ])
      .then(([torso, torsoFg, head, irises, closedLids, visemes]) => {
        if (cancelled) return;
        imagesRef.current = { torso, torsoFg, head, irises, closedLids, visemes };
        setAssetsReady(true);
      })
      .catch((err) => {
        console.error("[AvatarCanvas] Failed to load rig sprites:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ResizeObserver maintains HiDPI sharpness across collapsed / expanded / fullscreen cards
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    window.addEventListener("resize", syncSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  // Single unified 60fps animation & compositing loop
  useEffect(() => {
    if (!assetsReady) return;
    let rafId = null;
    let lastPerf = performance.now();

    const drawEyesAndBlinks = (ctx, imgs, gazeX, gazeY, blinkAmount) => {
      const clampX = Math.max(-3.0, Math.min(3.0, gazeX));
      const clampY = Math.max(-1.8, Math.min(1.8, gazeY));

      for (const eye of EYE_CONFIGS) {
        // 1. Draw single iris strictly clipped inside eye socket aperture (never leaves eyeball)
        ctx.save();
        clipPolygonPath(ctx, eye.eyePoly);
        ctx.drawImage(
          imgs.irises,
          eye.slotX,
          0,
          IRIS_SLOT_SIZE,
          IRIS_SLOT_SIZE,
          eye.cx - IRIS_SLOT_SIZE / 2 + clampX,
          eye.cy - IRIS_SLOT_SIZE / 2 + clampY,
          IRIS_SLOT_SIZE,
          IRIS_SLOT_SIZE
        );
        ctx.restore();

        // 2. Draw smooth descending 3D upper eyelid cleanly inside socket behind glasses frame
        if (blinkAmount > 0.01) {
          const currLashY = eye.topY + (eye.lashRestY - eye.topY) * blinkAmount;
          const shiftY = Math.min(0, currLashY - eye.lashRestY);

          ctx.save();
          clipPolygonPath(ctx, eye.lidPoly);
          if (blinkAmount < 0.96) {
            clipLidCurtain(ctx, eye.lidPoly, eye.midX, eye.rx, eye.topY, currLashY, blinkAmount);
          }
          ctx.drawImage(
            imgs.closedLids,
            0,
            0,
            EYE_LIDS_W,
            EYE_LIDS_H,
            EYE_LIDS_X,
            EYE_LIDS_Y + shiftY,
            EYE_LIDS_W,
            EYE_LIDS_H
          );
          ctx.restore();
        }
      }
    };

    const drawMouthWithJaw = (ctx, visemesImg, visemeState, curState, isActiveSpeech) => {
      const { primaryViseme, secondaryViseme, blend, openness } = visemeState;

      // Subtle thoughtful lip press while thinking; strictly closed on idle/listening/interrupted/error
      if (curState === AVATAR_STATE.THINKING && !isActiveSpeech) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(
          visemesImg,
          VISEME.MBP * VISEME_SLOT_W,
          0,
          VISEME_SLOT_W,
          VISEME_SLOT_H,
          VISEME_X,
          VISEME_Y,
          VISEME_SLOT_W,
          VISEME_SLOT_H
        );
        ctx.restore();
        return;
      }

      if (
        !isActiveSpeech &&
        primaryViseme === VISEME.REST &&
        secondaryViseme === VISEME.REST &&
        openness < 0.02
      ) {
        return;
      }

      // Render pixel-locked mouth viseme cleanly at (VISEME_X, VISEME_Y) with zero patch scaling/shifting
      // (noseless alpha mask ensures nose & mustache corners never move or break; adjacent step blend prevents popping)
      if (primaryViseme !== VISEME.REST) {
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.drawImage(
          visemesImg,
          primaryViseme * VISEME_SLOT_W,
          0,
          VISEME_SLOT_W,
          VISEME_SLOT_H,
          VISEME_X,
          VISEME_Y,
          VISEME_SLOT_W,
          VISEME_SLOT_H
        );
        ctx.restore();
      }

      if (secondaryViseme !== primaryViseme && blend > 0.02) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, blend));
        ctx.drawImage(
          visemesImg,
          secondaryViseme * VISEME_SLOT_W,
          0,
          VISEME_SLOT_W,
          VISEME_SLOT_H,
          VISEME_X,
          VISEME_Y,
          VISEME_SLOT_W,
          VISEME_SLOT_H
        );
        ctx.restore();
      }
    };

    const tick = (now) => {
      rafId = requestAnimationFrame(tick);

      const dtMs = Math.min(50, Math.max(4, now - lastPerf));
      const dt = dtMs / 1000;
      lastPerf = now;

      if (!visibleRef.current || document.hidden) return;
      const canvas = canvasRef.current;
      const imgs = imagesRef.current;
      if (!canvas || !imgs || canvas.width === 0 || canvas.height === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const anim = animRef.current;
      anim.clockSec += dt;
      const t = anim.clockSec;
      const curState = stateRef.current;

      // 1. Live audio-driven viseme update (strictly silent outside SPEAKING state)
      const playback = audioEngineRef?.current?.getPlaybackSnapshot?.() || { isSpeaking: false };
      const isActiveSpeech = curState === AVATAR_STATE.SPEAKING && playback.isSpeaking;

      anim.viseme = computeFrameViseme({
        analyser: playback.analyser,
        freqData: playback.freqData,
        timeData: playback.timeData,
        timeline: playback.timeline,
        elapsedSec: playback.elapsedSec,
        isSpeaking: isActiveSpeech,
        prevState: anim.viseme,
        dt,
      });

      // 2. Natural stochastic eye blinking + occasional subtle double blink (independent of mouth)
      const blink = anim.blink;
      if (blink.active) {
        blink.elapsedMs += dtMs;
        if (blink.elapsedMs >= blink.durationMs) {
          blink.active = false;
          blink.elapsedMs = 0;
          if (blink.pendingDouble) {
            blink.pendingDouble = false;
            blink.nextDelayMs = 140;
          } else {
            blink.nextDelayMs = nextBlinkIntervalMs(curState);
          }
        }
      } else {
        blink.nextDelayMs -= dtMs;
        if (blink.nextDelayMs <= 0) {
          blink.active = true;
          blink.elapsedMs = 0;
          blink.durationMs = 190 + Math.random() * 45;
          blink.pendingDouble = Math.random() < 0.16;
        }
      }

      let blinkAmount = 0;
      if (blink.active) {
        const p = Math.min(1, blink.elapsedMs / blink.durationMs);
        if (p < 0.34) {
          const u = p / 0.34;
          blinkAmount = u * u * (3 - 2 * u);
        } else if (p < 0.50) {
          blinkAmount = 1.0;
        } else {
          const u = 1 - (p - 0.50) / 0.50;
          blinkAmount = u * u * (3 - 2 * u);
        }
      }

      // 3. Natural eye gaze & subtle saccades per state
      const gaze = anim.gaze;
      gaze.nextSaccadeMs -= dtMs;
      if (gaze.nextSaccadeMs <= 0) {
        if (curState === AVATAR_STATE.THINKING) {
          gaze.targetX = 1.8 + Math.random() * 0.9;
          gaze.targetY = -1.1 - Math.random() * 0.5;
          gaze.nextSaccadeMs = 1400 + Math.random() * 1200;
        } else if (curState === AVATAR_STATE.LISTENING) {
          // Attentive camera eye contact with ultra-subtle micro-life
          gaze.targetX = (Math.random() - 0.5) * 0.5;
          gaze.targetY = (Math.random() - 0.5) * 0.3;
          gaze.nextSaccadeMs = 2600 + Math.random() * 2200;
        } else if (curState === AVATAR_STATE.SPEAKING) {
          // Natural conversational camera eye contact + gentle occasional glance
          const glance = Math.random() < 0.35;
          gaze.targetX = glance ? (Math.random() - 0.5) * 2.2 : (Math.random() - 0.5) * 0.5;
          gaze.targetY = glance ? (Math.random() - 0.5) * 1.1 : (Math.random() - 0.5) * 0.4;
          gaze.nextSaccadeMs = 1800 + Math.random() * 2000;
        } else {
          const glance = Math.random() < 0.3;
          gaze.targetX = glance ? (Math.random() - 0.5) * 2.0 : 0;
          gaze.targetY = glance ? (Math.random() - 0.5) * 1.0 : 0;
          gaze.nextSaccadeMs = 2800 + Math.random() * 2800;
        }
      } else if (curState === AVATAR_STATE.INTERRUPTED || curState === AVATAR_STATE.ERROR) {
        gaze.targetX = 0;
        gaze.targetY = 0;
      }

      const gazeTau = curState === AVATAR_STATE.THINKING ? 0.28 : 0.16;
      const gAlpha = 1 - Math.exp(-dt / gazeTau);
      gaze.x += (gaze.targetX - gaze.x) * gAlpha;
      gaze.y += (gaze.targetY - gaze.y) * gAlpha;

      // 4. Natural chest breathing (with pause), shoulder/torso posture, & occasional non-repetitive nodding
      const breath = sampleHumanBreath(t);
      const microSway = Math.sin(t * 0.82 + 0.5) * 0.55 + Math.sin(t * 1.37) * 0.45;
      const energy = anim.viseme.energy;

      // Subtle stochastic conversational/acknowledging head nod (never continuous bobbing)
      const nod = anim.nod;
      if (curState === AVATAR_STATE.INTERRUPTED || curState === AVATAR_STATE.ERROR) {
        nod.active = false;
        nod.elapsedMs = 0;
        nod.nextDelayMs = nextNodIntervalMs(AVATAR_STATE.IDLE);
      } else if (nod.active) {
        nod.elapsedMs += dtMs;
        if (nod.elapsedMs >= nod.durationMs) {
          nod.active = false;
          nod.elapsedMs = 0;
          nod.nextDelayMs = nextNodIntervalMs(curState);
        }
      } else if (curState !== AVATAR_STATE.THINKING) {
        nod.nextDelayMs -= dtMs;
        if (nod.nextDelayMs <= 0) {
          nod.active = true;
          nod.elapsedMs = 0;
          nod.durationMs = 480 + Math.random() * 240;
          const isSpeakingOrListening =
            curState === AVATAR_STATE.SPEAKING || curState === AVATAR_STATE.LISTENING;
          nod.amplitudeY = isSpeakingOrListening ? 2.8 + Math.random() * 1.6 : 1.5 + Math.random() * 0.9;
          nod.amplitudeDeg = (Math.random() < 0.5 ? 1 : -1) * (0.9 + Math.random() * 0.7);
        }
      }

      let nodOffsetY = 0;
      let nodTiltDeg = 0;
      if (nod.active) {
        const np = Math.min(1, nod.elapsedMs / nod.durationMs);
        const envelope = Math.sin(Math.PI * np);
        nodOffsetY = envelope * nod.amplitudeY;
        nodTiltDeg = envelope * nod.amplitudeDeg;
      }

      // Upper torso / shoulder targets anchored cleanly at bottom hem (y=720)
      const phraseSway = Math.sin(t * 0.56) * 0.65 + Math.sin(t * 0.96 + 1.1) * 0.35;
      const targetBreathLiftY = 0;
      let targetChestScaleY = 1.0 + breath * 0.028;
      let targetShoulderSpreadX = 1.0 + breath * 0.015;
      let targetTorsoLeanX = microSway * 4.5;
      let targetTorsoTiltDeg = microSway * 0.55;

      // Head pose targets per controller state
      let targetTiltDeg = microSway * 0.85 + nodTiltDeg;
      let targetDriftX = microSway * 2.1;
      let targetDriftY = nodOffsetY;
      let targetScale = 1.0;

      if (curState === AVATAR_STATE.LISTENING) {
        // Warm attentive posture + gentle breathing + subtle acknowledging nods
        targetChestScaleY = 1.008 + breath * 0.026;
        targetShoulderSpreadX = 1.008 + breath * 0.014;
        targetTorsoLeanX = microSway * 3.8;
        targetTorsoTiltDeg = microSway * 0.48;
        targetTiltDeg = 2.0 + microSway * 0.55 + nodTiltDeg;
        targetDriftX = microSway * 1.6;
        targetDriftY = nodOffsetY;
        targetScale = 1.008;
      } else if (curState === AVATAR_STATE.THINKING) {
        // Calm composed thinking poise with noticeable thoughtful weight shift
        targetChestScaleY = 1.004 + breath * 0.022;
        targetShoulderSpreadX = 1.004 + breath * 0.012;
        targetTorsoLeanX = 6.2 + microSway * 1.8;
        targetTorsoTiltDeg = -0.8;
        targetTiltDeg = -2.4 + microSway * 0.4;
        targetDriftX = 2.8;
        targetDriftY = -1.6;
      } else if (curState === AVATAR_STATE.SPEAKING) {
        // Unhurried conversational presenter poise: natural left-right torso shift, chest emphasis & expressive head turn
        targetChestScaleY = 1.006 + breath * 0.030 + energy * 0.011;
        targetShoulderSpreadX = 1.006 + breath * 0.016 + energy * 0.006;
        targetTorsoLeanX = phraseSway * (7.2 + energy * 3.2);
        targetTorsoTiltDeg = phraseSway * (0.95 + energy * 0.45);
        targetTiltDeg = Math.sin(t * 0.88 + 0.5) * (1.45 + energy * 1.15) + nodTiltDeg;
        targetDriftX = Math.sin(t * 0.72) * 3.6;
        targetDriftY = -energy * 1.4 + nodOffsetY;
        targetScale = 1.005 + energy * 0.004;
      } else if (curState === AVATAR_STATE.INTERRUPTED) {
        // Fast clean reset posture on user barge-in / interruption
        targetTiltDeg = 0.4;
        targetTorsoLeanX = 0;
        targetTorsoTiltDeg = 0;
      }

      const torsoTau = curState === AVATAR_STATE.INTERRUPTED ? 0.12 : 0.42;
      const tAlpha = 1 - Math.exp(-dt / torsoTau);
      const torso = anim.torso;
      torso.breathLiftY += (targetBreathLiftY - torso.breathLiftY) * tAlpha;
      torso.chestScaleY += (targetChestScaleY - torso.chestScaleY) * tAlpha;
      torso.shoulderSpreadX += (targetShoulderSpreadX - torso.shoulderSpreadX) * tAlpha;
      torso.leanX += (targetTorsoLeanX - torso.leanX) * tAlpha;
      torso.tiltDeg += (targetTorsoTiltDeg - torso.tiltDeg) * tAlpha;

      const poseTau = curState === AVATAR_STATE.INTERRUPTED ? 0.08 : 0.32;
      const pAlpha = 1 - Math.exp(-dt / poseTau);
      const pose = anim.pose;
      pose.tiltDeg += (targetTiltDeg - pose.tiltDeg) * pAlpha;
      pose.driftX += (targetDriftX - pose.driftX) * pAlpha;
      pose.driftY += (targetDriftY - pose.driftY) * pAlpha;
      pose.scale += (targetScale - pose.scale) * pAlpha;

      // 5. Render 1280x720 scene fitted cleanly to canvas (object-cover, center 20%)
      const cw = canvas.width;
      const ch = canvas.height;
      const fitScale = Math.max(cw / WORLD_W, ch / WORLD_H);
      const offsetX = (cw - WORLD_W * fitScale) * 0.5;
      const offsetY = (ch - WORLD_H * fitScale) * 0.2;

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(fitScale, fitScale);

      // Layer A: Static clean dark studio backdrop (zero back-shadow)
      ctx.drawImage(imgs.torso, 0, 0, WORLD_W, WORLD_H);

      // Layer A2: Breathing upper torso, shoulders, and suit layer anchored around bottom-center pivot
      ctx.save();
      ctx.translate(TORSO_PIVOT_X + torso.leanX, TORSO_PIVOT_Y + torso.breathLiftY);
      ctx.rotate((torso.tiltDeg * Math.PI) / 180);
      ctx.scale(torso.shoulderSpreadX, torso.chestScaleY);
      ctx.translate(-TORSO_PIVOT_X, -TORSO_PIVOT_Y);
      ctx.drawImage(imgs.torsoFg, TORSO_FG_X, TORSO_FG_Y);
      ctx.restore();

      // Layer B: Head + Neck group pixel-locked 1:1 to torso breathing & lean
      const neckFollowY =
        torso.breathLiftY + (NECK_PIVOT_Y - TORSO_PIVOT_Y) * (torso.chestScaleY - 1);
      const neckFollowX = torso.leanX;

      ctx.save();
      ctx.translate(
        NECK_PIVOT_X + neckFollowX + pose.driftX,
        NECK_PIVOT_Y + neckFollowY + pose.driftY
      );
      ctx.rotate((pose.tiltDeg * Math.PI) / 180);
      ctx.scale(pose.scale, pose.scale);
      ctx.translate(-NECK_PIVOT_X, -NECK_PIVOT_Y);

      ctx.drawImage(imgs.head, HEAD_X, HEAD_Y);

      // Layer B1: Strictly two clipped eyes (1 iris/pupil per eye) + real 3D descending eyelids
      drawEyesAndBlinks(ctx, imgs, gaze.x, gaze.y, blinkAmount);

      // Layer B2: Audio-locked mouth visemes coordinated with subtle jaw & cheek ease
      drawMouthWithJaw(ctx, imgs.visemes, anim.viseme, curState, isActiveSpeech);

      ctx.restore(); // End Head group
      ctx.restore(); // End Viewport scale
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [assetsReady, audioEngineRef]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0a0d14] pointer-events-none box-border">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />
      {!assetsReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0d14] text-white/60 text-xs">
          Loading assistant...
        </div>
      )}
    </div>
  );
}
