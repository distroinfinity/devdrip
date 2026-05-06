import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { hostname, platform } from "node:os"
import type { Device, IdeType } from "@distrotv/shared"
import { apiFetch } from "./api-client.js"

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

export async function registerDevice(): Promise<Device> {
  const { device } = await apiFetch<{ device: Device }>("/devices", {
    method: "POST",
    timeoutMs: 5_000,
    body: {
      machineIdHash: getMachineIdHash(),
      os: platform(),
      ideType: detectIdeType(),
      deviceName: hostname(),
    },
  })
  return device
}
