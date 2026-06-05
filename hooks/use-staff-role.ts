'use client'

import { useCallback, useEffect, useState } from 'react'

export type StaffRole = 'admin' | 'operator' | null

export function useStaffRole() {
  const [role, setRole] = useState<StaffRole>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/staff-check', { credentials: 'include' })
      if (!res.ok) {
        setRole(null)
        return
      }
      const body = await res.json()
      setRole(body.isStaff ? (body.role as StaffRole) : null)
    } catch {
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isOperator: role === 'operator',
    refresh,
  }
}
