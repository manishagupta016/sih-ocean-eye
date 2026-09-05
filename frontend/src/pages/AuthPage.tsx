import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMe, login, register } from '@/api/auth'
import { getApiErrorMessage } from '@/api/client'
import type { UserRole } from '@/api/types'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/auth'

export function AuthPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [tab, setTab] = useState<'login' | 'signup'>('login')

  const [loginEmail, setLoginEmail] = useState('operator@sonarintel.demo')
  const [loginPassword, setLoginPassword] = useState('ChangeMe123!')

  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupRole, setSignupRole] = useState<UserRole>('operator')

  async function completeSession(tokens: { access_token: string; refresh_token: string }) {
    useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token)
    const user = await fetchMe()
    setSession(user, tokens.access_token, tokens.refresh_token)
    navigate('/dashboard')
  }

  const loginMutation = useMutation({
    mutationFn: () => login(loginEmail, loginPassword),
    onSuccess: completeSession,
    onError: (err) => toast('Login failed', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  const signupMutation = useMutation({
    mutationFn: () =>
      register({ name: signupName, email: signupEmail, password: signupPassword, role: signupRole }),
    onSuccess: completeSession,
    onError: (err) => toast('Registration failed', { description: getApiErrorMessage(err), variant: 'destructive' }),
  })

  function handleLogin(e: FormEvent) {
    e.preventDefault()
    loginMutation.mutate()
  }

  function handleSignup(e: FormEvent) {
    e.preventDefault()
    signupMutation.mutate()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <Logo size="lg" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Demo: operator@sonarintel.demo / ChangeMe123!
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4" onSubmit={handleSignup}>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name">Full name</Label>
                    <Input id="signup-name" required value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={8}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-role">Role</Label>
                    <Select value={signupRole} onValueChange={(v) => setSignupRole(v as UserRole)}>
                      <SelectTrigger id="signup-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
                    {signupMutation.isPending ? 'Creating account…' : 'Create account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
