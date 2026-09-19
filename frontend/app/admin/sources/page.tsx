import { adminApi } from "@/lib/admin-api"
import { SourcesClient } from "./sources-client"

export default async function SourcesPage() {
  const { sources } = await adminApi.newsSources()
  return <SourcesClient initial={sources} />
}
