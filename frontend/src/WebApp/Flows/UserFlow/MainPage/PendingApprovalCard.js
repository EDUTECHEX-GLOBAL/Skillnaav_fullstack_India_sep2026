// PendingApprovalCard.jsx
import React from 'react';

const PendingApprovalCard = ({ userInfo }) => {
  const steps = [
    { label: 'Account created', done: true },
    { label: 'Profile submitted', done: true },
    { label: 'Admin review', done: false, active: true },
    { label: 'Access granted', done: false },
  ];

  return (
    <div style={{
      background: '#fff',
      borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
      padding: '40px 36px',
      maxWidth: '440px',
      width: '90%',
      textAlign: 'center',
      border: '1px solid #f0f0f0',
      animation: 'cardIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes cardIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:0.6} 50%{transform:scale(1.15);opacity:0.2} }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
      `}</style>

      {/* Animated icon */}
      <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '20px' }}>
        <div style={{
          position: 'absolute', inset: '-8px',
          borderRadius: '50%',
          border: '2px solid #a78bfa',
          animation: 'pulse-ring 2s ease-in-out infinite',
        }} />
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px',
        }}>
          ⏳
        </div>
      </div>

      <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>
        Awaiting Admin Approval
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
        Hi <strong style={{ color: '#4c1d95' }}>{userInfo?.name?.split(' ')[0] || 'there'}</strong>! Your account is under review.
        You'll get full access once an admin approves your profile.
      </p>

      {/* Progress steps */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px', gap: '0' }}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '72px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '700', transition: 'all 0.3s',
                backgroundColor: step.done ? '#7c3aed' : step.active ? '#ede9fe' : '#f3f4f6',
                color: step.done ? '#fff' : step.active ? '#7c3aed' : '#9ca3af',
                border: step.active ? '2px solid #7c3aed' : '2px solid transparent',
                boxShadow: step.active ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none',
              }}>
                {step.done ? '✓' : step.active ? (
                  <span style={{
                    display: 'inline-block', width: '10px', height: '10px',
                    borderRadius: '50%', backgroundColor: '#7c3aed',
                    animation: 'pulse-ring 1.4s ease-in-out infinite',
                  }} />
                ) : i + 1}
              </div>
              <span style={{
                fontSize: '10px', fontWeight: step.active ? '600' : '400',
                color: step.done ? '#7c3aed' : step.active ? '#4c1d95' : '#9ca3af',
                lineHeight: 1.2, textAlign: 'center',
              }}>{step.label}</span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div style={{
                height: '2px', flex: 1, marginBottom: '20px',
                backgroundColor: step.done ? '#7c3aed' : '#e5e7eb',
                transition: 'background-color 0.3s',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Info row */}
      <div style={{
        background: '#faf5ff', borderRadius: '12px',
        padding: '14px 18px', marginBottom: '20px',
        border: '1px solid #ede9fe',
        display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left',
      }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>📧</span>
        <p style={{ margin: 0, fontSize: '13px', color: '#5b21b6', lineHeight: 1.5 }}>
          We'll send an email to <strong>{userInfo?.email}</strong> as soon as your account is approved.
        </p>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
        Approval usually takes 1–2 business days. Questions?{' '}
        <a href="mailto:support@skillnaav.com" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: '600' }}>
          Contact support
        </a>
      </p>
    </div>
  );
};

export default PendingApprovalCard;