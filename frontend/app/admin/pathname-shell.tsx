"use client"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"

// strips the internal /admin prefix so AdminShell nav links compare against
// root-relative paths (e.g. /admin/sources → /sources)
function toAdminRelative(pathname: string): string {
  const stripped = pathname.replace(/^\/admin/, "")
  return stripped || "/"
}

interface Props {
  systemStateReadout: ReactNode
  children: ReactNode
}

export function AdminPathnameShell({ systemStateReadout, children }: Props) {
  const pathname = usePathname()
  return (
    <AdminShell pathname={toAdminRelative(pathname)} systemStateReadout={systemStateReadout}>
      {children}
    </AdminShell>
  )
}
