import { Nav } from "@/components/landing/nav"
import { HeroSection } from "@/components/landing/hero-section"
import { ShiftSection } from "@/components/landing/shift-section"
import { LineageSection } from "@/components/landing/lineage-section"
import { SidesSection } from "@/components/landing/sides-section"
import { TerminalSection } from "@/components/landing/terminal-section"
import { RulesSection } from "@/components/landing/rules-section"
import { AdvertisersTeaser } from "@/components/landing/advertisers-teaser"
import { InstallSection } from "@/components/landing/install-section"
import { Footer } from "@/components/landing/footer"
import { getMarketRows, getNewsItems } from "@/lib/landing-data"

// revalidate the live market/news data shown in the channel cards
export const revalidate = 60

export default async function Home() {
  const [marketRows, newsItems] = await Promise.all([getMarketRows(), getNewsItems()])
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <ShiftSection />
        <LineageSection />
        <SidesSection />
        <TerminalSection />
        <RulesSection marketRows={marketRows} newsItems={newsItems} />
        <AdvertisersTeaser />
        <InstallSection />
      </main>
      <Footer />
    </>
  )
}
