import type { ReactNode } from 'react'

function makeRng(seedStr: string) {
  let s = 0
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const STROKE = '#dbe6f5'
const FILL = 'rgba(219,230,245,0.14)'

/** A dark, compact isolated return + acoustic shadow - the "target/shadow pair" cue used for the
 * six classes that appear as a discrete object on otherwise plain seabed. */
function TargetShadow() {
  return (
    <g>
      <path d="M90,96 78,150 112,150 Z" fill="#000000" opacity={0.5} />
      <ellipse cx={95} cy={92} rx={8} ry={6} fill="#000000" opacity={0.75} />
    </g>
  )
}

function ClassSilhouette({ slug, rng }: { slug: string; rng: () => number }) {
  switch (slug) {
    case 'planes':
      return (
        <>
          <polygon points="46,80 122,96 60,104 30,118" fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <TargetShadow />
        </>
      )
    case 'ships-shipwrecks':
      return (
        <>
          <polygon points="30,96 128,96 116,78 44,78" fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <rect x={68} y={60} width={28} height={18} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <TargetShadow />
        </>
      )
    case 'pipes':
      return (
        <>
          <rect x={26} y={72} width={110} height={16} rx={8} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          {[46, 66, 86, 106, 126].map((x) => (
            <line key={x} x1={x} y1={72} x2={x} y2={88} stroke={STROKE} strokeWidth={1} opacity={0.6} />
          ))}
          <TargetShadow />
        </>
      )
    case 'mines':
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            const r1 = 16
            const r2 = 30
            return (
              <line
                key={i}
                x1={80 + Math.cos(a) * r1}
                y1={78 + Math.sin(a) * r1}
                x2={80 + Math.cos(a) * r2}
                y2={78 + Math.sin(a) * r2}
                stroke={STROKE}
                strokeWidth={1.5}
              />
            )
          })}
          <circle cx={80} cy={78} r={16} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <TargetShadow />
        </>
      )
    case 'tires':
      return (
        <>
          <circle cx={80} cy={82} r={30} fill="none" stroke={STROKE} strokeWidth={4} />
          <circle cx={80} cy={82} r={13} fill="none" stroke={STROKE} strokeWidth={2} />
          <TargetShadow />
        </>
      )
    case 'mounds':
      return <path d="M20,120 Q80,55 140,120" fill="none" stroke={STROKE} strokeWidth={2} />
    case 'platforms':
      return (
        <>
          <rect x={40} y={68} width={80} height={10} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          {[48, 70, 92, 112].map((x) => (
            <line key={x} x1={x} y1={78} x2={x} y2={122} stroke={STROKE} strokeWidth={1.5} />
          ))}
        </>
      )
    case 'mannequins':
      return (
        <>
          <circle cx={80} cy={54} r={7} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <rect x={71} y={62} width={18} height={26} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          <line x1={71} y1={66} x2={54} y2={82} stroke={STROKE} strokeWidth={1.5} />
          <line x1={89} y1={66} x2={106} y2={82} stroke={STROKE} strokeWidth={1.5} />
          <line x1={75} y1={88} x2={68} y2={116} stroke={STROKE} strokeWidth={1.5} />
          <line x1={85} y1={88} x2={92} y2={116} stroke={STROKE} strokeWidth={1.5} />
        </>
      )
    case 'seagrass':
      return (
        <>
          {Array.from({ length: 6 }, (_, i) => {
            const x = 45 + i * 14 + rng() * 4
            const h = 30 + rng() * 30
            const sway = 8 + rng() * 10
            return (
              <path
                key={i}
                d={`M${x},120 Q${x + sway},${120 - h / 2} ${x},${120 - h}`}
                fill="none"
                stroke={STROKE}
                strokeWidth={1.3}
                opacity={0.75}
              />
            )
          })}
        </>
      )
    case 'mud':
      return <path d="M15,110 Q80,104 145,111" fill="none" stroke={STROKE} strokeWidth={1} opacity={0.5} />
    case 'rocks': {
      const cx = 80
      const cy = 92
      const n = 9
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const r = 24 + rng() * 14
        return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r * 0.75}`
      }).join(' ')
      return <polygon points={pts} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
    }
    case 'ghost-nets':
      return (
        <g stroke={STROKE} strokeWidth={1} opacity={0.75}>
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`a${i}`} x1={20 + i * 18} y1={130} x2={20 + i * 18 + 55} y2={45} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`b${i}`} x1={20 + i * 18} y1={45} x2={20 + i * 18 + 55} y2={130} />
          ))}
        </g>
      )
    default:
      return <circle cx={80} cy={80} r={20} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
  }
}

/**
 * A clean per-class line-art sonar-contact icon - deterministic per class slug, styled to match
 * the reference dashboard's "SIDE-SCAN SONAR" panels (scanline background, light silhouette
 * outline, dark target/shadow pair for discrete objects). This is NOT a real sonar image; used
 * only when no actual uploaded-image crop is available for a class, always paired with an
 * "Illustrative" label by the caller so it is never mistaken for a real capture.
 */
export function ProceduralSonarSwatch({ seed, className }: { seed: string; artificial?: boolean; className?: string }): ReactNode {
  const rng = makeRng(seed)
  return (
    <svg viewBox="0 0 160 160" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="160" height="160" fill="#070c18" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={0} y1={(i * 160) / 10} x2={160} y2={(i * 160) / 10} stroke="#1c2c47" strokeWidth={1} opacity={0.5} />
      ))}
      <ClassSilhouette slug={seed} rng={rng} />
    </svg>
  )
}
