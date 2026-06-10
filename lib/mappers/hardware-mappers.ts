import type { StationWithSlots } from '@/lib/db/station-repository'
import type { DbHardwareAuditLog } from '@/lib/db/hardware-audit-repository'
import type { DbStationSlot } from '@/lib/db/types'
import { mapStationFromDb } from '@/lib/mappers/domain-mappers'

export interface AdminHardwareUnit {
  id: string
  name: string
  externalId: string | null
  hardwareType: string | null
  description: string | null
  location: string
  status: string
  totalSlots: number
  availableSlots: number
  occupiedSlots: number
  isEnabled: boolean
  archivedAt: string | null
  qrReference: string | null
  externalServiceRef: string | null
  notes: string | null
  campaignId: string | null
  lastHeartbeat: string | null
  createdAt: string
  updatedAt: string
  qrUrl: string
}

export interface AdminHardwareSlot {
  id: string
  slotNumber: number
  label: string | null
  status: string
  powerBankId: string | null
  batteryLevel: number | null
  isCharging: boolean
  errorMessage: string | null
  lastStatusChange: string
}

export function mapAdminHardwareFromDb(
  station: StationWithSlots,
  appOrigin: string,
): AdminHardwareUnit {
  const base = mapStationFromDb(station)
  return {
    id: station.id,
    name: station.name,
    externalId: station.external_id,
    hardwareType: station.hardware_type ?? 'power_bank_cabinet',
    description: station.description ?? null,
    location: station.location ?? '',
    status: base.status,
    totalSlots: station.total_slots,
    availableSlots: station.available_slots,
    occupiedSlots: station.occupied_slots,
    isEnabled: station.is_enabled,
    archivedAt: station.archived_at ?? null,
    qrReference: station.qr_reference ?? null,
    externalServiceRef: station.external_service_ref ?? null,
    notes: station.notes ?? null,
    campaignId: station.campaign_id ?? null,
    lastHeartbeat: station.last_heartbeat,
    createdAt: station.created_at,
    updatedAt: station.updated_at,
    qrUrl: `${appOrigin.replace(/\/$/, '')}/?station=${station.id}`,
  }
}

function slotTerminalId(slot: DbStationSlot): string | null {
  const meta = slot.metadata as { terminal_external_id?: string } | null
  return meta?.terminal_external_id ?? slot.power_bank_id
}

export function mapAdminSlotFromDb(slot: DbStationSlot): AdminHardwareSlot {
  return {
    id: slot.id,
    slotNumber: slot.slot_number,
    label: slot.label ?? null,
    status: slot.status,
    powerBankId: slotTerminalId(slot),
    batteryLevel: slot.battery_level,
    isCharging: slot.is_charging,
    errorMessage: slot.error_message,
    lastStatusChange: slot.last_status_change,
  }
}

export function mapHardwareAuditEntry(entry: DbHardwareAuditLog) {
  return {
    id: entry.id,
    action: entry.action,
    slotNumber: entry.slot_number,
    details: entry.details,
    actorId: entry.actor_auth_user_id,
    createdAt: entry.created_at,
  }
}
