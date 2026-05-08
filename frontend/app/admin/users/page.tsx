import { adminApi } from "@/lib/admin-api"
import { UsersListClient } from "./users-list-client"

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function UsersListPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam ?? 1))
  const { users, total, limit } = await adminApi.users(page, 50)
  return <UsersListClient initial={users} total={total} page={page} limit={limit} />
}
