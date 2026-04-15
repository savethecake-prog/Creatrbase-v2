export function LogoMonogram({ className }) {
  const textStyle = { fontFamily: "'Archivo Black', 'Arial Black', sans-serif", fontSize: 220, fontWeight: 900, fontStyle: 'italic' };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 340" className={className}>
      <rect width="340" height="340" fill="#1B1040" rx="24"/>
      {Array.from({ length: 21 }).map((_, i) => (
        <g key={i}>
          <text x={50 - i} y={278 - i} style={textStyle} fill="none" stroke="#FFFFFF" strokeWidth="20" strokeLinejoin="round">C</text>
          <text x={178 - i} y={278 - i} style={textStyle} fill="none" stroke="#FFFFFF" strokeWidth="20" strokeLinejoin="round">B</text>
        </g>
      ))}
      <text x="30" y="258" style={textStyle} fill="#9EFFD8">C</text>
      <text x="158" y="258" style={textStyle} fill="#FFBFA3">B</text>
    </svg>
  );
}
