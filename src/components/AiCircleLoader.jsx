import React from 'react';

/**
 * Modern AI circle loader with orbiting glowing particles and status text.
 * Supports both vertical card layout (default) and compact horizontal strip layout (compact=true).
 */
export default function AiCircleLoader({
  message = "L'AI sta leggendo ed elaborando...",
  submessage = null,
  size = 46,
  elapsedSeconds = null,
  compact = false
}) {
  if (compact) {
    return (
      <div 
        className="ai-circle-loader-compact"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.85rem 1.15rem',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--accent-cyan-dim)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          color: 'var(--text-primary)',
          userSelect: 'none'
        }}
      >
        <div 
          style={{
            position: 'relative',
            width: `${size}px`,
            height: `${size}px`,
            minWidth: `${size}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Ambient Pulsing Aura */}
          <div 
            style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-cyan-glow, rgba(229, 169, 83, 0.45)) 0%, transparent 70%)',
              animation: 'aiAuraPulse 2s ease-in-out infinite'
            }}
          />

          {/* Outer Rotating Glow Ring */}
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--accent-cyan)',
              borderRightColor: 'var(--accent-amber, #e5a953)',
              animation: 'aiRingSpin 1.1s cubic-bezier(0.68, -0.2, 0.27, 1.25) infinite'
            }}
          />

          {/* Inner Counter-Rotating Ring */}
          <div 
            style={{
              position: 'absolute',
              inset: '5px',
              borderRadius: '50%',
              border: '1.5px solid transparent',
              borderBottomColor: 'var(--accent-coral, #e06d53)',
              borderLeftColor: 'var(--accent-cyan)',
              opacity: 0.85,
              animation: 'aiRingSpinReverse 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite'
            }}
          />

          {/* Core Glowing Dot */}
          <div 
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              boxShadow: '0 0 10px var(--accent-cyan)',
              animation: 'aiCoreBreathe 1.8s ease-in-out infinite'
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.84rem', 
            fontWeight: '600', 
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}>
            <span>{message}</span>
            {elapsedSeconds !== null && elapsedSeconds > 0 && (
              <span style={{ 
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-cyan)',
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.06)'
              }}>
                {elapsedSeconds}s
              </span>
            )}
          </p>
          {submessage && (
            <p style={{ 
              margin: '0.2rem 0 0', 
              fontSize: '0.74rem', 
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}>
              {submessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="ai-circle-loader-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        gap: '1.25rem',
        color: 'var(--text-primary)',
        userSelect: 'none'
      }}
    >
      <div 
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Ambient Pulsing Aura */}
        <div 
          className="ai-ambient-aura"
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-cyan-glow, rgba(229, 169, 83, 0.45)) 0%, transparent 70%)',
            animation: 'aiAuraPulse 2.4s ease-in-out infinite'
          }}
        />

        {/* Outer Rotating Glow Ring */}
        <div 
          className="ai-outer-ring"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor: 'var(--accent-cyan)',
            borderRightColor: 'var(--accent-amber, #e5a953)',
            animation: 'aiRingSpin 1.1s cubic-bezier(0.68, -0.2, 0.27, 1.25) infinite'
          }}
        />

        {/* Inner Counter-Rotating Ring */}
        <div 
          className="ai-inner-ring"
          style={{
            position: 'absolute',
            inset: '7px',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderBottomColor: 'var(--accent-coral, #e06d53)',
            borderLeftColor: 'var(--accent-cyan)',
            opacity: 0.85,
            animation: 'aiRingSpinReverse 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite'
          }}
        />

        {/* Core Glowing Dot */}
        <div 
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--accent-cyan)',
            boxShadow: '0 0 14px var(--accent-cyan)',
            animation: 'aiCoreBreathe 1.8s ease-in-out infinite'
          }}
        />
      </div>

      {/* Messages */}
      <div style={{ textAlign: 'center', maxWidth: '340px' }}>
        <p style={{ 
          margin: 0, 
          fontSize: '0.9rem', 
          fontWeight: '600', 
          color: 'var(--text-primary)',
          letterSpacing: '0.01em'
        }}>
          {message}
        </p>
        {submessage && (
          <p style={{ 
            margin: '0.35rem 0 0', 
            fontSize: '0.76rem', 
            color: 'var(--text-secondary)',
            lineHeight: 1.45
          }}>
            {submessage}
          </p>
        )}
        {elapsedSeconds !== null && elapsedSeconds > 0 && (
          <span style={{ 
            display: 'inline-block',
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.05)'
          }}>
            {elapsedSeconds}s
          </span>
        )}
      </div>
    </div>
  );
}
