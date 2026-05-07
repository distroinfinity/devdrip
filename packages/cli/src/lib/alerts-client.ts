import type { AlertDto, AlertReplacement } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

export type { AlertReplacement }

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
