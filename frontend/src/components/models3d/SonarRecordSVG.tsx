import type { ClassName, SyntheticRecord } from '@/data/marineDebrisMeta'
import { MODEL_COLORS } from '@/data/marineDebrisMeta'

/** Per-class silhouette paths, ported verbatim from sonarSVG() in the reference dashboard. */
function ClassShape({ cls }: { cls: ClassName }) {
  switch (cls) {
    case 'Plane':
      return (
        <>
          <path d="M45 180 L185 120 L425 132 L300 157 L425 192 L185 197 Z" fill="#d4d7db" />
          <path d="M185 120 L185 197 M300 157 L245 190 L220 185 L250 160 Z" stroke="#81878f" fill="none" strokeWidth={5} />
        </>
      )
    case 'Ship':
      return (
        <>
          <path d="M55 188 L105 130 L325 128 L432 177 L370 197 L120 200 Z" fill="#e1e4e8" />
          <path d="M142 128 L160 91 L215 91 L220 128 M258 128 L267 73 L290 73 L294 128" stroke="#9198a0" fill="none" strokeWidth={7} />
        </>
      )
    case 'Pipe':
      return (
        <>
          <rect x={72} y={135} width={355} height={38} rx={18} fill="#d8dce1" />
          <path d="M80 130 L80 178 M160 130 L160 178 M240 130 L240 178 M320 130 L320 178 M400 130 L400 178" stroke="#7f858d" strokeWidth={7} />
        </>
      )
    case 'Mine':
      return (
        <>
          <circle cx={255} cy={154} r={55} fill="#d2d6dc" />
          <g stroke="#959ca4" strokeWidth={8}>
            <path d="M255 88 L255 52 M255 220 L255 190 M189 154 L152 154 M358 154 L321 154 M207 106 L179 78 M303 106 L331 78 M207 202 L177 230 M303 202 L333 230" />
          </g>
        </>
      )
    case 'Tire':
      return (
        <>
          <g fill="none" stroke="#d9dde2" strokeWidth={26}>
            <ellipse cx={170} cy={145} rx={62} ry={54} />
            <ellipse cx={325} cy={168} rx={65} ry={55} />
            <ellipse cx={242} cy={94} rx={55} ry={45} />
          </g>
          <g stroke="#777e87" strokeWidth={4}>
            <path d="M120 117 L210 170 M275 140 L370 193 M210 63 L272 126" />
          </g>
        </>
      )
    case 'Mound':
      return <path d="M55 185 C90 165 132 120 200 140 C255 90 310 110 352 142 C388 117 420 144 455 189 Z" fill="#d6d9dd" />
    case 'Platform':
      return (
        <>
          <rect x={102} y={83} width={306} height={26} fill="#e2e5e9" />
          <path d="M125 109 L145 195 M198 109 L215 195 M316 109 L297 195 M390 109 L368 195" stroke="#a0a6ad" strokeWidth={11} />
          <path d="M160 65 L160 83 M250 52 L250 83 M336 60 L336 83" stroke="#d6dae0" strokeWidth={8} />
        </>
      )
    case 'Mannequin':
      return (
        <>
          <circle cx={145} cy={110} r={23} fill="#d9dde1" />
          <rect x={128} y={133} width={88} height={58} rx={22} transform="rotate(-13 172 161)" fill="#d9dde1" />
          <path
            d="M142 143 L86 184 M188 142 L236 179 M179 185 L127 222 M178 185 L232 220"
            stroke="#d9dde1"
            strokeWidth={16}
            strokeLinecap="round"
          />
        </>
      )
    case 'Sea Grass':
      return (
        <g stroke="#cdd3d8" strokeWidth={3} fill="none">
          {Array.from({ length: 26 }, (_, i) => {
            const x = 30 + i * 18
            const h = 35 + ((i * 13) % 55)
            return <path key={i} d={`M${x} 205 C${x - 7} ${205 - h / 2} ${x + 10} ${205 - h} ${x + 2} ${205 - h}`} />
          })}
        </g>
      )
    case 'Mud':
      return <path d="M28 182 C110 176 140 184 220 180 C300 175 355 188 458 179 L458 215 L28 215 Z" fill="#9aa1aa" />
    case 'Rock':
      return (
        <path
          d="M60 185 L90 125 L148 93 L210 112 L244 76 L300 101 L353 84 L407 123 L450 145 L415 195 L320 190 L240 210 L155 198 Z"
          fill="#d1d5db"
        />
      )
    case 'Ghost Net':
    default:
      return (
        <g stroke="#d8dce1" strokeWidth={3} fill="none">
          {Array.from({ length: 11 }, (_, i) => {
            const y = 60 + i * 13
            return <path key={i} d={`M${55 + i * 10} ${y} C160 ${y + 20} 305 ${y - 22} ${430 - i * 7} ${y + 8}`} />
          })}
        </g>
      )
  }
}

/**
 * Procedural "side-scan sonar view" panel ported from the reference dashboard's sonarSVG() - a
 * fixed silhouette per class (not a real capture) rendered on a scanline background, with a dark
 * acoustic-shadow ellipse whose position/size is nudged by that record's contrast/shadow values.
 */
export function SonarRecordSVG({ cls, record, className }: { cls: ClassName; record: SyntheticRecord; className?: string }) {
  const col = MODEL_COLORS[cls] || '#00E5FF'
  const contrast = Math.max(1, Math.abs(Number(record.target_contrast_db) || 5))
  const shadow = Math.max(18, Math.min(105, Number(record.shadow_length_m) || 35))
  const filterId = `glow-${cls.replace(/\W/g, '')}`

  return (
    <svg viewBox="0 0 500 230" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation={2} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="scan" x1="0" x2="1">
          <stop offset="0" stopColor="#0a0f16" />
          <stop offset="0.5" stopColor="#1b2533" />
          <stop offset="1" stopColor="#080e17" />
        </linearGradient>
      </defs>
      <rect width={500} height={230} fill="url(#scan)" />
      <rect width={500} height={230} fill={col} opacity={0.035} />
      <g opacity={0.14} stroke="#fff">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M0 ${15 + i * 22} L500 ${15 + i * 22}`} />
        ))}
      </g>
      <g filter={`url(#${filterId})`}>
        <ClassShape cls={cls} />
      </g>
      <path d="M50 190 L430 190" stroke="#fff" strokeWidth={3} opacity={0.17} />
      <ellipse
        cx={335 + ((contrast * 7) % 55)}
        cy={184 - ((contrast * 3) % 20)}
        rx={shadow}
        ry={16 + shadow / 6}
        fill="#000"
        opacity={0.72}
      />
    </svg>
  )
}
