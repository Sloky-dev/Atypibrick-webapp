import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi, clearSession } from '../api'
import type { User } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const login = useCallback((value: User | null) => { generation.current++; setUser(value) }, [])
  useEffect(() => {
    const current = ++generation.current
    void authApi.me().then((value) => { if (current === generation.current) setUser(value) }).catch(() => { if (current === generation.current) clearSession() }).finally(() => { if (current === generation.current) setLoading(false) })
    const expired = () => { generation.current++; setUser(null); setLoading(false) }
    window.addEventListener('atypibrick:unauthorized', expired)
    return () => { generation.current++; window.removeEventListener('atypibrick:unauthorized', expired) }
  }, [])
  const logout = useCallback(async () => { try { await authApi.logout() } catch { /* Clear the local session even if the server is unavailable. */ } finally { clearSession(); login(null) } }, [login])
  return { user, loading, login, logout }
}
