import { Nav } from "@/components/landing/nav"
import { HeroSection } from "@/components/landing/hero-section"
import { DeadTimeSection } from "@/components/landing/dead-time-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { ChannelsSection } from "@/components/landing/channels-section"
import { AdvertisersTeaser } from "@/components/landing/advertisers-teaser"
import { ControlSection } from "@/components/landing/control-section"
import { InstallSection } from "@/components/landing/install-section"
import { Footer } from "@/components/landing/footer"
import { getMarketRows, getNewsItems } from "@/lib/landing-data"

// revalidate live market/news data on the hero panel periodically
export const revalidate = 60

export default async function Home() {
  const [marketRows, newsItems] = await Promise.all([getMarketRows(), getNewsItems()])
  return (
    <>
      <Nav />
      <main>
        <HeroSection marketRows={marketRows} newsItems={newsItems} />
        <DeadTimeSection />
        <HowItWorksSection />
        <ChannelsSection />
        <AdvertisersTeaser />
        <ControlSection />
        <InstallSection />
      </main>
      <Footer />
    </>
  )
}
