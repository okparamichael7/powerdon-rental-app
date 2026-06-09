import { stationRepository } from '@/lib/db/station-repository'
import { sessionRepository } from '@/lib/db/session-repository'
import { hardwareAuditRepository } from '@/lib/db/hardware-audit-repository'
import { compactRecord } from '@/lib/db/schema-compat'
import type { DbStation, DbStationSlot, SlotStatus, StationStatus } from '@/lib/db/types'

export interface CreateHardwareInput {
  name: string
  externalId: string
  hardwareType?: string
  description?: string
  location?: string
  totalSlots: number
  status?: StationStatus
  qrReference?: string
  externalServiceRef?: string
  notes?: string
  campaignId?: string
  isEnabled?: boolean
}

export interface UpdateHardwareInput {
  name?: string
  externalId?: string
  hardwareType?: string
  description?: string
  location?: string
  totalSlots?: number
  status?: StationStatus
  qrReference?: string
  externalServiceRef?: string
  notes?: string
  campaignId?: string | null
  isEnabled?: boolean
}

export interface UpdateSlotInput {
  label?: string
  status?: SlotStatus
  errorMessage?: string
}

export interface HardwareDeletionBlocker {
  code: string
  message: string
}

const ACTIVE_SLOT_STATUSES: SlotStatus[] = ['reserved']

export class HardwareAdminService {
  async createHardware(actorId: string, input: CreateHardwareInput): Promise<DbStation> {
    const existing = await stationRepository.getByExternalId(input.externalId)
    if (existing) {
      throw new HardwareAdminError('DUPLICATE_EXTERNAL_ID', 'A station with this identifier already exists')
    }

    if (input.totalSlots < 1 || input.totalSlots > 100) {
      throw new HardwareAdminError('INVALID_SLOT_COUNT', 'Slot count must be between 1 and 100')
    }

    const station = await stationRepository.createWithSlots(
      compactRecord({
        external_id: input.externalId,
        device_id: input.externalId,
        name: input.name,
        location: input.location,
        description: input.description,
        hardware_type: input.hardwareType ?? 'power_bank_cabinet',
        status: input.status ?? 'offline',
        total_slots: input.totalSlots,
        qr_reference: input.qrReference,
        external_service_ref: input.externalServiceRef,
        notes: input.notes,
        campaign_id: input.campaignId,
        is_enabled: input.isEnabled ?? true,
        created_by: actorId,
        updated_by: actorId,
        settings: {},
        metadata: {},
      }) as Parameters<typeof stationRepository.createWithSlots>[0],
      input.totalSlots,
    )

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId: station.id,
      action: 'hardware.create',
      details: {
        name: station.name,
        externalId: station.external_id,
        totalSlots: station.total_slots,
      },
    })

    return station
  }

  async updateHardware(
    actorId: string,
    stationId: string,
    input: UpdateHardwareInput,
  ): Promise<{ station: DbStation; slotCountChange?: { added: number } | { blocked: string[] } }> {
    const existing = await stationRepository.getById(stationId)
    if (!existing) {
      throw new HardwareAdminError('NOT_FOUND', 'Station not found')
    }
    if (existing.archived_at) {
      throw new HardwareAdminError('ARCHIVED', 'Cannot update archived hardware. Restore it first.')
    }

    if (input.externalId && input.externalId !== existing.external_id) {
      const duplicate = await stationRepository.getByExternalId(input.externalId)
      if (duplicate && duplicate.id !== stationId) {
        throw new HardwareAdminError('DUPLICATE_EXTERNAL_ID', 'Another station uses this identifier')
      }
    }

    let slotCountChange: { added: number } | { blocked: string[] } | undefined

    if (input.totalSlots !== undefined && input.totalSlots !== existing.total_slots) {
      slotCountChange = await this.adjustSlotCount(actorId, stationId, input.totalSlots, existing)
    }

    const updates: Record<string, unknown> = { updated_by: actorId }
    if (input.name !== undefined) updates.name = input.name
    if (input.externalId !== undefined) {
      updates.external_id = input.externalId
      updates.device_id = input.externalId
    }
    if (input.hardwareType !== undefined) updates.hardware_type = input.hardwareType
    if (input.description !== undefined) updates.description = input.description
    if (input.location !== undefined) updates.location = input.location
    if (input.status !== undefined) updates.status = input.status
    if (input.qrReference !== undefined) updates.qr_reference = input.qrReference
    if (input.externalServiceRef !== undefined) updates.external_service_ref = input.externalServiceRef
    if (input.notes !== undefined) updates.notes = input.notes
    if (input.campaignId !== undefined) updates.campaign_id = input.campaignId
    if (input.isEnabled !== undefined) updates.is_enabled = input.isEnabled
    if (input.totalSlots !== undefined && !('blocked' in (slotCountChange ?? {}))) {
      updates.total_slots = input.totalSlots
    }

    const station = await stationRepository.update(stationId, updates)

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      action: 'hardware.update',
      details: { changes: input, slotCountChange },
    })

    return { station, slotCountChange }
  }

  async adjustSlotCount(
    actorId: string,
    stationId: string,
    newCount: number,
    existing?: Awaited<ReturnType<typeof stationRepository.getById>>,
  ): Promise<{ added: number } | { blocked: string[] }> {
    const station = existing ?? (await stationRepository.getById(stationId))
    if (!station) throw new HardwareAdminError('NOT_FOUND', 'Station not found')

    if (newCount < 1 || newCount > 100) {
      throw new HardwareAdminError('INVALID_SLOT_COUNT', 'Slot count must be between 1 and 100')
    }

    const currentCount = station.total_slots

    if (newCount > currentCount) {
      const added = await stationRepository.addSlots(stationId, currentCount, newCount)
      await stationRepository.update(stationId, { total_slots: newCount, updated_by: actorId })
      await hardwareAuditRepository.log({
        actorAuthUserId: actorId,
        stationId,
        action: 'hardware.slot_count.increase',
        details: { from: currentCount, to: newCount, added },
      })
      return { added }
    }

    if (newCount < currentCount) {
      const blockers = await stationRepository.getSlotReductionBlockers(stationId, newCount)
      if (blockers.length > 0) {
        await hardwareAuditRepository.log({
          actorAuthUserId: actorId,
          stationId,
          action: 'hardware.slot.remove_blocked',
          details: { from: currentCount, to: newCount, blockers },
        })
        return { blocked: blockers }
      }

      const removed = await stationRepository.removeSlotsAbove(stationId, newCount)
      await stationRepository.update(stationId, { total_slots: newCount, updated_by: actorId })
      await hardwareAuditRepository.log({
        actorAuthUserId: actorId,
        stationId,
        action: 'hardware.slot_count.decrease',
        details: { from: currentCount, to: newCount, removed },
      })
      return { added: -removed }
    }

    return { added: 0 }
  }

  async updateSlot(
    actorId: string,
    stationId: string,
    slotNumber: number,
    input: UpdateSlotInput,
  ): Promise<DbStationSlot> {
    const station = await stationRepository.getById(stationId)
    if (!station) throw new HardwareAdminError('NOT_FOUND', 'Station not found')
    if (station.archived_at) throw new HardwareAdminError('ARCHIVED', 'Cannot modify slots on archived hardware')

    const slot = await stationRepository.getSlot(stationId, slotNumber)
    if (!slot) throw new HardwareAdminError('SLOT_NOT_FOUND', `Slot ${slotNumber} not found`)

    if (input.status && ACTIVE_SLOT_STATUSES.includes(input.status)) {
      // reserved is set by rental flow only
    }

    if (input.status === 'empty' && slot.status === 'reserved') {
      const activeOnSlot = await stationRepository.countActiveRentalsForSlot(stationId, slotNumber)
      if (activeOnSlot > 0) {
        throw new HardwareAdminError(
          'SLOT_IN_USE',
          'Cannot mark slot empty while an active rental uses it',
        )
      }
    }

    const updated = await stationRepository.updateSlot(stationId, slotNumber, {
      label: input.label,
      status: input.status,
      error_message: input.errorMessage,
    })

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      slotNumber,
      action: 'hardware.slot.update',
      details: { ...input },
    })

    return updated
  }

  async archiveHardware(actorId: string, stationId: string): Promise<DbStation> {
    const station = await stationRepository.getById(stationId)
    if (!station) throw new HardwareAdminError('NOT_FOUND', 'Station not found')
    if (station.archived_at) {
      throw new HardwareAdminError('ALREADY_ARCHIVED', 'Hardware is already archived')
    }

    const activeRentals = await stationRepository.countActiveRentals(stationId)
    if (activeRentals > 0) {
      throw new HardwareAdminError(
        'ACTIVE_RENTALS',
        `Cannot archive: ${activeRentals} active rental(s) in progress`,
      )
    }

    const archived = await stationRepository.archive(stationId, actorId)

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      action: 'hardware.archive',
      details: { name: station.name },
    })

    return archived
  }

  async restoreHardware(actorId: string, stationId: string): Promise<DbStation> {
    const station = await stationRepository.getById(stationId)
    if (!station) throw new HardwareAdminError('NOT_FOUND', 'Station not found')
    if (!station.archived_at) {
      throw new HardwareAdminError('NOT_ARCHIVED', 'Hardware is not archived')
    }

    const restored = await stationRepository.restore(stationId, actorId)

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      action: 'hardware.restore',
      details: { name: station.name },
    })

    return restored
  }

  async createMaintenanceRecord(
    actorId: string,
    stationId: string,
    input: { title: string; description?: string; slotNumber?: number },
  ) {
    const station = await stationRepository.getById(stationId)
    if (!station) throw new HardwareAdminError('NOT_FOUND', 'Station not found')

    const record = await stationRepository.createMaintenanceRecord({
      stationId,
      title: input.title,
      description: input.description,
      slotNumber: input.slotNumber,
      reportedBy: actorId,
    })

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      slotNumber: input.slotNumber ?? null,
      action: 'hardware.maintenance.create',
      details: { title: input.title },
    })

    return record
  }

  async deleteHardware(actorId: string, stationId: string): Promise<void> {
    const blockers = await this.getDeletionBlockers(stationId)
    if (blockers.length > 0) {
      throw new HardwareAdminError(
        'DELETE_BLOCKED',
        blockers.map((b) => b.message).join('; '),
        blockers,
      )
    }

    const station = await stationRepository.getById(stationId)
    await stationRepository.delete(stationId)

    await hardwareAuditRepository.log({
      actorAuthUserId: actorId,
      stationId,
      action: 'hardware.delete',
      details: { name: station?.name, externalId: station?.external_id },
    })
  }

  async getDeletionBlockers(stationId: string): Promise<HardwareDeletionBlocker[]> {
    const station = await stationRepository.getById(stationId)
    if (!station) return [{ code: 'NOT_FOUND', message: 'Station not found' }]

    const blockers: HardwareDeletionBlocker[] = []

    const activeRentals = await stationRepository.countActiveRentals(stationId)
    if (activeRentals > 0) {
      blockers.push({
        code: 'ACTIVE_RENTALS',
        message: `${activeRentals} active rental(s) must complete before deletion`,
      })
    }

    const historicalRentals = await stationRepository.countHistoricalRentals(stationId)
    if (historicalRentals > 0) {
      blockers.push({
        code: 'HISTORICAL_RENTALS',
        message: `${historicalRentals} historical rental(s) exist — archive instead of delete`,
      })
    }

    const reservedSlots = (station.slots ?? []).filter((s) => s.status === 'reserved')
    if (reservedSlots.length > 0) {
      blockers.push({
        code: 'RESERVED_SLOTS',
        message: `${reservedSlots.length} slot(s) are reserved for checkout`,
      })
    }

    return blockers
  }

  async getHardwareDetail(stationId: string) {
    const station = await stationRepository.getById(stationId)
    if (!station) return null

    const [auditLog, maintenance, activeSessions, recentSessions, deletionBlockers] =
      await Promise.all([
        hardwareAuditRepository.listByStation(stationId, 30),
        stationRepository.listMaintenanceRecords(stationId),
        sessionRepository.getAll({
          stationId,
          status: ['pending', 'active'],
          limit: 20,
        }),
        sessionRepository.getAll({
          stationId,
          status: ['completed', 'cancelled', 'expired', 'failed'],
          limit: 10,
        }),
        this.getDeletionBlockers(stationId),
      ])

    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    return {
      station,
      auditLog,
      maintenance,
      activeSessions,
      recentSessions,
      deletionBlockers,
      qrUrl: `${appOrigin.replace(/\/$/, '')}/?station=${station.id}`,
    }
  }
}

export class HardwareAdminError extends Error {
  constructor(
    public code: string,
    message: string,
    public blockers?: HardwareDeletionBlocker[],
  ) {
    super(message)
    this.name = 'HardwareAdminError'
  }
}

export const hardwareAdminService = new HardwareAdminService()
