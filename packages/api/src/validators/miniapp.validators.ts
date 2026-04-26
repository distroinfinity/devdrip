import { ValidationError } from "../errors/index.js"

interface WalletAuthVerifyBody {
  payload: unknown
  nonce: string
}

export function parseWalletAuthVerify(body: unknown): WalletAuthVerifyBody {
  if (typeof body !== "object" || body === null) throw new ValidationError("invalid_body")
  const { payload, nonce } = body as Record<string, unknown>
  if (!payload || typeof payload !== "object") throw new ValidationError("invalid_payload")
  if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) {
    throw new ValidationError("invalid_nonce")
  }
  return { payload, nonce }
}

interface WorldIdVerifyBody {
  proof: {
    nullifier_hash: string
    merkle_root: string
    proof: string
    verification_level: "device" | "orb"
  }
}

export function parseWorldIdVerify(body: unknown): WorldIdVerifyBody {
  if (typeof body !== "object" || body === null) throw new ValidationError("invalid_body")
  const { proof } = body as Record<string, unknown>
  if (!proof || typeof proof !== "object") throw new ValidationError("invalid_proof")
  const p = proof as Record<string, unknown>
  if (typeof p["nullifier_hash"] !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(p["nullifier_hash"])) {
    throw new ValidationError("invalid_nullifier_hash")
  }
  if (typeof p["merkle_root"] !== "string" || !p["merkle_root"].startsWith("0x")) {
    throw new ValidationError("invalid_merkle_root")
  }
  if (typeof p["proof"] !== "string" || !p["proof"].startsWith("0x")) {
    throw new ValidationError("invalid_proof_string")
  }
  if (p["verification_level"] !== "device" && p["verification_level"] !== "orb") {
    throw new ValidationError("invalid_verification_level")
  }
  return {
    proof: {
      nullifier_hash: p["nullifier_hash"],
      merkle_root: p["merkle_root"],
      proof: p["proof"],
      verification_level: p["verification_level"],
    },
  }
}
