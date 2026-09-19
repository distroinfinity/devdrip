import { NextResponse } from "next/server"
import { API_URL } from "@/lib/env"

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params
  const url = new URL(req.url)
  const range = url.searchParams.get("range") ?? "1m"
  const upstream = await fetch(
    `${API_URL}/tickers/${encodeURIComponent(symbol)}/history?range=${range}`,
    { cache: "no-store" }
  )
  const body = await upstream.text()
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  })
}
