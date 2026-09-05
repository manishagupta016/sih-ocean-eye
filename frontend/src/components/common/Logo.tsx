import { cn } from '@/lib/utils'

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const iconSize = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-14 w-14' }[size]
  const textSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-2xl' }[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src="/logo.png" alt="Ocean Eye" className={cn(iconSize, 'shrink-0 rounded-full object-cover')} />
      <span className={cn('font-semibold tracking-wide', textSize)}>OCEAN EYE</span>
    </div>
  )
}
