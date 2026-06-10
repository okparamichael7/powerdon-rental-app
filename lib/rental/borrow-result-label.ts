import { BorrowResult } from '@/lib/wscharge/protocol'

export function borrowResultLabel(code: number): string {
  if (code === BorrowResult.SUCCESS) return 'success'
  if (code === BorrowResult.FAILURE) {
    return 'cabinet refused eject (slot empty, jammed, or unavailable)'
  }
  return `unknown result ${code}`
}
