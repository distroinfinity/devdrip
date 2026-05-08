import { adminApi } from "@/lib/admin-api"
import { MetricsCharts } from "./metrics-charts"

export default async function MetricsPage() {
  const data = await adminApi.metrics(30)
  return <MetricsCharts data={data} />
}
