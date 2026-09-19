export interface MagicLinkEmailParams {
  email: string
  link: string
  expiresInMinutes: number
}

export function magicLinkEmailHtml(params: MagicLinkEmailParams): string {
  const { email, link, expiresInMinutes } = params
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 24px; line-height: 1.5; color: #1a1a1a;">
  <h1 style="font-size: 20px; margin-bottom: 8px;">Sign in to Distro TV</h1>
  <p style="color: #555;">Click the link below to sign in to <strong>${escapeHtml(email)}</strong>. This link expires in ${expiresInMinutes} minutes and can only be used once.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtmlAttr(link)}" style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 6px;">Sign in</a>
  </p>
  <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email — no account is created without confirmation.</p>
  <p style="color: #888; font-size: 13px;">Or paste this URL into your browser:<br><code style="font-size: 11px; word-break: break-all;">${escapeHtml(link)}</code></p>
</body>
</html>`
}

export function magicLinkEmailText(params: MagicLinkEmailParams): string {
  return `Sign in to Distro TV

Click the link below to sign in to ${params.email}. This link expires in ${params.expiresInMinutes} minutes.

${params.link}

If you didn't request this, ignore this email — no account is created without confirmation.`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  )
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s)
}
