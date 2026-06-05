'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export const ADMIN_THEME_STORAGE_KEY = 'powerdon-admin-theme'

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={ADMIN_THEME_STORAGE_KEY}
      disableTransitionOnChange
      themes={['light', 'dark']}
    >
      {children}
    </NextThemesProvider>
  )
}
