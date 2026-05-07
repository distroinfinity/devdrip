import type { AlertDto, AlertScope } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export interface AlertReplacement {
  scope: AlertScope
  symbol: string | null
  thresholdPct: number
}

export async function getMyAlerts(): Promise<AlertDto[]> {
  const resp = await apiFetch<{ alerts: AlertDto[] }>("/me/alerts")
  return resp.alerts
}

export async function putMyAlerts(replacement: AlertReplacement[]): Promise<AlertDto[]> {
  const resp = await apiFetch<{ alerts: AlertDto[] }>("/me/alerts", {
    method: "PUT",
    body: { alerts: replacement },
  })
  return resp.alerts
}
