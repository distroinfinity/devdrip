# Dev Drip — Landing Page Blueprint

**Purpose:** Complete messaging, section architecture, and content strategy for the Dev Drip landing page.  
**Status:** Pre-sprint brainstorm — to be used as the spec for building the actual page.  
**Date:** February 2026

---

## 0. The Messaging Problem We're Solving

Before anything else, let's name the three elephants in the room. Every visitor to this page will have these objections forming within 3 seconds:

```
Elephant 1: "Ads in my IDE? Absolutely not." (npm trauma)
Elephant 2: "Earn crypto? This is a scam." (Web3 fatigue)
Elephant 3: "Another dev tool I don't need." (Tool fatigue)
```

The entire landing page is an exercise in **defusing these three reactions** before the visitor's reflexive close-tab kicks in. We have roughly 6 seconds (the TikTok rule from our PRD research — 90% of ad recall happens in the first 6 seconds of attention). The hero must accomplish three things simultaneously:

1. **Reframe** — This isn't ads-in-your-IDE. It's earning during dead time.
2. **Ground** — This isn't crypto speculation. It's USDC. Dollars. Stable.
3. **Belong** — This was built by devs who hate ads too. That's WHY it works this way.

---

## 1. Landing Page Principles (Derived from Brand Philosophy)

These are non-negotiable constraints that flow directly from our "Industrial Paper" design system and PRD:

### 1.1 Show the Machinery

From DESIGN*SYSTEM.md: *"The financial machinery is visible. You see the USDC flowing. You see the CPM math. You see the ad lifecycle states. We don't hide behind smooth abstractions — we expose the system, and that exposure IS the trust signal."\_

**On the landing page this means:**

- Don't say "earn money." Show the `+$0.03` counter ticking up in real-time.
- Don't say "non-intrusive ads." Show the Terminal TV appearing and vanishing.
- Don't say "you're in control." Show the `[S]kip  [K]ill  [M]ute 30min` keybindings.
- Don't say "transparent payments." Show the USDC transaction on Base with the $0.002 fee.

**The page itself should feel like inspecting source code** — everything is visible, nothing is hidden behind marketing language.

### 1.2 No Selling, Only Demonstrating

The user's directive: _"We are not selling anything to anyone, it's a tool built by devs for devs."_

This changes the entire tone. We're not persuading. We're showing. The page reads more like a well-written README.md than a SaaS marketing site. Think:

- **Stripe's docs** (precise, factual, let the product speak)
- **Linear's changelog** (opinionated but earned, not performative)
- **Nothing's product pages** (let the design do the talking)

No "revolutionize your workflow." No "unlock your earning potential." No testimonial carousel from fictional users. Just: here's what it does, here's exactly how, here's the math, try it.

### 1.3 Own the Ads Thing

From the user: _"We do ads, we own it, but we don't sell you ads — our ads are cool."_

The worst thing we can do is be defensive about ads. The npm backlash happened because ads were **snuck in**. We do the opposite — we lead with it, explain why it's different, and show it working. The confidence IS the differentiator.

Messaging direction:

- "Yes, there are ads. Here's exactly what they look like."
- "You press S to skip. K to kill. M to mute for 30 minutes."
- "Every ad vanishes in under 200ms when you start typing."
- "We think developer-tool discovery is genuinely useful content — not an interruption."

### 1.4 The Monochrome Conviction on the Page Itself

The landing page IS the first product experience. If we claim "precision, not flash" but the landing page has gradient heroes and bouncy animations, we've already lied. The page must embody:

- Pure monochrome (desaturate test: nothing changes)
- Space Mono headlines, DM Sans body, JetBrains Mono for every dollar figure
- Dot-grid textures as the atmospheric element
- No colored CTAs — dark ink on paper or white on terminal
- The `$14.72` in JetBrains Mono Bold IS the hero visual, not an illustration

---

## 2. Hero Section

### 2.1 The Core Message

The hero must accomplish our 6-second job. Several directions explored below — pick and refine:

**Direction A: "The Reframe" (Lead with what changes)**

```
Headline:    Your agent is working. You're earning.
Subhead:     Dev Drip turns AI coding tool idle time into USDC
             micropayments. Opt-in. Skip anything. Kill anytime.
CTA:         [Join the Waitlist]
Data strip:  $14.72 this month  |  2,725 impressions  |  <200ms dismiss
```

**Direction B: "The Honesty Play" (Lead with the elephant)**

```
Headline:    We put ads in your terminal.
             And developers actually want them.
Subhead:     Opt-in content that only appears while your AI agent
             is thinking. Press S to skip. Press K to kill. Earn USDC.
CTA:         [Join the Waitlist]
Data strip:  70% revenue share  |  USDC on Base  |  5% to open source
```

**Direction C: "The Money Signal" (Lead with JetBrains Mono)**

```
Headline:    $14.72
             earned this month while your agent coded.
Subhead:     Dev Drip shows opt-in developer content during AI tool
             idle time. You earn USDC. You control everything.
CTA:         [Join the Waitlist]
Data strip:  4,700+ beta devs  |  $0.002 transaction fee  |  skip anything
```

**Direction D: "The Developer Vernacular" (Lead with the terminal)**

```
Headline:    $ dev-drip --status
             > earning: $14.72 this month
             > surface: terminal-tv (active)
             > last_ad: skipped (0.3s ago)
Subhead:     A CLI companion that earns you USDC while AI agents
             think. Opt-in only. One keypress to dismiss.
CTA:         [Join the Waitlist]
```

### 2.2 Hero Visual Treatment

The hero should NOT be an illustration or abstract graphic. It should be one of:

**Option 1: Live Earnings Counter**
The signature `EarningsCounter` component from our design system, ticking up in real-time with the `+$0.03` animation. The counter IS the hero. Nothing else needed. JetBrains Mono 700 at large scale on warm paper with dot-grid texture.

**Option 2: Terminal TV Embed**
An actual working Terminal TV component rendered in the hero — showing the retro CRT frame, a rotating ad, the `[D]iscover [S]kip [M]ute` controls, and the progress bar. The visitor sees the product in the first fold.

**Option 3: Split Terminal + Counter**
Left side: a simulated terminal showing an agent working (`⠋ Thinking...`) with the Terminal TV below it. Right side: the earnings counter ticking up. The visitor sees the cause (agent working) and effect (money accumulating) simultaneously.

### 2.3 Hero Data Strip

Below the headline, a row of key metrics in JetBrains Mono — our "Bloomberg strip." This is the "show the machinery" principle. Possible data points:

| Data Point             | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `$14.72 this month`    | Makes earnings tangible (not "up to" — an actual realistic number) |
| `<200ms dismiss`       | Signals respect for developer time                                 |
| `70% to you`           | Revenue split transparency                                         |
| `USDC on Base`         | Grounds the crypto element (stablecoin, not speculation)           |
| `5% to open source`    | Community angle                                                    |
| `[S]kip [K]ill [M]ute` | Shows control in one glance                                        |

Pick 3-4 of these. The strip itself IS a trust signal — we're leading with specifics, not promises.

---

## 3. Section Architecture

### Section 1: HERO

_Goal: 6-second reframe. Name the thing, show it working, make it real._

See Section 2 above for detailed options.

---

### Section 2: "THE DEAD TIME" — Problem Statement

_Goal: Make the visitor feel the problem viscerally. They should nod and think "yeah, that's me."_

**Messaging direction:**

The setup is universal to anyone using agentic AI tools. Don't lecture — describe their actual experience:

```
Your agent is refactoring 4 files. The spinner is spinning.
You can't code — the agent is in the files. You can't leave —
it might need input in 30 seconds. So you check Slack. Scroll
Twitter. Stare at the terminal.

That's 15 to 60 minutes every day. Dead time.

Dev Drip fills it with something that actually pays you.
```

**Visual treatment:**

A simulated terminal or IDE showing an agent working, with a subtle clock/timer accumulating idle time. Show the real experience: `⠋ Claude Code: Refactoring auth module across 4 files...` with a counter below: `idle time today: 34 min`. No stock photos. No illustrations. Just the actual developer experience, rendered in our terminal aesthetic.

**Key data points to surface:**

- 15–60 minutes daily idle time (from PRD research)
- 85% of developers now use AI coding tools regularly
- Agentic tasks take 30 seconds to several minutes
- This idle window is GROWING as agents take on more complex tasks

**Tone:** Empathetic observation, not dramatic pain-point marketing. The visitor should feel _seen_, not sold to.

---

### Section 3: "HOW IT WORKS" — The Three-Step Flow

_Goal: Demystify the product in under 30 seconds of reading._

**The flow in three beats:**

```
1. YOUR AGENT STARTS WORKING
   Dev Drip detects the idle state. Waits 3 seconds.
   (Nothing appears during quick completions — only agentic tasks.)

2. CONTENT APPEARS
   A native-looking panel shows a developer tool recommendation,
   a sponsored tip, or a coding challenge. You choose what you see.

3. YOU EARN USDC
   $0.01–$0.10 per impression, deposited in real-time.
   70% to you. 5% to open-source maintainers of packages you use.

   → And the moment you start typing, everything vanishes in <200ms.
```

**Visual treatment:**

The state machine from our PRD, but made visual and animated:

```
ACTIVE (coding) → WARMING (3s grace) → IDLE (earning) → ACTIVE (typing)
                                                              ↑
                                                     <200ms vanish
```

This could be an interactive component: the visitor sees a simulated agent task start, the warming state appear, the Terminal TV slide in, earnings tick up, then a simulated keypress makes everything vanish instantly. **The speed of the vanish IS the selling point** — make the visitor feel it.

**Critical messaging detail:**

- Emphasize that inline completions (30-200ms) NEVER trigger content
- Only agentic tasks that create genuine waiting
- 8-second minimum idle before first content appears
- First 10 minutes of any session are always content-free

---

### Section 4: "THE SURFACES" — What the Ads Actually Look Like

_Goal: Show, don't tell. Let the visitor see every ad format and judge for themselves._

This is the section where we own the ads thing completely. Show all six surfaces as live, interactive components:

**Surface showcase (tabbed or scrollable):**

| Surface                 | Visual                                               | Key Detail                                                |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| **Terminal TV**         | Live component — the retro CRT frame in the terminal | "Rendered in pure ANSI. Feels like it belongs."           |
| **Companion Tab**       | VS Code mockup with the tab appearing unfocused      | "Opens alongside your code. Never steals focus."          |
| **Idle Widget**         | Floating mini-player style widget                    | "Works across any IDE. Minimizes to a pill."              |
| **Morning Digest**      | Newsletter-style card                                | "2-3 curated items at session start. That's it."          |
| **Sponsored Challenge** | MongoDB quiz in terminal frame                       | "Earn $0.10 while learning. Recruiters pay, you benefit." |
| **Audio Companion**     | Waveform visualization + transcript                  | "Eyes stay on terminal. 15 seconds max."                  |

**For each surface, show:**

1. The actual UI component (from our design system)
2. The dismiss mechanism (`[S]kip`, `[K]ill`, Tab closes, etc.)
3. The earning rate for that surface

**Messaging per surface — not "feature marketing" but "here's what happens":**

Don't say: "The Terminal TV is a revolutionary new ad format."
Say: "When your agent is thinking, a small bordered panel appears below the output. It shows a developer tool you might actually want to know about. Press S to skip. Press K to kill it. Press M to mute for 30 minutes. It vanishes the instant you type."

**The native-to-environment principle must be visible:**
Show that Terminal TV is rendered in ANSI/Unicode. Show that the Companion Tab looks like a VS Code panel. Show that the Digest looks like a morning newsletter. The content becomes part of the environment, not a foreign intrusion.

---

### Section 5: "YOUR RULES" — The Control Panel

_Goal: Obliterate the "I'll lose control" fear. Show the granularity of developer agency._

This is where we differentiate from every ad platform ever. Show the actual control panel:

**Controls to showcase:**

```
SURFACES         ░ Terminal TV    ☑ on
                 ░ Companion Tab  ☑ on
                 ░ Challenges     ☑ on
                 ░ Audio          ☐ off
                 ░ Widget         ☑ on
                 ░ Digest         ☑ on

FREQUENCY        ├──────●────────┤
                 Minimal (5/day)    Max (60/day)

IDLE SENSITIVITY ├────●──────────┤
                 3 sec              15 sec

SCHEDULE         No content before [9:00 AM]
                 No content after  [11:00 PM]

CATEGORIES       ☑ Dev tools  ☑ Infrastructure  ☐ Recruiting
                 ☑ Databases  ☐ Education        ☑ Open source
```

**Messaging:**

```
You configure everything.

Which surfaces show content. How often. What categories.
What time of day. How long to wait before anything appears.

We even reduce frequency by 50% after 11 PM because
you're tired and your tolerance is lower. We thought about that.

If you say 5 ads per day, that's the ceiling. Not the target.
```

**The "What We Won't Do" list** (from PRD Section 13) should appear here or near here. Turn the 8 boundaries into a compact, scannable commitment:

```
NEVER    show content during active coding
NEVER    auto-play video with sound
NEVER    block you from working
NEVER    analyze your code for targeting
NEVER    create a speculative token
NEVER    show competitor ads for your current tools
NEVER    degrade the ad-free experience
NEVER    exceed your frequency preferences
```

This list is the trust anchor. It's our "Terms of Engagement" — and presenting it proactively signals confidence.

---

### Section 6: "THE MATH" — Transparent Earnings Breakdown

_Goal: Ground the promise in real numbers. No "up to" language. Show the actual model._

From our design system: money is communicated through JetBrains Mono Bold, tabular alignment, and density. This section should feel like a Bloomberg terminal — all data, no decoration.

**Earnings table:**

| Profile                         | Daily Idle Time | Daily Views | Monthly Earnings |
| ------------------------------- | --------------- | ----------- | ---------------- |
| Light user (autocomplete only)  | 5 min           | 5–10        | $1–$3            |
| Moderate (some agentic tasks)   | 20 min          | 30–50       | $8–$15           |
| Heavy agentic user              | 45 min          | 60–90       | $18–$30          |
| Power user + challenges + audio | 60 min          | 80–120      | $25–$40          |

**Revenue split visualization:**

```
For every $1.00 of ad revenue:

$0.70  →  You                    ████████████████████░░░░░░░░
$0.25  →  Platform operations    █████████████░░░░░░░░░░░░░░
$0.05  →  Open-source fund       ███░░░░░░░░░░░░░░░░░░░░░░░░
```

**Subscription offset progress bar** (from design system):

```
Cursor Pro Offset
$14.72 / $20.00
████████████████████░░░░░░  73.6% covered this month
```

**Messaging:**

```
We won't promise you'll get rich.

A moderate user covering 20 minutes of daily idle time
earns roughly $8–$15/month. That's most of a Copilot Pro
subscription. A heavy Claude Code user could cover their
entire Cursor Pro plan.

These numbers assume $10–$15 eCPMs for developer-targeted
rewarded content. Here's how we calculated them.
  → [Show me the full model]
```

**Why this works:** Developers respect math. Showing the CPM assumptions, the impression counts, and the revenue split formula treats the visitor as an intelligent adult who can evaluate the economics themselves. Contrast with crypto projects that promise vague "rewards" — we show the spreadsheet.

---

### Section 7: "THE PAYMENT RAIL" — USDC, Not Magic Internet Money

_Goal: Kill the "crypto scam" reflex in 10 seconds._

**Messaging:**

```
USDC. Not a token. Not speculative. Dollars.

Your earnings arrive as USDC stablecoins on Base
(Coinbase's L2). Transaction fees: $0.002. That's not
a typo. Traditional payment rails charge $0.30–$0.50
minimum per transaction — which makes sending someone
$0.03 impossible.

Crypto solves one specific problem here: micropayments
that would be economically impossible any other way.

→ Cash out to your bank via Coinbase anytime
→ Minimum payout: $1.00 (1-2 days of use)
→ Or hold USDC — it's pegged to the dollar
→ Real-time balance visible in your dashboard and CLI
```

**Visual treatment:** Show a simulated USDC transaction: from Dev Drip to the developer's wallet, with the fee shown. The `0xA1b2...F9e3` address in JetBrains Mono. Factual, grounded, inspectable.

**Key anti-scam signals:**

- "USDC" not "our token" — immediately signals stability
- "Coinbase's L2" — associates with trusted brand
- "$0.002 fee" — specific number, not marketing language
- "Cash out to your bank" — escape hatch to traditional finance
- The DESIGN_SYSTEM.md anti-scam checklist should be satisfied here

**What NOT to do:**

- No "to the moon" language
- No token price charts
- No "staking" or "yield" language
- No Coinbase Blue — we reference Base factually, not decoratively
- No "blockchain" in the hero or above the fold

---

### Section 8: "THE OPEN SOURCE FUND" — 5% to Maintainers

_Goal: Turn "this company profits from ads" into "this company funds the ecosystem."_

**Messaging:**

```
5% of all ad revenue goes directly to open-source
maintainers of the packages in your dependency tree.

You install express, lodash, and zod? The maintainers
of those projects earn from your Dev Drip activity —
automatically.

It's not charity. It's the supply chain getting paid.
```

**This section serves a dual purpose:**

1. **Goodwill** — it's genuinely a good thing
2. **Narrative armor** — when the inevitable HN thread appears, "but 5% goes to open source" is a talking point that shifts the conversation

**Visual treatment:** Show a dependency tree (like `npm ls --depth=1`) with earnings flowing to maintainer nodes. Make the machinery visible.

**Data point for launch:** "Goal: $50,000 distributed to open-source maintainers in year one."

---

### Section 9: "FOR DEVELOPERS WHO FEEL THE COST" — Emerging Market Angle

_Goal: Acknowledge the strongest use case without being patronizing._

From our market research: _"Entry-level developer salaries of $4,500–$9,000/year mean a $20/month AI tool subscription consumes 2.7–5.3% of annual income."_

**Messaging (careful — must not be condescending):**

```
A $20/month AI subscription is 0.2% of a US developer's
annual income. For a developer in Bangalore, Lagos, or
São Paulo, it's closer to 5%.

Dev Drip exists so the cost of AI tools doesn't determine
who gets to use them.
```

**Tone:** Factual, not savior-complex. State the math. Let the reader draw their own conclusions. The numbers speak for themselves.

**Visual:** A simple comparison showing $20/month as a percentage of income across 3-4 markets. JetBrains Mono tabular figures. No flags, no illustrations of people.

---

### Section 10: "FAQ / OBJECTION HANDLING" — The Honest Answers

_Goal: Address every objection a developer will have, directly and without spin._

This section should feel like a well-written FAQ in a GitHub README — direct, technical, honest. No corporate evasion.

**Q: Aren't ads in developer tools a terrible idea?**

```
The npm terminal ads experiment of 2019 was terrible because
ads were injected into a package manager without consent during
an install process. The community was right to revolt.

Dev Drip is different in every way that matters:
- You install it on purpose
- You enable it explicitly
- You choose which surfaces show content
- You dismiss anything with one keypress
- Nothing appears during active coding — ever

The npm lesson isn't "developers hate ads." It's "developers
hate losing control." We agree. That's why you have all of it.
```

**Q: Will this slow down my IDE / terminal?**

```
The SDK adds <2ms of latency to idle detection.
Ad content is pre-fetched and rendered locally.
The <200ms vanish time is a hard engineering requirement,
not a marketing claim — we measure it in CI.
```

**Q: Is this a crypto scam?**

```
We use USDC (a dollar-pegged stablecoin) because it's the
only way to send someone $0.03 without the transaction fee
being larger than the payment. We don't have a token.
There's nothing to speculate on. It's dollars with
cheaper plumbing.
```

**Q: What data do you collect?**

```
Cohort-level targeting only. We know "developer using
VS Code in the US" — not your name, your code, or your
prompts. Your code never leaves your machine for ad
targeting. You control what anonymized data is shared
in Settings → Data Sharing.
```

**Q: What if my AI tool gets faster and idle time shrinks?**

```
Inline completions (30-200ms) already don't trigger content.
But the trend is toward more agentic, multi-step AI tasks —
Claude Code, Cursor Agent, Devin — which take longer, not shorter.
Our between-sessions Digest is immune to idle time changes entirely.
We're betting on the agentic future.
```

**Q: Can I use an ad blocker?**

```
Content is rendered natively by the SDK, not fetched via HTTP
requests that DNS blockers intercept. But honestly — you opted
into this. If you want to stop, just disable it. We'd rather
you toggle us off than fight us with a Pi-hole.
```

**Q: How do taxes work?**

```
Crypto earnings are taxable income in most jurisdictions.
We issue 1099-MISC for US users earning over $600/year.
Your dashboard shows a full earnings history exportable
for tax reporting. Talk to your accountant — we're not one.
```

---

### Section 11: "WE'RE BUILDING THIS" — The Waitlist

_Goal: Convert interest into a signup. Signal momentum without faking it. Convey: this is real, it's being built, and it's coming soon._

**Messaging:**

This is NOT a concept deck or a pitch for investors. Dev Drip is being built right now. The section should feel like a commit message, not a press release.

```
Dev Drip is in active development.

The idle detection engine works. The Terminal TV renders.
The USDC payment rail is integrated. We're wiring it all
together and testing with a small group of developers.

We'll be in business soon.

Join the waitlist — we're onboarding developers in waves
and early signups get first access.

→ [email input]  [Join the Waitlist]

No spam. One email when it's your turn.
```

**Visual treatment:**

The waitlist section should feel like a milestone tracker — showing progress without promising dates. Think of it as a `git log --oneline` of the product:

```
✓  Idle detection engine          shipped
✓  Terminal TV surface            shipped
✓  USDC on Base payment rail      shipped
✓  Earnings dashboard             shipped
◐  Companion Tab (VS Code)        in progress
○  Sponsored Challenges           next
○  Audio Companion                planned
○  Open beta                      soon
```

This does two things:

1. **Proves the product is real** — specific components are done, not "coming soon™"
2. **Creates anticipation** — the visitor sees what's next and wants to be there when it ships

**The waitlist form itself:**

Minimal. One field: email. One button: "Join the Waitlist" in our monochrome primary button style (dark ink on paper). No name, no company, no "what tools do you use" survey. Reduce friction to zero.

Below the form, a single line:

```
We'll email you once. When it's your turn.
```

**Optional: counter showing waitlist size**

If we want social proof without fabricating it:

```
1,247 developers on the waitlist
```

Only show this when the number is real and meaningful (>500). If we're at 12 signups, don't show it — it hurts more than helps. When it does appear, render it in JetBrains Mono Bold with tabular figures. The number itself is the social proof.

**The waitlist button also lives in:**

- The **hero section** (primary CTA on first fold — the most important placement)
- The **nav bar** (persistent across scroll — always accessible)
- The **waitlist section** near the bottom (for visitors who scrolled the whole page and are now convinced)

Three touchpoints, same button, same destination. No other CTAs compete for attention.

---

### Section 12: FOOTER

Minimal. The footer should contain:

- Dev Drip wordmark (Space Mono)
- Links: Docs, GitHub, Privacy, Terms
- "Powered by USDC on Base" (JetBrains Mono, ink-faint)
- No social media icons unless we have actual accounts

---

## 4. Messaging Tone Guide (For All Copy)

### 4.1 Voice Characteristics

| Characteristic | Description                                | Example                                              |
| -------------- | ------------------------------------------ | ---------------------------------------------------- |
| **Precise**    | Use specific numbers, never vague promises | "$0.03 per view" not "earn rewards"                  |
| **Technical**  | Speak developer-to-developer               | "rendered in ANSI/Unicode" not "beautiful interface" |
| **Honest**     | Name the risks and trade-offs              | "earnings depend on CPM rates and your idle time"    |
| **Calm**       | No urgency, no hype, no exclamation marks  | "Try it if it sounds useful" not "Don't miss out!"   |
| **Dry**        | Subtle wit, never forced                   | The `--status` terminal hero direction is peak tone  |

### 4.2 Words We Use

```
content        (not "ads" in most contexts — but never hide from "ads" either)
earn           (not "rewards" or "incentives")
USDC           (not "crypto" as primary framing)
opt-in         (not "enable" or "activate")
dismiss        (not "close" or "remove")
surfaces       (not "ad placements" or "slots")
idle time      (not "downtime" or "wasted time")
developer      (not "user" — they're a peer)
```

### 4.3 Words We Never Use

```
revolutionize, unlock, supercharge, reimagine, leverage
moon, pump, yield, stake, hodl, web3, defi
passive income, side hustle, money while you sleep
FREE (as a screaming headline)
limited time, act now, don't miss out
```

### 4.4 Capitalization Rules

- Headlines: Sentence case ("Your agent is working. You're earning.")
- Product name: "Dev Drip" (capitalized) or `dev-drip` (CLI context)
- Surfaces: Title case when naming ("Terminal TV", "Companion Tab")
- Data labels: ALL CAPS in tiny size only (per design system)

---

## 5. Interactive / Animated Elements

The landing page should have a few high-impact interactive moments, not scattered micro-animations. Each one demonstrates the product rather than decorating the page.

### 5.1 The Live Earnings Counter (Hero)

The `EarningsCounter` component from our design system. It ticks up every ~4 seconds with the `+$0.03` animation. The visitor watches money accumulate — this is the emotional hook. No color needed; the JetBrains Mono Bold and the subtle glow pulse do the work.

### 5.2 The Terminal TV Demo (Surfaces Section)

An interactive Terminal TV that the visitor can interact with:

- Press `S` to skip to next content
- Press `D` to "discover" (opens nothing, but shows the interaction)
- Press `M` to mute (shows "Muted for 30 min" confirmation)
- The progress bar animates
- Content rotates every 15 seconds

This is the strongest trust-building element. The visitor experiences the actual ad dismiss flow and thinks "oh, this IS actually one keypress."

### 5.3 The Vanish Demo (How It Works Section)

A button or simulated keypress that demonstrates the <200ms vanish. The visitor clicks "Simulate typing" and watches all content disappear instantly. The speed IS the product. Make them feel it.

### 5.4 The Dot-Grid Heartbeat (Background)

Across earning-related sections, the dot-grid texture pulses subtly (opacity 0.3 to 0.5, 3-second sine wave). It's the "machinery humming" signal from our design system. Subtle enough to be subliminal, distinctive enough to remember.

---

## 6. Page Structure Summary (Scrolling Order)

```
┌─────────────────────────────────────────────────┐
│  NAV BAR                                        │
│  Logo (Space Mono) | Docs | GitHub | [Waitlist]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  HERO                                           │
│  Headline + Subhead + [Join the Waitlist] CTA    │
│  Live Earnings Counter or Terminal TV            │
│  Bloomberg Data Strip                           │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  THE DEAD TIME                                  │
│  Problem visualization                          │
│  "15-60 min of idle time daily"                 │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  HOW IT WORKS                                   │
│  3-step flow + state machine animation          │
│  Interactive vanish demo                        │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  THE SURFACES                                   │
│  Tabbed showcase of all 6 content surfaces      │
│  Interactive Terminal TV demo                    │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  YOUR RULES                                     │
│  Control panel showcase                         │
│  "What we will NEVER do" list                   │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  THE MATH                                       │
│  Earnings table + Revenue split                 │
│  Subscription offset progress bar               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  PAYMENTS                                       │
│  USDC on Base explanation                       │
│  Transaction visualization                      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  OPEN SOURCE FUND                               │
│  5% to maintainers + dependency tree visual     │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  FOR DEVELOPERS WORLDWIDE                       │
│  Emerging market cost comparison                │
│  (Optional — might fold into hero or math)      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  FAQ                                            │
│  Direct answers to hard questions               │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  WE'RE BUILDING THIS                            │
│  Progress tracker + email waitlist              │
│  "We'll be in business soon."                   │
│                                                 │
├─────────────────────────────────────────────────┤
│  FOOTER                                         │
│  Logo | Docs | GitHub | Privacy | Terms         │
│  "Powered by USDC on Base"                      │
└─────────────────────────────────────────────────┘
```

**Estimated section count: 10-12**
**Estimated scroll depth: 6-8 viewport heights**
**Target: <3 minutes to read completely**

---

## 7. What the Page Does NOT Have

This list is as important as what's on the page:

1. **No testimonials or social proof from fictional users** — we're in beta. Don't fabricate. When real users exist, add real quotes.
2. **No comparison table vs competitors** — we don't have competitors in this exact space. Comparing to Brave or Spotify is misleading.
3. **No pricing page** — it's free. The developer earns money, they don't pay money.
4. **No "as seen in" press logos** — until actual press coverage exists.
5. **No animated hero illustration** — the product IS the visual.
6. **No video explainer** — the interactive components explain better than a video.
7. **No cookie consent banner nightmare** — we're privacy-first. Minimal tracking.
8. **No chat widget** — we have a GitHub for that.
9. **No "our team" section** — unless we decide the "built by devs" credibility requires showing real humans.
10. **No dark mode toggle on the landing page?** — (Open question: do we default to system preference and let them toggle, or do we commit to the light "paper" aesthetic for the page?)

---

## 8. SEO and Meta Strategy

### 8.1 Primary Keywords

- "earn while coding" (new category we're defining)
- "AI coding tool idle time"
- "developer ad monetization"
- "free AI coding subscription"
- "USDC developer payments"

### 8.2 Meta Tags Direction

```
Title: Dev Drip — Earn USDC while your AI agent codes
Description: Opt-in developer content during AI tool idle time.
             Earn $10-25/month in USDC micropayments. One keypress to dismiss.
```

### 8.3 Open Graph Image

A monochrome card showing the Terminal TV component with earnings counter. Should look like a screenshot of the actual product, not a marketing graphic. JetBrains Mono `$14.72` prominent.

---

## 9. Mobile Considerations

Developers will likely first see this page on desktop (they're at their IDE). But mobile visitors (from Twitter/X links, HN comments) need a coherent experience:

- Terminal TV demo should work on mobile (tap to skip, swipe to dismiss)
- Earnings counter should be the hero on mobile too
- The data strip wraps gracefully
- Interactive demos fall back to static screenshots with captions
- The FAQ section is the most important on mobile (people following an HN link want answers to objections)

---

## 10. Launch Narrative Strategy

The landing page doesn't exist in isolation. It's the anchor of a launch narrative:

**Sequence:**

1. **Landing page goes live** (quiet, no announcement)
2. **Blog post** — "Why we built Dev Drip" (honest, technical, addresses npm precedent directly)
3. **GitHub repo** — open source the SDK (or at minimum, the idle detection engine)
4. **Invite-only beta** — 1,000 developers, primarily from emerging market and student communities
5. **HN post** — "Show HN: Dev Drip — earn USDC during AI coding tool idle time" (from a real developer account, not a marketing account)

**The landing page must be ready for the HN audience** — the most skeptical, ad-hostile, technically literate group on the internet. If it survives HN comments, it works everywhere.

---

## 11. Open Questions for You

Before I finalize this into a sprint-ready spec, I want to understand a few things:

**Messaging Decisions:**

1. **Hero direction** — I offered 4 hero directions (The Reframe, The Honesty Play, The Money Signal, The Developer Vernacular). Which resonates most? Or should I combine elements?

2. **"Ads" vs "Content" language** — How aggressive do we want to be about owning the word "ads"? Direction B says "We put ads in your terminal" upfront. Direction A avoids the word. The PRD uses "content" more often. Where do you land?

3. **The emerging market section** — Include it as its own section, fold it into the hero/math sections, or save it for the blog post? There's a risk of seeming like "this is for cheap people" if positioned wrong.

**Product/Technical Decisions:**

4. **Launch model** — ✅ Decided: Waitlist. The page signals "we're building this" and collects emails. The CTA is "Join the Waitlist" in the hero, nav, and dedicated section near the bottom.

5. **Dark mode toggle** — Do we give visitors a toggle (showing we support both themes), or commit to light "paper" mode for the landing page to make a stronger brand statement?

6. **Interactive demos** — How much engineering effort do we want in the landing page? A fully interactive Terminal TV demo with keyboard shortcuts is a sprint in itself. Do we do live components or high-fidelity static mockups?

7. **Open source angle** — Is any part of Dev Drip open source? If so, the GitHub link becomes a primary CTA. If not, what does the GitHub presence look like?

8. **"For Advertisers" section** — Do we need a secondary audience path for advertisers who want to buy inventory? Or is that a separate page entirely?

---

_This document is the input for the sprint plan. Once the open questions are resolved, every section becomes a buildable ticket._
