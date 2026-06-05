'use client'

import { AdminThemeProvider } from '@/components/admin/admin-theme-provider'
import { AdminThemeToggle } from '@/components/admin/admin-theme-toggle'
import { Toaster } from '@/components/ui/sonner'

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminThemeProvider>
      <div className="relative min-h-screen">
        <div className="absolute right-4 top-4 z-10">
          <AdminThemeToggle />
        </div>
        {children}
      </div>
      <Toaster richColors closeButton position="bottom-right" />
    </AdminThemeProvider>
  )
}
