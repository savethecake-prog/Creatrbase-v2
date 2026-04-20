import React from 'react';

function TrajectoryMark({ size, dark }) {
  const squareFill   = dark ? '#1B1040' : '#FAF6EF';
  const innerStroke  = dark ? '#9EFFD8' : '#1B1040';
  const innerOpacity = dark ? 0.75 : 0.15;
  const arrowColor   = dark ? '#9EFFD8' : '#1B1040';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <rect x="2" y="2" width="52" height="52" rx="14" fill={squareFill} />
      <rect x="5" y="5" width="46" height="46" rx="11" fill="none" stroke={innerStroke} strokeWidth="2" opacity={innerOpacity} />
      <path d="M11 40 L21 32 L28 36 L40 18" stroke={arrowColor} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33.1 19.4 L40 18 L41.4 24.9" stroke={arrowColor} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoWordmark({ className, variant = 'v1', dark = false, height = 36, style }) {
  if (variant === 'v2') {
    const textColor = dark ? '#1B1040' : '#FAF6EF';
    const fontSize  = Math.round(height * 0.78);
    const gap       = Math.round(height * 0.28);
    return (
      <div
        className={className}
        style={{ display: 'flex', alignItems: 'center', gap, lineHeight: 1, ...style }}
      >
        <TrajectoryMark size={height} dark={dark} />
        <span style={{
          fontFamily: "'Cunia', var(--font-display)",
          fontSize: `${fontSize}px`,
          fontWeight: 400,
          letterSpacing: '-0.08em',
          color: textColor,
          lineHeight: 1,
          userSelect: 'none',
        }}>
          creatrbase
        </span>
      </div>
    );
  }

  const textColor   = '#ffffff';
  const accentColor = 'var(--neon-mint)';
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
        <path d="M42 6H6V42H42V34H34V34H14V14H34V14H42V6Z" fill={accentColor} />
        <rect x="0" y="44" width="48" height="4" fill={textColor} fillOpacity="0.8" />
      </svg>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: '900',
        fontSize: '26px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 0.92,
        color: textColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <span>CREATR</span>
        <span style={{ color: accentColor }}>BASE</span>
      </div>
    </div>
  );
}
