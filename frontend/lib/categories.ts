// canonical category labels shown in the UI.
// keep in sync with AdCategory in @devdrip/shared.
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
