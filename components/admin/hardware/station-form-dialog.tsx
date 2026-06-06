'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function StationFormDialog({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Hardware' : 'Edit Hardware'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Register a new hardware unit. Slots are created automatically.'
              : 'Update hardware metadata. Slot count changes are validated against active rentals.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-name">Display name</Label>
              <Input
                id="hw-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-external">Serial / identifier</Label>
              <Input
                id="hw-external"
                required
                disabled={mode === 'edit' && Boolean(initial?.externalId)}
                value={form.externalId}
                onChange={(e) => setForm((f) => ({ ...f, externalId: e.target.value }))}
                placeholder="e.g. IMEI or ProductSn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-type">Hardware type</Label>
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
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-location">Location</Label>
              <Input
                id="hw-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-slots">Number of slots</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-status">Status</Label>
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
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-desc">Description</Label>
              <Textarea
                id="hw-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-qr">QR reference</Label>
              <Input
                id="hw-qr"
                value={form.qrReference}
                onChange={(e) => setForm((f) => ({ ...f, qrReference: e.target.value }))}
                placeholder="External QR batch ID or print reference"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-ext">External service reference</Label>
              <Input
                id="hw-ext"
                value={form.externalServiceRef}
                onChange={(e) => setForm((f) => ({ ...f, externalServiceRef: e.target.value }))}
                placeholder="Provider dashboard link or device ID"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="hw-notes">Notes</Label>
              <Textarea
                id="hw-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner className="mr-2 size-4" />}
              {mode === 'create' ? 'Create hardware' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
