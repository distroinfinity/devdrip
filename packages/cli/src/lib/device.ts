import { createHash } from "node:crypto"
import { hostname, platform, arch } from "node:os"
import type { Device, IdeType } from "@devdrip/shared"

function getMachineIdHash(): string {
  return createHash("sha256")
    .update(hostname() + platform() + arch())
    .digest("hex")
}

function detectIdeType(): IdeType {
  if (process.env["TERM_PROGRAM"] === "vscode") return "vscode"
  if (Object.keys(process.env).some((k) => k.startsWith("CURSOR_"))) return "cursor"
  return "terminal"
}

export async function registerDevice(token: string, apiBaseUrl: string): Promise<Device> {
  const res = await fetch(`${apiBaseUrl}/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      machineIdHash: getMachineIdHash(),
      os: platform(),
      ideType: detectIdeType(),
      deviceName: hostname(),
    }),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(`device registration failed: ${body.error ?? res.statusText}`)
  }

  const { device } = (await res.json()) as { device: Device }
  return device
}
