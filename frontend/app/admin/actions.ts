"use server"

import { revalidatePath } from "next/cache"
import { adminApi, type NewsSourceCreate } from "@/lib/admin-api"

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
