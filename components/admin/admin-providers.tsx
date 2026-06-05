'use client'

import { Toaster } from '@/components/ui/sonner'
import { AdminCommandPalette } from '@/components/admin/admin-command-palette'

export function AdminProviders({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <>
      <Toaster richColors closeButton position="bottom-right" />
      <AdminCommandPalette isAdmin={isAdmin} />
    </>
  )
}

export { toast } from 'sonner'
