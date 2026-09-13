import { Check } from 'lucide-react'
import type { IngestStatus } from '@/api/types'
import { PIPELINE_STAGES } from '@/data/pipelineStages'
import { cn } from '@/lib/utils'

/** Compact "sonar interpretation pipeline" stepper - the real stages this file's job passed through. */
export function PipelineStrip({ status }: { status?: IngestStatus }) {
  const currentIndex = status ? PIPELINE_STAGES.findIndex((s) => s.statuses.includes(status)) : -1
  const failed = status === 'failed'

  return (
    <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface-raised/40 px-3 py-2.5 scrollbar-thin">
      {PIPELINE_STAGES.map((stage, i) => {
        const Icon = stage.icon
        const done = !failed && currentIndex >= 0 && (i < currentIndex || status === 'done')
        const active = !failed && i === currentIndex && status !== 'done'
        return (
          <div key={stage.key} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                active && 'bg-primary/15 text-primary',
                done && !active && 'text-success',
                !done && !active && 'text-muted-foreground',
              )}
              title={stage.description}
            >
              {done && !active ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="text-xs font-medium whitespace-nowrap">{stage.title}</span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        )
      })}
    </div>
  )
}
