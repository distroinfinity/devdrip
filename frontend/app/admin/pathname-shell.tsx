"use client"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"

interface Props {
  systemStateReadout: ReactNode
  children: ReactNode
}

export function AdminPathnameShell({ systemStateReadout, children }: Props) {
  const pathname = usePathname()
  return (
    <AdminShell pathname={pathname} systemStateReadout={systemStateReadout}>
      {children}
    </AdminShell>
  )
}
