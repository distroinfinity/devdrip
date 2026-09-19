import { multiselect, select, isCancel, cancel } from "@clack/prompts"
import { AdCategory, ChannelMode } from "@distrotv/shared"

const CATEGORY_LABELS: Record<AdCategory, string> = {
  [AdCategory.CloudInfrastructure]: "Cloud & infrastructure",
  [AdCategory.DeveloperTools]: "Developer tools",
  [AdCategory.Databases]: "Databases",
  [AdCategory.MonitoringObservability]: "Monitoring & observability",
  [AdCategory.DeveloperRecruiting]: "Developer recruiting / jobs",
  [AdCategory.DeveloperEducation]: "Developer education",
  [AdCategory.SaasProducts]: "SaaS products",
}

const ALL_CATEGORIES = Object.values(AdCategory) as AdCategory[]

// select prompt for channel mode. order: news → markets → mix, default mix.
export async function pickChannelMode(current?: ChannelMode): Promise<ChannelMode> {
  const initialValue = current ?? ChannelMode.Mix
  const choice = await select<ChannelMode>({
    message: "pick a channel mode",
    options: [
      { value: ChannelMode.News, label: "news — every slot is news (HN, TechCrunch, Bloomberg)" },
      { value: ChannelMode.Markets, label: "markets — every slot is a watchlist ticker (M4)" },
      { value: ChannelMode.Mix, label: "mix — alternates news + markets (recommended)" },
    ],
    initialValue,
  })
  if (isCancel(choice)) {
    cancel("cancelled")
    process.exit(0)
  }
  return choice as ChannelMode
}

// multiselect pre-checks allowed categories (inverse of currentBlocked).
// returns blocked categories — caller writes that shape to the backend.
export async function pickCategories(currentBlocked: AdCategory[]): Promise<AdCategory[]> {
  const preCheckedAllowed = ALL_CATEGORIES.filter((c) => !currentBlocked.includes(c))
  const selected = await multiselect<AdCategory>({
    message: "Which categories would you like to see ads from?",
    options: ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    initialValues: preCheckedAllowed,
    required: false,
  })
  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }
  const allowed = selected as AdCategory[]
  return ALL_CATEGORIES.filter((c) => !allowed.includes(c))
}
