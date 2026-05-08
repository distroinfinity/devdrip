import { EmptyState } from "@/components/v5/empty-state"

// /me/alerts/events endpoint does not exist yet — this tab renders a placeholder
// until Task 7 or a follow-up adds the alert fire log endpoint.
// Flag: backend needs GET /me/alerts/events?limit=25 returning:
//   { events: [{ id, symbol, changePct, thresholdPct, firedAt }] }

export function AlertsTab() {
  return (
    <div className="pb-7">
      <EmptyState
        title="alert fire log pending"
        body="the /me/alerts/events endpoint is not yet available. this tab will show per-firing history once that endpoint lands in a follow-up task."
      />
    </div>
  )
}
