import { cn } from '@/lib/utils'

export function ConfidenceBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'bg-danger' : pct >= 50 ? 'bg-tier-probable-debris' : pct >= 25 ? 'bg-warning' : 'bg-muted'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-raised border border-border">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted">{label ?? `${pct}%`}</span>
    </div>
  )
}
