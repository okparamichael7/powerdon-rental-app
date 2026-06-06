'use client'

import { useEffect, useState } from 'react'
import {
  AdminDrawer,
  AdminDrawerFooter,
  AdminDrawerFormBody,
  AdminDrawerFormField,
  AdminDrawerFormRow,
  AdminDrawerFormSection,
  AdminDrawerHeader,
} from '@/components/admin/admin-drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { AdminHardwareUnit } from '@/lib/mappers/hardware-mappers'

const HARDWARE_TYPES = [
  { value: 'power_bank_cabinet', label: 'Power Bank Cabinet' },
  { value: 'charging_station', label: 'Charging Station' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'other', label: 'Other' },
]

export type StationFormValues = {
  name: string
  externalId: string
  hardwareType: string
  description: string
  location: string
  totalSlots: number
  status: string
  qrReference: string
  externalServiceRef: string
  notes: string
  isEnabled: boolean
}

const EMPTY_FORM: StationFormValues = {
  name: '',
  externalId: '',
  hardwareType: 'power_bank_cabinet',
  description: '',
  location: '',
  totalSlots: 12,
  status: 'offline',
  qrReference: '',
  externalServiceRef: '',
  notes: '',
  isEnabled: true,
}

function hardwareToForm(h: AdminHardwareUnit): StationFormValues {
  return {
    name: h.name,
    externalId: h.externalId ?? '',
    hardwareType: h.hardwareType ?? 'power_bank_cabinet',
    description: h.description ?? '',
    location: h.location,
    totalSlots: h.totalSlots,
    status: h.status === 'low-battery' ? 'low_battery' : h.status,
    qrReference: h.qrReference ?? '',
    externalServiceRef: h.externalServiceRef ?? '',
    notes: h.notes ?? '',
    isEnabled: h.isEnabled,
  }
}

export function StationFormDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initial?: AdminHardwareUnit | null
  onSubmit: (values: StationFormValues) => Promise<{ ok: boolean; error?: string; blockers?: string[] }>
}) {
  const [form, setForm] = useState<StationFormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setForm(initial ? hardwareToForm(initial) : EMPTY_FORM)
      setFormError(null)
      setBlockers([])
    }
  }, [open, initial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setBlockers([])
    const result = await onSubmit(form)
    if (result.ok) {
      onOpenChange(false)
    } else {
      setFormError(result.error ?? 'Failed to save')
      if (result.blockers?.length) setBlockers(result.blockers)
    }
    setSubmitting(false)
  }

  return (
    <AdminDrawer open={open} onOpenChange={onOpenChange} size="form">
      <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
        <AdminDrawerHeader
          title={mode === 'create' ? 'Add Hardware' : 'Edit Hardware'}
          description={
            mode === 'create'
              ? 'Register a new hardware unit. Slots are created automatically.'
              : 'Update hardware metadata. Slot count changes are validated against active rentals.'
          }
        />

        <AdminDrawerFormBody>
          <AdminDrawerFormSection title="Hardware details" bordered={false}>
            <AdminDrawerFormField label="Display name" htmlFor="hw-name">
              <Input
                id="hw-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </AdminDrawerFormField>

            <AdminDrawerFormRow>
              <AdminDrawerFormField label="Serial / identifier" htmlFor="hw-external">
                <Input
                  id="hw-external"
                  required
                  disabled={mode === 'edit' && Boolean(initial?.externalId)}
                  value={form.externalId}
                  onChange={(e) => setForm((f) => ({ ...f, externalId: e.target.value }))}
                  placeholder="e.g. IMEI or ProductSn"
                />
              </AdminDrawerFormField>

              <AdminDrawerFormField label="Hardware type" htmlFor="hw-type">
                <Select
                  value={form.hardwareType}
                  onValueChange={(v) => setForm((f) => ({ ...f, hardwareType: v }))}
                >
                  <SelectTrigger id="hw-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HARDWARE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdminDrawerFormField>
            </AdminDrawerFormRow>

            <AdminDrawerFormField label="Location" htmlFor="hw-location">
              <Input
                id="hw-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </AdminDrawerFormField>
          </AdminDrawerFormSection>

          <AdminDrawerFormSection title="Configuration">
            <AdminDrawerFormRow>
              <AdminDrawerFormField label="Number of slots" htmlFor="hw-slots">
                <Input
                  id="hw-slots"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={form.totalSlots}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalSlots: Number(e.target.value) || 1 }))
                  }
                />
              </AdminDrawerFormField>

              <AdminDrawerFormField label="Status" htmlFor="hw-status">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger id="hw-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="low_battery">Low Battery</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </AdminDrawerFormField>
            </AdminDrawerFormRow>
          </AdminDrawerFormSection>

          <AdminDrawerFormSection title="Additional info">
            <AdminDrawerFormField label="Description" htmlFor="hw-desc">
              <Textarea
                id="hw-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="QR reference" htmlFor="hw-qr">
              <Input
                id="hw-qr"
                value={form.qrReference}
                onChange={(e) => setForm((f) => ({ ...f, qrReference: e.target.value }))}
                placeholder="External QR batch ID or print reference"
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="External service reference" htmlFor="hw-ext">
              <Input
                id="hw-ext"
                value={form.externalServiceRef}
                onChange={(e) => setForm((f) => ({ ...f, externalServiceRef: e.target.value }))}
                placeholder="Provider dashboard link or device ID"
              />
            </AdminDrawerFormField>

            <AdminDrawerFormField label="Notes" htmlFor="hw-notes">
              <Textarea
                id="hw-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </AdminDrawerFormField>
          </AdminDrawerFormSection>

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          {blockers.length > 0 && (
            <ul className="list-inside list-disc text-sm text-destructive">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </AdminDrawerFormBody>

        <AdminDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner className="mr-2 size-4" />}
            {mode === 'create' ? 'Create hardware' : 'Save changes'}
          </Button>
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  )
}
