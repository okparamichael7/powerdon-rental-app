'use client'

import { useCallback, useMemo, useState } from 'react'

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function useTableSort<T>(
  items: T[],
  defaultField: keyof T & string,
  defaultOrder: 'asc' | 'desc' = 'desc',
) {
  const [sortField, setSortField] = useState<string>(defaultField)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultOrder)

  const toggleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortOrder('desc')
      }
    },
    [sortField],
  )

  const sorted = useMemo(() => {
    const field = sortField as keyof T
    return [...items].sort((a, b) => {
      const cmp = compareValues(a[field], b[field])
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [items, sortField, sortOrder])

  return {
    sorted,
    sortField,
    sortOrder,
    toggleSort,
    isSorted: (field: string) => sortField === field,
  }
}
