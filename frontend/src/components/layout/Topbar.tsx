import { useQuery } from '@tanstack/react-query'
import { Bell, LogOut, Moon, Sun, User as UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { listAlerts } from '@/api/alerts'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'

export function Topbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { mode, toggle } = useThemeStore()
  const navigate = useNavigate()

  const { data: alerts } = useQuery({
    queryKey: ['alerts', { acknowledged: false }],
    queryFn: () => listAlerts({ acknowledged: false }),
    refetchInterval: 30_000,
  })
  const unacknowledgedCount = alerts?.length ?? 0

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="text-sm text-muted">
        {user?.role === 'admin' ? 'Administrator' : 'Operator'} console
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/alerts')} aria-label="Alerts">
          <div className="relative">
            <Bell className="h-4 w-4" />
            {unacknowledgedCount > 0 && (
              <Badge
                variant="danger"
                className="absolute -right-2 -top-2 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {unacknowledgedCount}
              </Badge>
            )}
          </div>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-raised">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.name ?? 'Account'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <UserIcon className="h-4 w-4" /> Profile & settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
