import type { PaymentStatus, SessionStatus } from '@/lib/db/types'

export type LifecycleEvent =
  | 'reserve'
  | 'pay'
  | 'activate'
  | 'extend'
  | 'return'
  | 'complete'
  | 'cancel'
  | 'refund'
  | 'expire'
  | 'fail'
  | 'dispute'

const SESSION_TRANSITIONS: Record<SessionStatus, Partial<Record<LifecycleEvent, SessionStatus>>> = {
  pending: {
    activate: 'active',
    cancel: 'cancelled',
    expire: 'expired',
    fail: 'failed',
  },
  active: {
    extend: 'active',
    return: 'active',
    complete: 'completed',
    fail: 'failed',
  },
  completed: {},
  expired: {},
  failed: {},
  cancelled: {},
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['authorized', 'failed', 'cancelled'],
  authorized: ['captured', 'cancelled', 'failed'],
  captured: ['refunded'],
  refunded: [],
  failed: [],
  cancelled: [],
}

export function canTransitionSession(
  from: SessionStatus,
  event: LifecycleEvent,
): SessionStatus | null {
  return SESSION_TRANSITIONS[from][event] ?? null
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminalSessionStatus(status: SessionStatus): boolean {
  return status === 'completed' || status === 'expired' || status === 'failed' || status === 'cancelled'
}

/** Reserved slots must not accept a second concurrent rental start. */
export function canReserveSlot(currentSlotStatus: string): boolean {
  return currentSlotStatus === 'occupied'
}

export function slotBlocksConcurrentStart(slotStatusAfterReserve: string): boolean {
  return slotStatusAfterReserve === 'reserved'
}
