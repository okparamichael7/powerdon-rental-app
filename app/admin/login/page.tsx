import { Suspense } from 'react'
import { AdminLoginForm } from './admin-login-form'
import { Spinner } from '@/components/ui/spinner'

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  )
}
