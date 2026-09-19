# Product Requirements Document: Dev Drip

## Ad-Subsidized AI Coding Tools via Opt-In Idle-Time Monetization

---

## 1. Problem Statement

AI coding tools now cost developers $10–$200/month. An estimated 7–10 million developers currently pay for AI coding subscriptions (GitHub Copilot, Cursor, Claude Code), and the market is projected to reach $24–$34 billion by 2030. Meanwhile, developers using agentic AI tools accumulate **15–60 minutes of pure idle time daily** — staring at a spinner while the agent thinks, edits files, and runs commands.

This is dead time. The developer can't meaningfully code while the agent is working, but they also can't leave because the agent might need input in 30 seconds or 3 minutes. They scroll Twitter. They check Slack. They stare at the terminal.

**Dev Drip turns that dead time into money.** Developers opt in to see relevant, non-intrusive content during agent idle windows and earn USDC micropayments that directly offset their AI tool subscriptions. The developer is in total control: they choose when content appears, what types they see, and can dismiss anything instantly.

**The core insight:** We're not putting ads in a developer tool. We're building an **opt-in entertainment and discovery layer** for the moments when the developer tool has temporarily taken their job away.

---

## 2. Lessons From 12 Case Studies: What Makes Ads Tolerable (Even Wanted)

### 2.1 Rewarded Video in Mobile Gaming (Unity Ads, ironSource, AppLovin)

Players voluntarily tap "Watch Ad" to earn an extra life, bonus coins, or continue a run. A 15–30 second video plays. The reward is instant.

**Why it works:** The user initiates the ad. There's a clear, immediate value exchange. The ad appears at a natural break point (between levels, after dying). Completion rates exceed 95% — the highest of any ad format in digital advertising. eCPMs reach $15–$30 in Tier 1 markets. Over 80% of users prefer this format according to the IAB, and 71% of gamers choose rewarded video over other ad types. Sessions run 50% longer when rewarded ads are present, and removal of rewarded ads makes 50% of gamers less satisfied with their experience.

**Lesson for us:** The opt-in mechanic is everything. The same 30-second video ad that enrages users when it auto-plays is welcomed when the user chooses it for a tangible reward. Rewarded ads are 100% more effective than interstitial ads and users who engage with them are 4.5x more likely to make subsequent purchases.

### 2.2 Brave Browser's "Brave Rewards"

Users enable Brave Rewards to see system-level push notifications containing ads. Users earn 70% of ad revenue in BAT tokens. Ads appear as small notifications — not in-page banners. 100M+ MAU proves the "watch ads, earn crypto" model scales.

**Why it partially fails:** Earnings are tiny ($0.50–$2/month). BAT token lost 93% of value. KYC requirements for withdrawal create friction.

**Lesson for us:** Use USDC, not a proprietary token. Make earnings meaningful (&gt;$10/month). Keep the ad **outside the primary workflow surface.**

### 2.3 Hulu's "Pause Ads" and "Ad Selector"

When a viewer pauses a show, a subtle branded image appears — no video, no sound, just a static sponsor message during a moment the user created. Hulu's research found consumers strongly preferred ads that were subtle and non-intrusive, and extensive audio/video during pausing was considered disruptive. The pause ad disappears instantly when play resumes. Hulu also pioneered the "Ad Selector" — letting viewers choose which ad to watch from 2–3 options. Ad recall increased significantly when viewers chose the ad. 88% of Hulu users preferred watching one 2-minute chosen ad over scattered interruptions. Disney has since expanded pause ads to Hulu, Max, and Peacock, validating the format across the industry.

**Lesson for us:** The "pause ad" model maps directly to agent-idle-time. The developer has "paused" their coding to wait for the agent. Also: let developers choose ad categories or specific ads — choice reduces resentment dramatically. Appear only after a few seconds of idle (not instantly), and vanish the moment activity resumes.

### 2.4 Spotify Free Tier

Music plays with periodic audio ad breaks every 15–30 minutes. The trade-off is clear: free unlimited music library in exchange for occasional interruptions. 400M+ users accept the deal.

**Why it partially fails for our model:** Ad ARPU is only $0.39/month vs $5.18 for premium — a 13x gap. Spotify intentionally makes ads annoying as an upsell funnel to premium.

**Lesson for us:** Don't weaponize annoyance. Our users aren't upselling to anything — the ad IS the monetization. We need ads to be genuinely tolerable because there's no premium escape hatch.

### 2.5 Duolingo's Heart System + Rewarded Ads

Free users lose "hearts" when they make mistakes. When hearts run out, they watch a 30-second ad to earn one back, or wait 5 hours. Ads appear at failure moments — natural break points where the user is already paused. Duolingo's ad revenue exceeded $80M in 2023 and continues growing. Their ML-driven ad decisions became their largest revenue source, driving roughly a quarter of year-over-year revenue growth by personalizing which ad type (in-house vs. network) each user sees.

**Lesson for us:** Frame the ad as solving a problem. "Your agent is thinking... earn $0.03 while you wait" reframes idle time from frustration into opportunity. Also: use ML to personalize ad delivery — which format, frequency, and type works best for each developer.

### 2.6 daily.dev and Product Hunt's "Sponsored Tools"

Developer platforms show "Sponsored" developer tools alongside organic content. daily.dev charges $10–$20 CPM. Developers actively explore promoted products because discovering tools is genuinely useful.

**Lesson for us:** Developer-tool ads ARE content, not interruptions. A well-targeted recommendation for a new database, deployment platform, or monitoring solution during idle time could be the most useful thing that happens in a developer's day.

### 2.7 YouTube's Skippable Pre-Roll

Video ad plays before content. After 5 seconds, "Skip Ad" appears. Advertisers only pay when viewer watches 30 seconds or completes the ad. The skip button gives users agency.

**Lesson for us:** Always provide a skip/dismiss mechanism. Even if most users don't skip (rewarded video completion is 95%+), the presence of the option transforms the psychological experience from "forced" to "chosen." TikTok research confirms: 73% of viewers say the ability to skip makes them more engaged, and 56% are more likely to actively watch when they have that option.

### 2.8 Twitch's "Watch an Ad to Support This Streamer"

Viewers voluntarily watch an ad, with revenue going to the streamer they support. This reframes ad-watching from self-interest to community support.

**Lesson for us:** Consider a community angle — "Your ad earnings this month funded 2 hours of maintainer work on an open-source project" or "Watch an ad to contribute to \[OSS project\]."

### 2.9 Waze's Zero-Speed Takeover

When a driver is fully stopped (red light, traffic), a branded banner appears at the top of the screen. It disappears the moment the car moves. The ad only exists during idle time and vanishes instantly on activity. Waze processes these as digital billboards with CPM pricing, targeting users based on location context — the ads only appear when the user is genuinely idle.

**Lesson for us:** The "appear on idle, vanish on active" pattern is exactly our model. The ad should feel like it belongs in the idle state and should evaporate the instant the agent finishes. Not a single pixel should remain when the developer needs to work.

### 2.10 Gas Station TV / Elevator Screens (Captivate, STRATACACHE)

Captive-audience screens show content + ads during unavoidable waiting. Gas Station TV reaches 115M unique viewers/month in the US. Content is short, contextual, and mildly entertaining. Annoyance is low because expectations are low — nobody expects a gas pump to be enriching.

**Lesson for us:** Agent idle time is a "captive audience" moment. If we fill that time with something mildly interesting (a dev trivia question, a tool demo, a code tip) plus an ad, we're improving the experience over "stare at spinner."

### 2.11 Native Advertising (Outbrain, Taboola, In-Feed)

Native ads match the look, feel, and function of their surrounding content. Consumers view native ads 53% more frequently than banner ads and they deliver 18% higher purchase intent. Native ads generate 20–60% higher engagement than display ads and are 32% more likely to be shared.

**Lesson for us:** Every ad surface we build must feel native to its environment. A terminal ad should look like terminal output. A VS Code tab ad should feel like a VS Code panel. The moment an ad looks "foreign" to the developer environment, trust is destroyed.

### 2.12 TikTok In-Feed Ads

Ads are full-screen videos indistinguishable from organic content except for a small "Sponsored" label. Users scroll past instantly if uninterested. The format is identical to regular content, forcing advertisers to create genuinely engaging material. Research shows 50% of TikTok ad impact occurs within the first 2 seconds, and the first 6 seconds capture 90% of ad recall.

**Lesson for us:** Make dismissing an ad effortless (one keypress). If the ad must earn attention rather than demand it, the quality of ad content rises dramatically. Also: the first 2 seconds matter most — lead with value.

---

## 3. Seven Design Principles (Synthesized From Case Studies)

| \#  | Principle                                  | Source Insight                                                                                                                                                                         |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Opt-In Is Non-Negotiable**               | Every successful model (Brave, rewarded video, Hulu selector) starts with explicit user consent. Dev Drip is OFF by default.                                                           |
| 2   | **Ads Live in Idle, Die on Activity**      | Waze zero-speed, Hulu pause ads: content appears ONLY during agent work, vanishes within 200ms when the agent finishes or needs input.                                                 |
| 3   | **User Has Agency at Every Moment**        | YouTube skip button, TikTok scroll-past, Hulu ad selector: skip buttons, category preferences, frequency caps, mute for N minutes. The developer is never trapped.                     |
| 4   | **The Value Exchange Must Be Transparent** | Rewarded video best practice: state what the user gives (attention) and gets ($0.03 USDC) BEFORE the ad starts. No bait-and-switch.                                                    |
| 5   | **Ads Must Be Native to the Environment**  | TikTok's content-first philosophy, native advertising research: a terminal ad looks like terminal content, a VS Code ad looks like a VS Code panel. Foreign-looking ads destroy trust. |
| 6   | **Content Quality &gt; Ad Frequency**      | Duolingo ML optimization, TikTok creative guidelines: fewer high-quality, relevant ads outperform many generic ones. Developer-tool discovery content &gt; generic banner.             |
| 7   | **Earnings Must Be Meaningful**            | Brave's failure at $0.50/month teaches: target $10–$25/month minimum, or the trade-off isn't worth the psychological cost.                                                             |

---

## 4. Product Architecture

### 4.1 Overview

Dev Drip is a **cross-platform SDK and companion service** that integrates with AI coding tools to detect idle states and serve opt-in ad content. It connects to an ad exchange, a USDC payment rail, and a developer dashboard.

```
┌─────────────────────────────────────────────────────┐
│                  DEVELOPER'S MACHINE                 │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Terminal  │  │ VS Code  │  │ Standalone IDE   │   │
│  │ (Claude  │  │ Extension│  │ (Cursor, etc.)   │   │
│  │  Code)   │  │          │  │                  │   │
│  └─────┬────┘  └────┬─────┘  └────────┬─────────┘   │
│        │            │                 │              │
│        └────────────┼─────────────────┘              │
│                     │                                │
│            ┌────────▼────────┐                       │
│            │  Dev Drip SDK    │                       │
│            │  (Idle Detect + │                       │
│            │   Ad Renderer)  │                       │
│            └────────┬────────┘                       │
└─────────────────────┼───────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Dev Drip Cloud  │
              │  ─ Ad Exchange  │
              │  ─ USDC Payouts │
              │  ─ Dashboard    │
              │  ─ ML Targeting │
              └────────────────┘
```

### 4.2 Idle State Detection Engine

The core technical challenge: accurately distinguishing "agent working, developer waiting" from "developer actively coding." This is the foundation everything else rests on.

**Idle signals (agent is working, developer is waiting):**

- AI agent is streaming output (terminal shows `⠋ Thinking...`, progress indicators, file diffs being generated)
- Multi-file edit operation in progress (Cursor Composer, Claude Code agentic mode)
- Build/test/deploy process running that was triggered by the agent
- No keyboard or mouse input for &gt;5 seconds while agent process is active
- Terminal process is actively writing output (stdout/stderr active)

**Active signals (developer needs focus — ads must vanish):**

- Any keyboard input (even a single keypress)
- Mouse click in the editor area
- Agent output completes (return to prompt)
- Agent asks a question or needs confirmation
- Developer switches to the tool's window/tab from another app
- File save event
- Terminal prompt becomes interactive again

**State machine:**

```
                    ┌──────────┐
                    │  ACTIVE  │ ◄── No ads shown
                    │ (Coding) │     Earnings paused
                    └────┬─────┘
                         │
              Agent starts working
              + 3 second grace period
                         │
                    ┌────▼──────┐
                    │  WARMING  │ ◄── Subtle indicator:
                    │ (3-5 sec) │     "Earn while you wait?"
                    └────┬──────┘
                         │
              No user input detected
              Developer hasn't left window
                         │
                    ┌────▼──────┐
                    │   IDLE    │ ◄── Ad content appears
                    │ (Earning) │     Earnings accumulating
                    └────┬──────┘
                         │
              ANY active signal
              (instant, <200ms)
                         │
                    ┌────▼──────┐
                    │  ACTIVE   │ ◄── All ads vanish
                    │ (Coding)  │     immediately
                    └───────────┘
```

**Critical timing rules:**

- **3-second grace period** before any ad appears after agent starts (matches Hulu pause ad delay — never show ads instantly on idle, let the developer settle)
- **&lt;200ms dismissal** — the moment ANY active signal fires, all ad content vanishes. This must be faster than the developer can perceive
- **Minimum idle duration of 8 seconds** before first ad — inline completions (30–200ms) never trigger ads. Only agentic tasks that create genuine waiting
- **Re-engagement cooldown** — after an ad is dismissed by developer activity, no new ad for at least 15 seconds even if idle resumes (prevents "flickering" experience)

---

## 5. Six Creative Ad Surfaces

This is where product imagination matters most. Each surface is designed for a specific integration point, inspired by the case studies above, and built to feel native to the developer environment.

### Surface 1: "The Retro Terminal TV" (CLI / Terminal)

**Inspired by:** Gas Station TV, elevator screens, retro computing aesthetics

**What it is:** When Claude Code or any terminal-based agent is working, a bordered ASCII/ANSI art display appears below the agent's output stream — styled like a tiny retro CRT television embedded in the terminal. It shows sponsored content rendered entirely in terminal-native formatting.

```
╔══════════════════════════════════════════════╗
║  📺 Dev Drip TV              $0.02 earned  ⏭  ║
║──────────────────────────────────────────────║
║                                              ║
║   🚀 Neon Database                           ║
║   Serverless Postgres that scales to zero    ║
║   "We cut our DB bill by 80%" — @devtool    ║
║                                              ║
║   [D]iscover  [S]kip  [M]ute 30min          ║
║──────────────────────────────────────────────║
║  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  Agent working... 62% ║
╚══════════════════════════════════════════════╝
```

**Design details:**

- Rendered in pure ANSI/Unicode — feels like it _belongs_ in the terminal
- Shows agent progress bar at the bottom so the developer can monitor agent status AND see ad content in the same visual space
- Rotates content every 15 seconds during long agent tasks
- Single-key interactions: `D` to open link in browser, `S` to skip to next ad, `M` to mute for 30 minutes
- The entire display vanishes the instant the agent finishes or the user types
- Themed variants: CRT green-screen mode, synthwave mode, minimal mode — developer picks their aesthetic
- Shows running earnings counter ("$0.02 earned") to make the value exchange viscerally visible

**Content types for terminal:**

- Developer tool promotions (native text — no images possible)
- Code tips and "Did you know?" factoids with sponsor attribution
- Job postings from developer-focused recruiters
- Open-source project spotlights (sponsored by companies employing maintainers)
- "Dev trivia" — quick technical questions with sponsored answers

**Why this works:** The terminal is the developer's most personal space — the npm incident proved ads here are dangerous. But the retro TV framing creates a **separate conceptual space**. It's not "an ad in your terminal." It's "a tiny TV that happens to live in your terminal and only turns on when you're waiting." The frame boundary is the crucial psychological distinction. Combined with opt-in and instant dismiss, this transforms the terminal from "last stronghold against ads" into "the one place where ads actually respect me."

### Surface 2: "The Companion Tab" (VS Code / Cursor)

**Inspired by:** Hulu's pause ads, daily.dev's sponsored developer content, browser new-tab experiences

**What it is:** When the AI agent starts a multi-file operation in VS Code or Cursor, a new editor tab opens alongside the active file — not replacing anything, just appearing in the tab bar. It contains rich HTML-rendered content: an interactive tool demo, a sponsored tutorial snippet, a developer podcast clip, or a product showcase.

**Visual concept:**

```
┌─────────────────────────────────────────────────┐
│ 📁 app.tsx  │ 📁 utils.ts  │ 🎯 Dev Drip │  ⚡ Agent Working...
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─ Sponsored ─────────────────────────────┐    │
│  │                                         │    │
│  │  Vercel Edge Functions                  │    │
│  │  Deploy serverless at the edge          │    │
│  │                                         │    │
│  │  ┌──── Interactive Demo ──────────┐     │    │
│  │  │  // Try it live:               │     │    │
│  │  │  export default function() {   │     │    │
│  │  │    return new Response("Hi!")  │     │    │
│  │  │  }                             │     │    │
│  │  │  [▶ Deploy This]               │     │    │
│  │  └────────────────────────────────┘     │    │
│  │                                         │    │
│  │  ⏭ Skip   💰 $0.03 earned   🔇 Pause    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ───── Also Trending ──────                     │
│  🔧 Drizzle ORM 2.0 — type-safe SQL           │
│  📊 Axiom — log analytics without the cost     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Design details:**

- Tab opens **unfocused** — it appears in the tab bar but doesn't steal keyboard focus from the developer. This is critical: the developer's cursor stays in their code file. They can glance at the tab or ignore it entirely
- Tab auto-closes within 200ms when agent work completes
- Rich content: can embed interactive code playgrounds, video demos (muted by default), animated product showcases
- "Also Trending" section shows organic developer tool rankings mixed with sponsored placements (daily.dev model)
- Developer can pin their favorite content categories (Infrastructure, Frontend, DevOps, etc.)
- Tab position is configurable: right split, bottom panel, or tab-bar-only (where it appears as a tab but only opens if clicked)
- Never opens more than ONE companion tab per agent task

**Content types for VS Code:**

- Interactive product demos with runnable code
- Sponsored "Today I Learned" technical content
- Short video ads from developer-tool companies (muted, with captions)
- Curated newsletter-style developer news with sponsor placement
- Coding challenge snippets ("Solve this in 30 seconds") sponsored by hiring companies

**Why this works:** VS Code tabs are the natural unit of attention in an IDE. Opening a new tab is a familiar, non-threatening action — developers open dozens of tabs daily. The tab doesn't take over the workspace; it coexists. And because it's unfocused, it's psychologically equivalent to a Hulu pause ad: visible but not demanding, there when you want it, gone when you don't.

### Surface 3: "The Idle Dashboard" (Standalone Widget / Floating Window)

**Inspired by:** Brave's notification ads, macOS widgets, screensaver-era displays

**What it is:** A small, always-on-top floating widget (similar to Spotify's mini player or macOS widget) that appears on the developer's screen during agent work and can be positioned anywhere. It shows a rotating feed of sponsored content, dev news, and earnings progress.

**Visual concept:**

```
┌────────────────────────────────┐
│ Dev Drip 💰 $14.72 this month  │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │  ☁️ Railway.app            │ │
│ │  Deploy anything.          │ │
│ │  No config needed.         │ │
│ │                            │ │
│ │  [Try Free] [Skip ⏭]      │ │
│ └────────────────────────────┘ │
│                                │
│ ⚡ Agent: Editing 3 files...   │
│ ████████████░░░░ 67%           │
│                                │
│ 🔥 Streak: 12 days            │
│ 📈 Weekly: $3.40 (+$0.80)     │
├────────────────────────────────┤
│ [Minimize] [Settings ⚙]       │
└────────────────────────────────┘
```

**Design details:**

- Floating window that appears ONLY during agent-idle periods
- Minimizes to a tiny pill ("💰 $0.02") in the corner when not in idle state
- Shows agent progress so the developer monitors their tool AND earns simultaneously
- Earnings streak tracker adds gamification (Duolingo's streak psychology)
- Weekly/monthly earnings graph creates a "growing savings" feeling
- Resizable from full widget to micro-pill to hidden
- Works across ANY IDE, terminal, or tool — it's OS-level, not tool-specific

**Why this works:** This is the "Brave Rewards notification" but executed better — instead of a disappearing notification, it's a persistent companion that only activates during idle. The earnings counter creates a positive Pavlovian association with idle time: waiting = money accumulating.

### Surface 4: "The Between-Sessions Digest" (Low-frequency, High-value)

**Inspired by:** Email newsletters, Apple News native ads, Flipboard sponsored content

**What it is:** Not real-time at all. When the developer opens their IDE in the morning, or returns from a break, a brief "Dev Drip Digest" appears as a notification or panel showing 2–3 curated sponsored items alongside genuine developer content. This is the lowest-frequency, lowest-annoyance surface.

**Trigger moments:**

- IDE startup (first open of the day)
- Return from a long break (&gt;30 minutes of IDE inactivity)
- End-of-day session summary
- Weekly earnings report

**Content format:**

```
┌─ Good Morning, Dev ──────────────────────────────┐
│                                                   │
│  💰 Yesterday's earnings: $1.24                  │
│  📊 Monthly total: $14.72 / $20.00 goal          │
│                                                   │
│  ── Today's Picks ──                              │
│                                                   │
│  📦 Turso Database launched edge replication      │
│     Sponsored by Turso · [Learn More]             │
│                                                   │
│  🧠 TIL: You can use `git worktree` to checkout  │
│     multiple branches simultaneously              │
│     Sponsored by GitKraken · [Read Tip]           │
│                                                   │
│  💼 Staff Engineer @ Stripe (Remote)              │
│     Sponsored by Stripe Recruiting                │
│                                                   │
│  [Dismiss All]  [Show fewer]  [Customize]         │
└───────────────────────────────────────────────────┘
```

**Why this works:** This surface trades CPM volume for dramatically lower developer hostility. It's essentially a curated newsletter delivered at natural workflow boundaries. Our market research identified this as the safest entry point — you can build trust with between-session ads before ever showing mid-workflow content.

### Surface 5: "The Sponsored Challenge" (Interactive, Gamified)

**Inspired by:** Duolingo's gamification, TikTok's branded hashtag challenges, coding challenge platforms

**What it is:** During longer agent tasks (&gt;60 seconds), the developer is offered a quick sponsored coding challenge, quiz, or puzzle. Complete it to earn a bonus payout.

**Example:**

```
╔══════════════════════════════════════════════════╗
║  🏆 Sponsored Challenge          +$0.10 bonus   ║
║──────────────────────────────────────────────────║
║                                                  ║
║  MongoDB Atlas presents:                         ║
║                                                  ║
║  What's the output of this aggregation pipeline? ║
║                                                  ║
║  db.orders.aggregate([                           ║
║    { $group: { _id: "$status",                   ║
║      total: { $sum: "$amount" } } }              ║
║  ])                                              ║
║                                                  ║
║  [A] Array of docs   [B] Single doc              ║
║  [C] Error           [D] Cursor                  ║
║                                                  ║
║  ⏭ Skip challenge   ⏱ Agent: ~45 sec remaining  ║
╚══════════════════════════════════════════════════╝
```

**Design details:**

- Only offered during long agent tasks (&gt;60 seconds predicted remaining)
- Higher payout than passive ads ($0.05–$0.15 per challenge vs $0.01–$0.03 per passive view)
- Challenges are genuinely educational — developer learns while earning
- Leaderboards for competitive developers (optional)
- Recruiting companies can use challenges as pre-screening (with developer consent)
- Challenge results are private by default; developer can choose to share for recruiting opportunities

**Why this works:** This isn't advertising in the traditional sense — it's sponsored education and assessment. A MongoDB-sponsored question about aggregation pipelines teaches a real skill while promoting MongoDB Atlas. The developer walks away having earned money AND learned something. This is the highest-CPM opportunity because it delivers genuine engagement, and it aligns with recruiting revenue (companies pay premium prices for qualified developer attention in an assessment context).

### Surface 6: "The Audio Companion" (Eyes-free, Terminal-focused)

**Inspired by:** Spotify's audio ads, podcast ad reads, ASMR content

**What it is:** For developers who want to keep their eyes on the terminal output while earning, a short audio clip plays during agent work — a sponsored "dev tip of the day," a 15-second product pitch, or a snippet of a developer podcast.

**Example:**

```
Terminal:
⠋ Claude Code: Refactoring auth module across 4 files...

🔊 Dev Drip Audio: "This task is sponsored by Sentry.
    Quick tip: You can use Sentry's new AI grouping
    to reduce alert noise by 40%. Learn more at
    sentry.io/devearn" (12 seconds)

💰 +$0.02
```

**Design details:**

- Audio only plays if developer has opted into audio ads specifically (double opt-in)
- Maximum 15 seconds
- Developer sets volume level independently from system volume
- Only one audio ad per agent task, regardless of duration
- Muted instantly on any keyboard input
- Text transcript appears in terminal for accessibility
- Can be combined with visual surfaces (developer chooses their mix)

**Why this works:** Audio ads leave the eyes free for monitoring agent output. The developer can watch the agent work while passively hearing a sponsor message. This is the podcast ad model brought to the IDE — and podcast ad CPMs ($15–$25) are among the highest in digital advertising because the format commands genuine attention.

---

## 6. Ad Lifecycle: When They Appear, Pause, Resume, and Disappear

This section defines the precise behavioral rules governing every ad interaction. These rules are non-negotiable — they protect the developer experience.

### 6.1 Appearance Rules

| Rule                        | Detail                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Grace period**            | No ad appears until 3 seconds after agent enters idle state. This prevents "flash" ads on quick operations.                                      |
| **Minimum idle prediction** | The system estimates remaining agent time. Ads only appear if predicted remaining time &gt; 10 seconds. No ad for a task that's about to finish. |
| **Frequency cap**           | Maximum 4 ads per hour per surface. Maximum 8 total ads per hour across all surfaces. Developer can lower these caps.                            |
| **Daily cap**               | Default 60 ads/day maximum. Developer-adjustable.                                                                                                |
| **Session warmup**          | First 10 minutes of a coding session are ad-free, even during idle. Let the developer get into flow first.                                       |
| **Time-of-day awareness**   | Late-night coding sessions (after 11 PM local) reduce ad frequency by 50% — the developer is tired and tolerance is lower.                       |

### 6.2 Disappearance Rules

| Rule                     | Detail                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Instant vanish**       | ANY developer input (keypress, click, mouse movement in editor) triggers ad dismissal within 200ms.                                                 |
| **Agent completion**     | When agent output finishes and prompt returns, all ads vanish within 200ms.                                                                         |
| **Confirmation request** | If agent asks a question mid-task, ads vanish immediately to let developer read and respond.                                                        |
| **Focus switch**         | If developer switches to the IDE window from another app, ads have a 2-second grace period before appearing (they might be switching back to type). |
| **Error state**          | If agent hits an error, all ads vanish immediately — the developer needs to focus on debugging.                                                     |

### 6.3 Skip and Control Mechanics

| Control                  | Behavior                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Skip (→)**             | Single keypress advances to next ad. Current ad is marked "skipped" (affects targeting).             |
| **Mute 30min**           | Pauses all ad delivery for 30 minutes. One-click. No penalty to earnings for already-earned amounts. |
| **Mute rest of session** | No ads until IDE restart.                                                                            |
| **Category block**       | "Don't show me \[crypto/recruiting/cloud\] ads" — permanent preference.                              |
| **Thumbs down**          | Flags a specific ad as unwanted. Affects ML targeting.                                               |
| **Thumbs up**            | Saves ad for later viewing. Creates "bookmarked tools" list in dashboard.                            |

### 6.4 Earning Confirmation

After each ad impression, a micro-confirmation appears for 2 seconds:

```
💰 +$0.03 earned (today: $1.24)
```

This is the "reward confirmation" from rewarded video best practices — making the value exchange tangible and immediate. Research shows users who see reward confirmation have significantly higher subsequent engagement.

---

## 7. Earnings and Payment System

### 7.1 Revenue Share

| Party             | Share   | Rationale                                                                                                                                     |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer         | **70%** | Matches Brave's industry-leading split. Must be highest to attract adoption.                                                                  |
| Dev Drip platform | **25%** | Covers ad exchange, payment processing, ML infrastructure, business operations.                                                               |
| Open-source fund  | **5%**  | Automatically allocated to open-source maintainers based on developer's dependency tree. Unique differentiator and community goodwill driver. |

### 7.2 Payment Rail: USDC on Base

Based on our market research analysis:

- **USDC stablecoins** — no proprietary token, no price volatility, no SEC risk
- **Base (Coinbase L2)** — transaction fees \~$0.002, Coinbase Wallet integration for 110M+ users
- **Zero-fee transfers** via Coinbase Wallet's Simple Mode on Base
- **Minimum payout: $1.00** — achievable in 1–2 days of active use at projected earnings
- **Auto-convert to fiat** option via Coinbase for developers who don't want crypto
- **Real-time balance** visible in dashboard and widget (no waiting for monthly payouts)

### 7.3 Projected Earnings

Based on market research CPM analysis with our 70% developer share:

| Developer Profile                                 | Daily Agent Idle Time | Daily Ad Views | Monthly Earnings (Est.) |
| ------------------------------------------------- | --------------------- | -------------- | ----------------------- |
| Light user (autocomplete only)                    | 5 min                 | 5–10           | $1–$3                   |
| Moderate user (some agentic tasks)                | 20 min                | 30–50          | $8–$15                  |
| Heavy agentic user (Claude Code, Cursor Composer) | 45 min                | 60–90          | $18–$30                 |
| Power user + challenges + audio                   | 60 min                | 80–120         | $25–$40                 |

At mid-range CPMs ($10–$15), a developer generating 15 ad views per hour across 5 hours daily could earn roughly $16–$25/month — enough to fully cover a GitHub Copilot Pro subscription ($10/month) or most of a Cursor Pro subscription ($20/month).

---

## 8. Advertiser Side: Why B2B Companies Pay Premium CPMs

Developer attention is among the most valuable ad inventory in digital advertising because a single developer's tool adoption can influence enterprise deals worth $10K–$1M+.

### 8.1 Target Advertiser Categories

| Category                 | Example Advertisers                         | Expected CPM Range |
| ------------------------ | ------------------------------------------- | ------------------ |
| Cloud infrastructure     | AWS, Azure, GCP, Vercel, Railway, Render    | $15–$25            |
| Developer tools          | JetBrains, Docker, Postman, GitKraken       | $10–$20            |
| Databases                | MongoDB, Supabase, PlanetScale, Neon, Turso | $12–$20            |
| Monitoring/observability | Datadog, Sentry, Grafana, Axiom             | $12–$18            |
| Developer recruiting     | FAANG, startups, recruiting platforms       | $20–$35            |
| Developer education      | Udemy, Pluralsight, Frontend Masters        | $8–$15             |
| SaaS products            | Atlassian, Notion, Linear, Figma            | $10–$18            |

### 8.2 Premium Ad Products

Beyond standard impressions, Dev Drip offers unique inventory:

- **Sponsored Challenges** ($30–$50 CPM) — interactive coding challenges with employer branding. Highest engagement, recruiter-grade intent signal.
- **Tool Demo Embeds** ($20–$30 CPM) — interactive product playgrounds in the Companion Tab. Developer can try a database query, deploy a function, or configure a tool without leaving the IDE.
- **Audio Sponsorships** ($15–$25 CPM) — podcast-style tips and product mentions. Premium "share of ear" during focused work.
- **Digest Placement** ($8–$15 CPM) — between-session newsletter-style placement. Lower CPM but high open rates and trust.

---

## 9. Developer Dashboard and Controls

### 9.1 Earnings Dashboard (Web + CLI)

```
╔══════════════════════════════════════════════════════╗
║  Dev Drip Dashboard                    February 2026  ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  💰 Balance: $14.72 USDC                             ║
║  📈 This month: $14.72 | Last month: $22.30          ║
║  🔥 Streak: 12 days                                  ║
║                                                      ║
║  ── Earnings Breakdown ──                            ║
║  Terminal TV:      $5.40  (38%)                       ║
║  Companion Tab:    $4.20  (29%)                       ║
║  Challenges:       $3.10  (22%)                       ║
║  Audio:            $1.02  (7%)                        ║
║  Digest:           $0.60  (4%)                        ║
║                                                      ║
║  ── Impact ──                                        ║
║  🌱 Open-source fund: $1.05 donated from your       ║
║     earnings to maintainers of packages you use      ║
║                                                      ║
║  [Withdraw $14.72] [Adjust Preferences] [View History]║
╚══════════════════════════════════════════════════════╝
```

### 9.2 Granular Control Panel

Developers configure every aspect of their ad experience:

- **Surfaces toggle** — Enable/disable each of the 6 surfaces independently
- **Frequency control** — Slider from "Minimal" (5 ads/day) to "Maximum" ($$$, 60 ads/day)
- **Category preferences** — Choose which ad categories to see (and which to block)
- **Time restrictions** — "No ads before 9 AM" / "No ads after 6 PM" / custom schedules
- **Audio toggle** — Separate on/off for audio surface
- **Idle sensitivity** — How long to wait before showing ads (3 sec to 15 sec)
- **Auto-payout** — Set threshold for automatic USDC withdrawal
- **Data sharing** — Control what anonymous data is shared with advertisers (location, tech stack, seniority level)

---

## 10. Launch Strategy

### Phase 1: Terminal-Only Beta (Months 1–3)

Start with the safest, most controllable surface:

- **The Retro Terminal TV** for Claude Code and terminal-based tools only
- **Between-Sessions Digest** as secondary surface
- Target: 1,000 beta developers from emerging markets and student communities
- Focus: Validate idle detection accuracy, measure developer tolerance, tune frequency caps
- Revenue: Subsidize through initial advertiser partnerships (5–10 developer tool companies)
- **No public launch** — invitation only to control narrative and prevent premature HN backlash

### Phase 2: VS Code Extension (Months 4–6)

- Add **Companion Tab** surface for VS Code and Cursor
- Launch **Sponsored Challenges** with 3–5 recruiting partners
- Open beta: 10,000 developers
- Begin ML-driven ad personalization (Duolingo's approach)
- First public communications: blog post framing product as "earn while agents work" (not "ads in your IDE")

### Phase 3: Full Platform (Months 7–12)

- All 6 surfaces available
- **Audio Companion** launches
- **Floating Widget** for standalone use
- Open to all developers
- Target: 100,000 active users
- Ad exchange opens to programmatic demand (not just direct deals)
- Developer-facing API for custom integrations

### Phase 4: Partnerships and Scale (Year 2)

- Partner with AI tool makers for native integration (our market research identifies this as the highest-leverage move)
- Explore "ad-supported free tier" partnerships with Cursor, Claude Code, or similar
- International expansion with localized ad inventory for India, Brazil, Southeast Asia
- Open-source fund reaches meaningful scale ($100K+/year distributed)

---

## 11. Risk Mitigation Strategies

Our market research identified 7 critical risks. Here's how each product decision mitigates them:

| Risk                                | Mitigation                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Developer backlash**              | Triple opt-in: install, enable, choose surfaces. "Retro TV" framing creates psychological distance. Launch silently with invite-only beta. 5% open-source fund creates goodwill narrative.              |
| **Platform gatekeepers**            | Terminal TV requires no marketplace approval (it's a CLI tool). VS Code extension follows marketplace policies. Long-term: partner with AI tool makers directly.                                        |
| **Insufficient revenue**            | Focus on rewarded-video-tier CPMs ($10–$20) through interactive content and challenges, not banner ads. Supplement with recruiting revenue ($20–$35 CPM).                                               |
| **Ad blockers (72% of developers)** | Native application rendering bypasses browser blockers. Ads are served through the SDK, not HTTP requests that DNS blockers can intercept. Content is rendered locally.                                 |
| **Shrinking idle windows**          | Bet on the agentic trend: multi-step autonomous agents (Claude Code, Devin, Cursor Agent) create LONGER wait times, not shorter. Between-sessions surface is immune to idle window changes.             |
| **Free tier competition**           | We don't compete with free tiers — we subsidize paid tiers. A developer using free Copilot + Dev Drip earnings can afford Cursor Pro. Different value proposition.                                      |
| **Chicken-and-egg**                 | Seed with 10 direct advertiser deals (developer tool companies). Guarantee minimum earnings ($0.10/day) through platform subsidy during beta. Use initial earnings data to attract programmatic demand. |

---

## 12. Success Metrics

| Metric                                           | Target (Month 6) | Target (Month 12) |
| ------------------------------------------------ | ---------------- | ----------------- |
| Active developers                                | 10,000           | 100,000           |
| Monthly retention                                | &gt;60%          | &gt;70%           |
| Avg monthly earnings per active dev              | &gt;$10          | &gt;$15           |
| Ad completion rate                               | &gt;85%          | &gt;90%           |
| Developer NPS                                    | &gt;30           | &gt;40            |
| Advertiser fill rate                             | &gt;40%          | &gt;70%           |
| Average eCPM (blended)                           | &gt;$8           | &gt;$12           |
| Time-to-dismiss (p95)                            | &lt;200ms        | &lt;150ms         |
| False-idle rate (ads shown during active coding) | &lt;1%           | &lt;0.1%          |
| Open-source fund distributed                     | &gt;$5,000       | &gt;$50,000       |

---

## 13. What We Explicitly Won't Do

These are boundaries that protect the product from becoming the thing developers hate:

1. **Never show ads during active coding.** Not even "subtle" ones. Zero tolerance.
2. **Never auto-play video with sound.** Audio is always separate opt-in.
3. **Never prevent the developer from working.** No modal dialogs, no "watch to continue" gates, no blocked functionality.
4. **Never collect or sell individual developer data.** All targeting is cohort-based. A developer's code, prompts, and output are never analyzed for ad targeting.
5. **Never create a proprietary token.** USDC only. No speculative incentives.
6. **Never show ads for products that compete with the developer's current toolchain** (e.g., don't show Cursor ads to a developer using VS Code with Copilot).
7. **Never make the ad-free experience worse to drive ad engagement.** The tool works identically with Dev Drip enabled or disabled.
8. **Never exceed the developer's stated frequency preferences.** If they say 5 ads/day, that's the absolute ceiling.

---

## 14. Open Questions for Further Research

1. **Partnership feasibility:** Would Cursor, Claude Code, or Copilot consider native Dev Drip integration as an "ad-supported free tier" option? What rev-share would they require?
2. **Terminal rendering limits:** How reliably can we render rich ANSI content across different terminal emulators (iTerm2, Windows Terminal, Alacritty, Kitty)?
3. **Recruiter economics:** Can sponsored coding challenges generate $30–$50 CPM reliably? What completion rates are recruiters willing to accept?
4. **Emerging market CPMs:** What CPMs can we realistically achieve for developer-targeted ads served to Indian, Brazilian, and Southeast Asian developers?
5. **Tax automation:** Can we build automated 1099-MISC generation for US developers earning &gt;$600/year, and equivalent compliance for other jurisdictions?
6. **Agent time prediction:** How accurately can we predict remaining agent task time to avoid showing ads for tasks that are about to complete? What signals are most predictive?

---

_This PRD is a living document. All specifications are subject to change based on beta testing feedback and advertiser demand signals._
