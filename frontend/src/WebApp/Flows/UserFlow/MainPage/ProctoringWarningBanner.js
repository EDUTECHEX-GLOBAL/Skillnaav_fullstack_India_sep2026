// components/ProctoringWarningBanner.js
import React, { useEffect, useState } from 'react';

/**
 * A non-blocking in-app warning banner for proctoring violations.
 *
 * Why this exists:
 *   Native alert() steals focus from the browser window, which triggers
 *   WINDOW_BLUR and TAB_SWITCH events — creating a cascade of violations
 *   from a single user action. This component renders inside the React
 *   tree so it never causes focus loss.
 *
 * Usage:
 *   const { warningMessage } = useProctoring(onViolation);
 *   return (
 *     <div>
 *       <ProctoringWarningBanner message={warningMessage} />
 *       ...rest of assessment UI
 *     </div>
 *   );
 */
const ProctoringWarningBanner = ({ message }) => {
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');

  useEffect(() => {
    if (message) {
      setDisplayMessage(message);
      setVisible(true);
    } else {
      // Fade-out delay so the animation completes before unmounting
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!visible && !message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 16px',
        pointerEvents: 'none',
        animation: message ? 'slideDown 0.3s ease-out' : 'slideUp 0.3s ease-in',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
          color: '#fff',
          padding: '14px 24px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(220, 38, 38, 0.35)',
          maxWidth: '560px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: 1.5,
          pointerEvents: 'auto',
        }}
      >
        {/* Warning icon */}
        <span style={{ fontSize: '22px', flexShrink: 0 }}>⚠️</span>
        <span>{displayMessage}</span>
      </div>

      {/* Keyframe animations (injected once) */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(0);     opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ProctoringWarningBanner;