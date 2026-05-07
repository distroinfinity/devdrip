export type AlertScope = "global" | "per_ticker"

export interface AlertDto {
  id: string
  scope: AlertScope
  // null when scope === "global"; non-null when scope === "per_ticker"
  symbol: string | null
  thresholdPct: number
  createdAt: string
  updatedAt: string
}

// emitted on TickerPayload.alert when the slot was promoted by an alert fire.
export interface PendingAlert {
  symbol: string
  changePct: number
  thresholdPct: number
  firedAt: string
}

// PUT /me/alerts body item — same shape on api, cli, and frontend.
// keep this in sync with PutAlertsInput.alerts in alerts.validators.ts.
export interface AlertReplacement {
  scope: AlertScope
  symbol: string | null
  thresholdPct: number
}
