import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'destructive'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function toast(title: string, options?: { description?: string; variant?: ToastVariant }) {
  useToastStore.getState().push({ title, description: options?.description, variant: options?.variant ?? 'default' })
}

const VARIANT_ICON: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: 'border-border text-foreground',
  success: 'border-success/40 text-success',
  destructive: 'border-danger/40 text-danger',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = VARIANT_ICON[t.variant]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-surface-raised p-3 shadow-lg',
              VARIANT_CLASS[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
