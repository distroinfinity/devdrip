import { Nav } from "@/components/landing/nav"
import { HeroSection } from "@/components/landing/hero-section"
import { LineageSection } from "@/components/landing/lineage-section"
import { MoneySection } from "@/components/landing/money-section"
import { ClosingSection } from "@/components/landing/closing-section"
import { Footer } from "@/components/landing/footer"

// four sections, one idea each: the thesis, the lineage, the money, the two doors
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <LineageSection />
        <MoneySection />
        <ClosingSection />
      </main>
      <Footer />
    </>
  )
}
