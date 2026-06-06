import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { schemas } from '@/lib/security/validation'

describe('hardware admin validation schemas', () => {
  it('createStation requires name, externalId, and totalSlots', () => {
    const ok = schemas.createStation.safeParse({
      name: 'Lobby Unit A',
      externalId: 'SN12345678',
      totalSlots: 12,
    })
    assert.equal(ok.success, true)

    const bad = schemas.createStation.safeParse({
      name: '',
      externalId: 'bad id!',
      totalSlots: 0,
    })
    assert.equal(bad.success, false)
  })

  it('updateStationAdmin rejects empty patch', () => {
    const empty = schemas.updateStationAdmin.safeParse({})
    assert.equal(empty.success, false)

    const ok = schemas.updateStationAdmin.safeParse({ totalSlots: 8 })
    assert.equal(ok.success, true)
  })

  it('updateStationSlot accepts status changes', () => {
    const ok = schemas.updateStationSlot.safeParse({
      status: 'disabled',
      label: 'Bay 3',
    })
    assert.equal(ok.success, true)
  })

  it('accepts slot number up to MAX_STATION_SLOTS for rental start', () => {
    const ok = schemas.rentalStartPublic.safeParse({
      stationId: '00000000-0000-4000-8000-000000000099',
      userEmail: 'test@example.com',
      slotNumber: 24,
    })
    assert.equal(ok.success, true)
  })

  it('slot count max is 100 per schema', () => {
    const ok = schemas.createStation.safeParse({
      name: 'Big rack',
      externalId: 'RACK0001',
      totalSlots: 100,
    })
    assert.equal(ok.success, true)

    const over = schemas.createStation.safeParse({
      name: 'Too big',
      externalId: 'RACK0002',
      totalSlots: 101,
    })
    assert.equal(over.success, false)
  })
})
