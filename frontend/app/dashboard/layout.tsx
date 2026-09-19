import { redirect } from "next/navigation"
import { AppShell } from "@/components/dashboard/app-shell"
import { getServerUser } from "@/lib/auth"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect("/sign-in")

  return <AppShell user={user}>{children}</AppShell>
}
