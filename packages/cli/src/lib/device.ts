import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { hostname, platform } from "node:os"
import type { Device, IdeType } from "@distrotv/shared"
import { apiFetch, apiFetchPublic } from "./api-client.js"

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

export interface AnonRegistrationResult {
  userId: string
  deviceId: string
  deviceSecret: string
}

// fresh-machine path: no auth required. server creates anon user + device,
// returns the raw secret (only time it's visible — caller must persist it).
export async function registerAnonDevice(): Promise<AnonRegistrationResult> {
  const result = await apiFetchPublic<{ userId: string; deviceId: string; deviceSecret: string }>(
    "/devices/register",
    {
      method: "POST",
      timeoutMs: 10_000,
      body: {
        name: hostname(),
        platform: platform(),
        ideType: detectIdeType(),
      },
    }
  )
  return { userId: result.userId, deviceId: result.deviceId, deviceSecret: result.deviceSecret }
}

// existing-device path: caller holds a device bearer; POST /devices refreshes metadata.
export async function refreshDeviceMetadata(): Promise<Device> {
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

// kept for backward-compat with any remaining callers (auth-flow, etc.)
export async function registerDevice(): Promise<Device> {
  return refreshDeviceMetadata()
}
