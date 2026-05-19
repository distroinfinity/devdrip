"use server"

import { revalidatePath } from "next/cache"
import { adminApi, type NewsSourceCreate, type TickerSymbolCreate } from "@/lib/admin-api"

export async function createNewsSourceAction(input: NewsSourceCreate) {
  await adminApi.createNewsSource(input)
  revalidatePath("/admin/sources")
}

export async function updateNewsSourceAction(id: string, patch: Partial<NewsSourceCreate>) {
  await adminApi.updateNewsSource(id, patch)
  revalidatePath("/admin/sources")
}

export async function deleteNewsSourceAction(id: string) {
  await adminApi.deleteNewsSource(id)
  revalidatePath("/admin/sources")
}

export async function createTickerSymbolAction(input: TickerSymbolCreate) {
  await adminApi.createTickerSymbol(input)
  revalidatePath("/admin/tickers")
}

export async function updateTickerSymbolAction(symbol: string, patch: Partial<TickerSymbolCreate>) {
  await adminApi.updateTickerSymbol(symbol, patch)
  revalidatePath("/admin/tickers")
}

export async function deleteTickerSymbolAction(symbol: string) {
  await adminApi.deleteTickerSymbol(symbol)
  revalidatePath("/admin/tickers")
}
