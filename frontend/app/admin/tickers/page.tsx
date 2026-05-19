import { adminApi } from "@/lib/admin-api"
import { TickersClient } from "./tickers-client"

export default async function TickersPage() {
  const { symbols } = await adminApi.tickerSymbols()
  return <TickersClient initial={symbols} />
}
