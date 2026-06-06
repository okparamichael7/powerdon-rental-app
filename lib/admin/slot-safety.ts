import type { DbStationSlot, SlotStatus } from '@/lib/db/types'

export interface SlotRemovalContext {
  slot: Pick<DbStationSlot, 'slot_number' | 'status' | 'power_bank_id'>
  activeRentals: number
  historicalRentals: number
}

export function slotRemovalBlockers(ctx: SlotRemovalContext): string[] {
  const { slot, activeRentals, historicalRentals } = ctx
  const blockers: string[] = []

  if (slot.status === 'reserved') {
    blockers.push(`Slot ${slot.slot_number} is reserved for an active checkout`)
    return blockers
  }

  if (slot.status === 'occupied' && slot.power_bank_id) {
    blockers.push(`Slot ${slot.slot_number} still has a power bank assigned`)
  }

  if (activeRentals > 0) {
    blockers.push(`Slot ${slot.slot_number} has ${activeRentals} active rental(s)`)
  }

  if (historicalRentals > 0) {
    blockers.push(`Slot ${slot.slot_number} has ${historicalRentals} historical rental(s)`)
  }

  return blockers
}

export function slotsToRemove(
  slots: Array<Pick<DbStationSlot, 'slot_number'>>,
  newMaxSlot: number,
): number[] {
  return slots.filter((s) => s.slot_number > newMaxSlot).map((s) => s.slot_number)
}

export function isValidSlotStatusForAdminSet(status: SlotStatus): boolean {
  return ['empty', 'occupied', 'disabled', 'error'].includes(status)
}
