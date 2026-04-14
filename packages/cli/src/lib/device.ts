import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { hostname, platform } from "node:os"
import type { Device, IdeType } from "@devdrip/shared"

// platform-specific stable machine ID — survives hostname changes and is
// unique per physical/virtual machine, unlike hostname+platform+arch
function getRawMachineId(): string {
  try {
    switch (platform()) {
      case "darwin":
        return (
          execSync("ioreg -rd1 -c IOPlatformExpertDevice", { encoding: "utf8" }).match(
            /"IOPlatformUUID"\s*=\s*"([^"]+)"/
          )?.[1] ?? ""
        )
      case "linux":
        return readFileSync("/etc/machine-id", "utf8").trim()
      case "win32":
        return (
          execSync("reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid", {
            encoding: "utf8",
          }).match(/MachineGuid\s+REG_SZ\s+(\S+)/)?.[1] ?? ""
        )
      default:
        return ""
    }
  } catch {
    return ""
  }
}

function getMachineIdHash(): string {
  const rawId = getRawMachineId()
  const seed = rawId || hostname() + platform()
  return createHash("sha256").update(seed).digest("hex")
}

function detectIdeType(): IdeType {
  // cursor is a vscode fork and sets TERM_PROGRAM=vscode — check cursor first
  if (Object.keys(process.env).some((k) => k.startsWith("CURSOR_"))) return "cursor"
  if (process.env["TERM_PROGRAM"] === "vscode") return "vscode"
  return "terminal"
}

export async function registerDevice(token: string, apiBaseUrl: string): Promise<Device> {
  const res = await fetch(`${apiBaseUrl}/devices`, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
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
