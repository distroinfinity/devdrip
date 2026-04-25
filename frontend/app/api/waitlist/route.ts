import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { BetaAccessEmail } from "@/lib/emails/beta-access";
import type { WaitlistResponse, WaitlistSource } from "@/lib/waitlist";

// lazy-init — Resend throws if API key is missing at import time (breaks build)
const getSql = () => neon(process.env.DATABASE_URL!);
const getResend = () => new Resend(process.env.RESEND_API_KEY);

// in-memory rate limit — resets on redeploy, fine for pre-launch
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const VALID_SOURCES: WaitlistSource[] = ["hero", "nav", "bottom"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT || "devdrip";
  const data = new TextEncoder().encode(ip + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ipHash) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT) return false;
  timestamps.push(now);
  rateMap.set(ipHash, timestamps);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // honeypot — bots fill hidden fields, return fake success
    if (body._honey) {
      return NextResponse.json<WaitlistResponse>({
        success: true,
        position: Math.floor(Math.random() * 500) + 100,
        message: "Request received.",
      });
    }

    const { email, aiTools, monthlySpend, source } = body;

    // validate email
    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json<WaitlistResponse>(
        { success: false, message: "Valid email required.", error: "validation" },
        { status: 400 },
      );
    }

    // validate source
    const validSource = VALID_SOURCES.includes(source) ? source : "bottom";

    // validate ai_tools — filter to known values
    const validTools = Array.isArray(aiTools)
      ? aiTools.filter((t: string) => typeof t === "string")
      : [];

    // rate limit by ip hash
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const ipHash = await hashIp(ip);

    if (!checkRateLimit(ipHash)) {
      return NextResponse.json<WaitlistResponse>(
        { success: false, message: "Too many requests. Try again later.", error: "rate_limit" },
        { status: 429 },
      );
    }

    // insert — ON CONFLICT returns nothing, so we check separately
    const trimmedEmail = email.trim().toLowerCase();

    const db = getSql();

    // derive boolean from spend selection, store spend tier in monthly_spend
    const paysForAiTools = typeof monthlySpend === "string" && monthlySpend !== "";
    const spendTier = paysForAiTools ? monthlySpend : null;

    const inserted = await db`
      INSERT INTO waitlist (email, ai_tools, ok_with_ads, pays_for_ai_tools, monthly_spend, source, ip_hash)
      VALUES (${trimmedEmail}, ${validTools}, ${false}, ${paysForAiTools}, ${spendTier}, ${validSource}, ${ipHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    const isDuplicate = inserted.length === 0;

    // position = count of rows with id <= this row's id (chronological order)
    const posResult = isDuplicate
      ? await db`SELECT COUNT(*) as position FROM waitlist WHERE id <= (SELECT id FROM waitlist WHERE email = ${trimmedEmail})`
      : await db`SELECT COUNT(*) as position FROM waitlist WHERE id <= ${inserted[0].id}`;
    const position = Number(posResult[0]?.position) || 1;

    if (isDuplicate) {
      return NextResponse.json<WaitlistResponse>({
        success: true,
        duplicate: true,
        position,
        message: "You've already requested access.",
      });
    }

    // fire-and-forget confirmation email
    sendConfirmationEmail(trimmedEmail, position).catch(() => {
      // email failure shouldn't affect the response
    });

    return NextResponse.json<WaitlistResponse>({
      success: true,
      position,
      message: "Request received.",
    });
  } catch (err) {
    console.error("waitlist error:", err);
    return NextResponse.json<WaitlistResponse>(
      { success: false, message: "Something went wrong. Try again.", error: "server" },
      { status: 500 },
    );
  }
}

async function sendConfirmationEmail(email: string, position: number) {
  if (!process.env.RESEND_API_KEY) return;

  const html = await render(BetaAccessEmail({ position }));

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: email,
    subject: "Request for Beta Access - Dev Drip",
    html,
  });
}
