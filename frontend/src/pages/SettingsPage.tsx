import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, Moon, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { createApiKey, listApiKeys, revokeApiKey, updateMe } from '@/api/auth'
import { getApiErrorMessage } from '@/api/client'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { formatDateTime } from '@/lib/format'

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const { mode, toggle } = useThemeStore()
  const queryClient = useQueryClient()

  const [name, setName] = useState(user?.name ?? '')
  const [newKeyOpen, setNewKeyOpen] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const apiKeysQuery = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys })

  const updateNameMutation = useMutation({
    mutationFn: () => updateMe(name),
    onSuccess: (updated) => {
      setUser(updated)
      toast('Profile updated', { variant: 'success' })
    },
    onError: (err) => toast('Could not update profile', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey(newKeyLabel),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setCreatedKey(created.api_key)
      setNewKeyLabel('')
    },
    onError: (err) => toast('Could not create API key', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  const revokeKeyMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      toast('API key revoked', { variant: 'success' })
    },
  })

  return (
    <AppShell>
      <PageHeader title="Settings" description="Profile, API access, and display preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div>
                <Badge variant="outline">{user?.role === 'admin' ? 'Administrator' : 'Operator'}</Badge>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!name || name === user?.name || updateNameMutation.isPending}
              onClick={() => updateNameMutation.mutate()}
            >
              Save changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Toggle between the dark control-room theme and a light theme.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={toggle}>
              {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Switch to {mode === 'dark' ? 'light' : 'dark'} mode
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>API keys</CardTitle>
              <CardDescription>For programmatic report export via the REST API.</CardDescription>
            </div>
            <Dialog
              open={newKeyOpen}
              onOpenChange={(open) => {
                setNewKeyOpen(open)
                if (!open) setCreatedKey(null)
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <KeyRound className="h-4 w-4" /> New API key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API key</DialogTitle>
                </DialogHeader>
                {!createdKey ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-key-label">Label</Label>
                      <Input
                        id="new-key-label"
                        placeholder="e.g. reporting-script"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                      />
                    </div>
                    <DialogFooter>
                      <Button disabled={!newKeyLabel || createKeyMutation.isPending} onClick={() => createKeyMutation.mutate()}>
                        Create
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted">
                      Copy this key now - it won't be shown again.
                    </p>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised p-2">
                      <code className="flex-1 truncate text-xs">{createdKey}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(createdKey)
                          toast('Copied to clipboard', { variant: 'success' })
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {apiKeysQuery.isLoading && <SkeletonRows rows={2} />}
            {apiKeysQuery.isError && <ErrorState onRetry={() => apiKeysQuery.refetch()} />}
            {apiKeysQuery.data && apiKeysQuery.data.length === 0 && (
              <EmptyState title="No API keys yet" description="Create one to export reports programmatically." />
            )}
            <div className="space-y-2">
              {apiKeysQuery.data?.map((key) => (
                <div key={key.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{key.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {key.key_prefix}… · created {formatDateTime(key.created_at)}
                      {key.last_used_at && ` · last used ${formatDateTime(key.last_used_at)}`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => revokeKeyMutation.mutate(key.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
