'use client'

import { useCallback, useMemo, useState } from 'react'

export const ADMIN_PAGE_SIZES = [25, 50, 100] as const
export type AdminPageSize = (typeof ADMIN_PAGE_SIZES)[number]

export function useAdminPagination(initialPageSize: AdminPageSize = 25) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<AdminPageSize>(initialPageSize)

  const resetPage = useCallback(() => setPage(1), [])

  const paginationParams = useMemo(
    () => ({ page, limit: pageSize }),
    [page, pageSize],
  )

  const handlePageSizeChange = useCallback((size: AdminPageSize) => {
    setPageSize(size)
    setPage(1)
  }, [])

  return {
    page,
    pageSize,
    setPage,
    setPageSize: handlePageSizeChange,
    resetPage,
    paginationParams,
  }
}

export function getPaginationRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)
  return { from, to, totalPages }
}
