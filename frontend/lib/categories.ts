// canonical category slugs + labels shown in the UI.
// keep in sync with AdCategory in @distrotv/shared. Defined as plain strings so
// client bundles don't pull the shared package's node-only imports.
export const CATEGORY_SLUGS = [
  "cloud-infrastructure",
  "developer-tools",
  "databases",
  "monitoring-observability",
  "developer-recruiting",
  "developer-education",
  "saas-products",
] as const

export type CategorySlug = (typeof CATEGORY_SLUGS)[number]

const LABELS: Record<string, string> = {
  "cloud-infrastructure": "Cloud Infrastructure",
  "developer-tools": "Developer Tools",
  databases: "Databases",
  "monitoring-observability": "Monitoring & Observability",
  "developer-recruiting": "Developer Recruiting",
  "developer-education": "Developer Education",
  "saas-products": "SaaS Products",
}

export function categoryLabel(slug: string): string {
  return (
    LABELS[slug] ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  )
}
