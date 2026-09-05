import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  accent?: 'primary' | 'danger' | 'warning' | 'success'
  hint?: string
}) {
  const accentClass = {
    primary: 'text-primary bg-primary/10',
    danger: 'text-danger bg-danger/10',
    warning: 'text-warning bg-warning/10',
    success: 'text-success bg-success/10',
  }[accent ?? 'primary']

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
