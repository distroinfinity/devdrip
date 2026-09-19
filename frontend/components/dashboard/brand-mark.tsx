import Link from "next/link"
import { Logomark } from "@distrotv/design-system/components/logomark"
import { Wordmark } from "@distrotv/design-system/components/wordmark"
import { VersionBadge } from "@distrotv/design-system/components/version-badge"

// matches landing inline-navbar: logomark + wordmark + version badge
export function BrandMark({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <Logomark />
      <Wordmark size="md" />
      <VersionBadge />
    </Link>
  )
}
