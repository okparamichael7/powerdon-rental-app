'use client'

import * as React from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

/** Native-style bottom sheet for secondary flows (tips, confirmations, pickers). */
export function PwaBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('max-h-[85vh]', className)}>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-sm">{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">{children}</div>
        {footer ? <DrawerFooter className="pt-2">{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  )
}
