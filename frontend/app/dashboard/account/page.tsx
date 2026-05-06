import { redirect } from "next/navigation"
import { getSession, clearSessionCookie } from "@/lib/session"

export default async function AccountPage() {
  const session = await getSession()
  if (!session) {
    redirect("/sign-in?next=/dashboard/account")
  }

  return (
    <main className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Account</h1>

      <div className="space-y-4">
        <Field label="Email" value={session.email ?? "anonymous (no email)"} />
        <Field label="User ID" value={session.userId} mono />
        {session.deviceId && <Field label="Paired device" value={session.deviceId} mono />}
        <Field label="Session expires" value={new Date(session.exp * 1000).toLocaleString()} />
      </div>

      <div className="mt-8 border-t pt-6">
        <form
          action={async () => {
            "use server"
            await clearSessionCookie()
            redirect("/sign-in")
          }}
        >
          <button
            type="submit"
            className="px-4 py-2 border border-red-300 text-red-700 rounded text-sm"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</div>
    </div>
  )
}
