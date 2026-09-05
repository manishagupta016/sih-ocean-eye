import {
  AlertTriangle,
  BarChart3,
  FileText,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  Settings,
  UploadCloud,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Logo } from '@/components/common/Logo'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Data', icon: UploadCloud },
  { to: '/map', label: 'Map View', icon: MapIcon },
  { to: '/risk-list', label: 'Anomaly / Risk List', icon: ListChecks },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3 text-[11px] leading-tight text-muted-foreground">
        PS 26057 · MoES/NIOT
        <br />
        Marine debris decision support
      </div>
    </aside>
  )
}
