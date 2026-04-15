export function LogoWordmark({ className }) {
  const textStyle = { fontFamily: "'Archivo Black', 'Arial Black', sans-serif", fontSize: 78, fontWeight: 900, fontStyle: 'italic' };
  
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 260" className={className}>
      {Array.from({ length: 21 }).map((_, i) => (
        <g key={i}>
          <text x={40 - i} y={188 - i} style={textStyle} fill="none" stroke="#FFFFFF" strokeWidth="18" strokeLinejoin="round">CREATR</text>
          <text x={372 - i} y={188 - i} style={textStyle} fill="none" stroke="#FFFFFF" strokeWidth="18" strokeLinejoin="round">BASE</text>
        </g>
      ))}
      <text x="20" y="168" style={textStyle} fill="#9EFFD8">CREATR</text>
      <text x="352" y="168" style={textStyle} fill="#FFBFA3">BASE</text>
    </svg>
  );
}
