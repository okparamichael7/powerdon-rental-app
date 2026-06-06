'use client'

import { useCallback, useState } from 'react'
import type { AdminHardwareUnit } from '@/lib/mappers/hardware-mappers'

export interface HardwareListFilters {
  search?: string
  status?: string
  hardwareType?: string
  includeArchived?: boolean
}

export function useHardwareAdmin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listHardware = useCallback(async (filters?: HardwareListFilters) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters?.search) params.set('search', filters.search)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.hardwareType) params.set('hardwareType', filters.hardwareType)
      if (filters?.includeArchived) params.set('includeArchived', 'true')

      const res = await fetch(`/api/admin/stations?${params}`, { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load hardware')
        return null
      }
      return (body.data ?? []) as AdminHardwareUnit[]
    } catch {
      setError('Network error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createHardware = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    return { ok: res.ok, data: body.data, error: body.error, code: body.code }
  }, [])

  const updateHardware = useCallback(async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/stations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    return {
      ok: res.ok,
      data: body.data,
      error: body.error,
      code: body.code,
      blockers: body.blockers as string[] | undefined,
    }
  }, [])

  const archiveHardware = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/stations/${id}/archive`, {
      method: 'POST',
      credentials: 'include',
    })
    const body = await res.json()
    return { ok: res.ok, data: body.data, error: body.error, code: body.code }
  }, [])

  const deleteHardware = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/stations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const body = await res.json()
    return {
      ok: res.ok,
      error: body.error,
      code: body.code,
      blockers: body.blockers as Array<{ code: string; message: string }> | undefined,
    }
  }, [])

  const getHardwareDetail = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/stations/${id}/detail`, { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load detail')
        return null
      }
      return body.data
    } catch {
      setError('Network error')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSlot = useCallback(
    async (stationId: string, slotNumber: number, payload: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/stations/${stationId}/slots/${slotNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      return { ok: res.ok, data: body.data, error: body.error, code: body.code }
    },
    [],
  )

  const restoreHardware = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/stations/${id}/restore`, {
      method: 'POST',
      credentials: 'include',
    })
    const body = await res.json()
    return { ok: res.ok, data: body.data, error: body.error, code: body.code }
  }, [])

  const createMaintenanceRecord = useCallback(
    async (stationId: string, payload: { title: string; description?: string; slotNumber?: number }) => {
      const res = await fetch(`/api/admin/stations/${stationId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      return { ok: res.ok, data: body.data, error: body.error, code: body.code }
    },
    [],
  )

  return {
    loading,
    error,
    setError,
    listHardware,
    createHardware,
    updateHardware,
    archiveHardware,
    deleteHardware,
    getHardwareDetail,
    updateSlot,
    restoreHardware,
    createMaintenanceRecord,
  }
}
