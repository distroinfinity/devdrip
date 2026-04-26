export interface ToolSubOption {
  value: string
  label: string
}

export interface AiTool {
  value: string
  label: string
  subOptions?: ToolSubOption[]
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (v: string) => EMAIL_RE.test(v)

// all valid ai_tools values (parent + sub-option)
export const VALID_TOOL_VALUES = new Set<string>()

export const AI_TOOLS: AiTool[] = [
  {
    value: "claude",
    label: "Claude",
    subOptions: [
      { value: "claude:terminal", label: "Terminal (Claude Code)" },
      { value: "claude:vscode", label: "VS Code Extension" },
    ],
  },
  { value: "cursor", label: "Cursor" },
  {
    value: "github-copilot",
    label: "GitHub Copilot",
    subOptions: [
      { value: "github-copilot:vscode", label: "VS Code" },
      { value: "github-copilot:jetbrains", label: "JetBrains" },
    ],
  },
  { value: "codex", label: "Codex" },
  { value: "windsurf", label: "Windsurf" },
]

// populate valid tool values set
for (const tool of AI_TOOLS) {
  VALID_TOOL_VALUES.add(tool.value)
  if (tool.subOptions) {
    for (const sub of tool.subOptions) VALID_TOOL_VALUES.add(sub.value)
  }
}

export const MONTHLY_SPEND_OPTIONS = [
  { value: "10-20", label: "$10–20" },
  { value: "20-50", label: "$20–50" },
  { value: "50+", label: "$50+" },
] as const

export type MonthlySpend = (typeof MONTHLY_SPEND_OPTIONS)[number]["value"] | ""

export type WaitlistSource = "hero" | "nav" | "bottom" | "install"

export interface WaitlistPayload {
  email: string
  aiTools: string[]
  monthlySpend: MonthlySpend
  source: WaitlistSource
  _honey?: string
}

export interface WaitlistResponse {
  success: boolean
  duplicate?: boolean
  position?: number
  message: string
  error?: string
}

export async function submitWaitlist(payload: WaitlistPayload): Promise<WaitlistResponse> {
  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data: WaitlistResponse = await res.json()

  // fire conversion event on successful signup
  if (data.success) {
    import("@vercel/analytics").then(({ track }) => {
      track("Waitlist Signup", { source: payload.source })
    })
  }

  return data
}
