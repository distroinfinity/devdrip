import { Nav } from "@/components/landing/nav"
import { HeroSection } from "@/components/landing/hero-section"
import { ChannelsSection } from "@/components/landing/channels-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { ControlSection } from "@/components/landing/control-section"
import { InstallSection } from "@/components/landing/install-section"
import { Footer } from "@/components/landing/footer"

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <ChannelsSection />
        <HowItWorksSection />
        <ControlSection />
        <InstallSection />
      </main>
      <Footer />
    </>
  )
}
