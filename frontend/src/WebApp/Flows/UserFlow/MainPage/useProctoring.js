// hooks/useProctoring.js
import { useState, useEffect, useRef, useCallback } from 'react';

export const useProctoring = (onViolation) => {
  const [violations, setViolations] = useState([]);
  const [stream, setStream] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningMessage, setWarningMessage] = useState(null);
  const videoRef = useRef(null);
  const violationCountRef = useRef(0);

  // ─── ANTI-CASCADE MECHANISM ────────────────────────────────────────
  // A single user action (e.g. clicking away) fires MULTIPLE browser
  // events (blur → visibilitychange → fullscreenchange) within the same
  // tick. We batch all events that arrive within a short window into ONE
  // violation.
  const BATCH_WINDOW_MS = 1500;        // group events within 1.5s
  const COOLDOWN_AFTER_VIOLATION = 20000; // 20s cooldown after a recorded violation
  const pendingViolationsRef = useRef([]); // buffer during batch window
  const batchTimerRef = useRef(null);
  const lastRecordedTimeRef = useRef(0);
  const isProcessingAlertRef = useRef(false); // flag to suppress events during warnings
  const suppressUntilRef = useRef(0);         // timestamp until which events are ignored
  const hiddenStartRef = useRef(0); // track when tab became hidden for debounce

  // ─── FLUSH: commit the batched violations as a SINGLE violation ────
  const flushViolations = useCallback(() => {
    const pending = pendingViolationsRef.current;
    if (pending.length === 0) return;

    // Pick the highest-severity event as the representative violation
    const SEVERITY = {
      FULLSCREEN_EXIT: 4,
      TAB_SWITCH: 3,
      WINDOW_BLUR: 2,
      DEVTOOLS_OPEN: 5,
      KEYBOARD_ATTEMPT: 1,
      RIGHT_CLICK: 0,
      COPY_PASTE: 0,
    };

    pending.sort((a, b) => (SEVERITY[b.type] || 0) - (SEVERITY[a.type] || 0));
    const primary = pending[0];

    // Build a combined description if multiple types fired
    const uniqueTypes = [...new Set(pending.map(v => v.type))];
    const combinedMessage =
      uniqueTypes.length > 1
        ? `${primary.message} (also detected: ${uniqueTypes.slice(1).join(', ')})`
        : primary.message;

    const violation = {
      type: primary.type,
      timestamp: new Date().toISOString(),
      message: combinedMessage,
      relatedEvents: uniqueTypes,
    };

    // Show an in-app non-blocking warning to avoid native alerts (which steal focus)
    isProcessingAlertRef.current = true;
    setWarningMessage(combinedMessage);
    setTimeout(() => {
      setWarningMessage(null);
      isProcessingAlertRef.current = false;
      // Short grace window after the warning dismisses
      suppressUntilRef.current = Date.now() + 1500;
    }, 4000);

    setViolations(prev => [...prev, violation]);
    violationCountRef.current += 1;
    lastRecordedTimeRef.current = Date.now();

    if (onViolation) {
      onViolation(violation, violationCountRef.current);
    }

    // Clear the buffer
    pendingViolationsRef.current = [];
    batchTimerRef.current = null;
  }, [onViolation]);

  // ─── ADD VIOLATION (batched) ───────────────────────────────────────
  const addViolation = useCallback((type, message) => {
    const now = Date.now();

    // 1) Suppress events while we're showing an in-app warning
    if (isProcessingAlertRef.current) return;

    // 2) Suppress events during the grace/cooldown window
    if (now < suppressUntilRef.current) return;

    // 3) Enforce cooldown after last recorded violation
    if (now - lastRecordedTimeRef.current < COOLDOWN_AFTER_VIOLATION) {
      // Still within cooldown — drop silently
      if (type !== 'FACE_NOT_DETECTED' && type !== 'MULTIPLE_FACES') {
        return;
      }
    }

    // 4) Buffer this event
    pendingViolationsRef.current.push({ type, message, time: now });

    // 5) Start (or restart) the batch timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    batchTimerRef.current = setTimeout(flushViolations, BATCH_WINDOW_MS);
  }, [flushViolations]);

  // ─── SHOW WARNING (replaces native alert to avoid triggering more events) ─
  const showWarning = useCallback((msg, durationMs = 4000) => {
    isProcessingAlertRef.current = true;
    setWarningMessage(msg);

    setTimeout(() => {
      setWarningMessage(null);
      isProcessingAlertRef.current = false;
      // Give a small grace window after the warning dismisses
      suppressUntilRef.current = Date.now() + 1500;
    }, durationMs);
  }, []);

  // ─── TAB SWITCH DETECTION ─────────────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only monitor tab switches while proctoring is active

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // mark when tab became hidden — we'll only count it if it stays hidden > 1s
        hiddenStartRef.current = Date.now();
        return;
      }

      // when returning to the tab, check how long it was hidden
      const hiddenFor = hiddenStartRef.current ? Date.now() - hiddenStartRef.current : 0;
      hiddenStartRef.current = 0;
      if (hiddenFor >= 1000) {
        addViolation('TAB_SWITCH', 'Switched to another tab or window');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [addViolation, stream]);

  // ─── WINDOW BLUR DETECTION ────────────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only monitor blur while proctoring is active

    const handleBlur = () => {
      // Only count blur if tab is NOT hidden (otherwise TAB_SWITCH covers it)
      if (!document.hidden) {
        addViolation('WINDOW_BLUR', 'Assessment window lost focus');
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [addViolation, stream]);

  // ─── PREVENT KEYBOARD SHORTCUTS ───────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only prevent shortcuts while proctoring is active

    const preventShortcuts = (e) => {
      const prohibited =
        ['F11', 'F12', 'Escape', 'PrintScreen'].includes(e.key) ||
        (e.ctrlKey && ['t', 'w', 'n', 'Tab'].includes(e.key)) ||
        (e.altKey && ['Tab', 'F4'].includes(e.key)) ||
        (e.metaKey && ['Tab', 't', 'w'].includes(e.key)) ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'I');

      if (prohibited) {
        e.preventDefault();
        e.stopPropagation();
        addViolation('KEYBOARD_ATTEMPT', `Attempted prohibited key: ${e.key}`);
      }
    };

    window.addEventListener('keydown', preventShortcuts, true);
    return () => window.removeEventListener('keydown', preventShortcuts, true);
  }, [addViolation, stream]);

  // ─── PREVENT CONTEXT MENU ─────────────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only prevent context menu while proctoring is active

    const preventContextMenu = (e) => {
      e.preventDefault();
      addViolation('RIGHT_CLICK', 'Attempted to open context menu');
    };

    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, [addViolation, stream]);

  // ─── DETECT COPY / PASTE / CUT ────────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only monitor copy/paste while proctoring is active

    const handler = (e) => {
      e.preventDefault();
      addViolation('COPY_PASTE', `Attempted to ${e.type} content`);
    };

    document.addEventListener('copy', handler);
    document.addEventListener('paste', handler);
    document.addEventListener('cut', handler);

    return () => {
      document.removeEventListener('copy', handler);
      document.removeEventListener('paste', handler);
      document.removeEventListener('cut', handler);
    };
  }, [addViolation, stream]);

  // ─── FULLSCREEN CHANGE DETECTION ──────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only monitor fullscreen while proctoring is active

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen) {
        addViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode');
      } else {
        // User re-entered fullscreen — suppress events for a grace period
        suppressUntilRef.current = Date.now() + 2000;
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange'];
    events.forEach(evt => document.addEventListener(evt, handleFullscreenChange));
    return () => events.forEach(evt => document.removeEventListener(evt, handleFullscreenChange));
  }, [addViolation, stream]);

  // ─── DEVTOOLS DETECTION (basic) ───────────────────────────────────
  useEffect(() => {
    if (!stream) return; // only monitor devtools while proctoring is active

    const detectDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;

      if (widthDiff || heightDiff) {
        addViolation('DEVTOOLS_OPEN', 'Developer tools may be open');
      }
    };

    const interval = setInterval(detectDevTools, 5000);
    return () => clearInterval(interval);
  }, [addViolation, stream]);

  // ─── START PROCTORING (Camera + Mic) ──────────────────────────────
  const startProctoring = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // Determine whether both video and audio tracks are present
      const hasVideo = mediaStream.getVideoTracks && mediaStream.getVideoTracks().length > 0 && mediaStream.getVideoTracks().some(t => t.enabled !== false);
      const hasAudio = mediaStream.getAudioTracks && mediaStream.getAudioTracks().length > 0 && mediaStream.getAudioTracks().some(t => t.enabled !== false);
      const verified = !!(hasVideo && hasAudio);

      // Suppress any events that fire during the startup sequence (longer grace)
      suppressUntilRef.current = Date.now() + 10000;

      return { success: true, verified, stream: mediaStream };
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);

      let message = 'Camera and microphone access is required for this assessment.';
      if (error.name === 'NotAllowedError') {
        message += ' Please allow permissions in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        message += ' No camera or microphone found.';
      } else if (error.name === 'NotReadableError') {
        message += ' Device is in use by another application.';
      }

      // Use our in-app warning instead of alert()
      showWarning(message, 6000);
      return { success: false, verified: false, error };
    }
  }, [showWarning]);

  // ─── STOP PROCTORING ──────────────────────────────────────────────
  const stopProctoring = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    // Clear any pending batch timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, [stream]);

  // ─── ENTER FULLSCREEN ─────────────────────────────────────────────
  const enterFullscreen = useCallback(async (element) => {
    // Suppress events during the fullscreen transition
    suppressUntilRef.current = Date.now() + 2000;

    try {
      const fn =
        element.requestFullscreen ||
        element.webkitRequestFullscreen ||
        element.mozRequestFullScreen ||
        element.msRequestFullscreen;

      if (fn) {
        await fn.call(element);
      } else {
        throw new Error('Fullscreen not supported');
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
      showWarning('Fullscreen mode is required for this assessment.', 5000);
    }
  }, [showWarning]);

  // ─── EXIT FULLSCREEN ──────────────────────────────────────────────
  const exitFullscreen = useCallback(async () => {
    // Suppress events during exit transition
    suppressUntilRef.current = Date.now() + 2000;

    try {
      const fn =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (fn) await fn.call(document);
    } catch (error) {
      console.error('Error exiting fullscreen:', error);
    }
  }, []);

  // ─── CLEANUP ON UNMOUNT ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopProctoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    violations,
    stream,
    isFullscreen,
    videoRef,
    warningMessage,       // ← NEW: use this to render an in-app warning banner
    startProctoring,
    stopProctoring,
    enterFullscreen,
    exitFullscreen,
    violationCount: violationCountRef.current,
    addViolation,
    showWarning,          // ← NEW: trigger in-app warnings instead of alert()
  };
};
