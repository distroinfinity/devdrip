export interface ToolSubOption {
  value: string;
  label: string;
}

export interface AiTool {
  value: string;
  label: string;
  subOptions?: ToolSubOption[];
}

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
];

export const MONTHLY_SPEND_OPTIONS = [
  { value: "10-20", label: "$10–20" },
  { value: "20-50", label: "$20–50" },
  { value: "50+", label: "$50+" },
] as const;

export type MonthlySpend = (typeof MONTHLY_SPEND_OPTIONS)[number]["value"] | "";

export type WaitlistSource = "hero" | "nav" | "bottom";

export interface WaitlistPayload {
  email: string;
  aiTools: string[];
  monthlySpend: MonthlySpend;
  source: WaitlistSource;
  _honey?: string;
}

export interface WaitlistResponse {
  success: boolean;
  duplicate?: boolean;
  position?: number;
  message: string;
  error?: string;
}

export async function submitWaitlist(
  payload: WaitlistPayload,
): Promise<WaitlistResponse> {
  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res.json();
}
