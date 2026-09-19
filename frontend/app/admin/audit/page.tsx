import { adminApi } from "@/lib/admin-api"
import { AuditClient } from "./audit-client"

interface Props {
  searchParams: Promise<{ since?: string }>
}

export default async function AuditPage({ searchParams }: Props) {
  const { since: sinceParam } = await searchParams
  const since = typeof sinceParam === "string" ? sinceParam : undefined
  const { events } = await adminApi.alertEvents(100, since)
  return <AuditClient events={events} since={since} />
}
