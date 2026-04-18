import React from 'react';

export function LogoWordmark({ className, variant = 'v1', dark = false }) {
  if (variant === 'v2') {
    return (
      <img
        src={dark ? '/brand/wordmark-dark.png' : '/brand/wordmark-light.png'}
        alt="Creatrbase"
        className={className}
        style={{ height: '100%', width: 'auto', display: 'block' }}
      />
    );
  }

  const textColor = "#ffffff";
  const accentColor = "var(--neon-mint)";

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
        <path d="M42 6H6V42H42V34H34V34H14V14H34V14H42V6Z" fill={accentColor} />
        <rect x="0" y="44" width="48" height="4" fill={textColor} fillOpacity="0.8" />
      </svg>

      <div style={{
        fontFamily: "var(--font-display)",
        fontWeight: '900',
        fontSize: '26px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 0.92,
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <span>CREATR</span>
        <span style={{ color: accentColor }}>BASE</span>
      </div>
    </div>
  );
}
