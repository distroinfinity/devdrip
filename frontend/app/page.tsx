import dynamic from "next/dynamic"
import { FloatingNav } from "@/components/ui/floating-navbar"

import { InlineNavbar } from "@/components/landing/inline-navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { DeadTimeSection } from "@/components/landing/dead-time-section"
import { Footer } from "@/components/landing/footer"

// below-fold sections — code-split JS, still SSR for SEO
const HowItWorksSection = dynamic(
  () =>
    import("@/components/landing/how-it-works-section").then((m) => ({
      default: m.HowItWorksSection,
    })),
  { ssr: true }
)
const SurfacesSection = dynamic(
  () =>
    import("@/components/landing/surfaces-section").then((m) => ({ default: m.SurfacesSection })),
  { ssr: true }
)
const YourRulesSection = dynamic(
  () =>
    import("@/components/landing/your-rules-section").then((m) => ({
      default: m.YourRulesSection,
    })),
  { ssr: true }
)
const PaymentRailSection = dynamic(
  () =>
    import("@/components/landing/payment-rail-section").then((m) => ({
      default: m.PaymentRailSection,
    })),
  { ssr: true }
)
const BuiltOnWorldSection = dynamic(
  () =>
    import("@/components/landing/built-on-world-section").then((m) => ({
      default: m.BuiltOnWorldSection,
    })),
  { ssr: true }
)
const InstallSection = dynamic(
  () => import("@/components/landing/install-section").then((m) => ({ default: m.InstallSection })),
  { ssr: true }
)

export default function Home() {
  return (
    <>
      <main className="relative min-h-screen">
        <InlineNavbar />

        <FloatingNav
          navItems={[
            { name: "How It Works", link: "#how-it-works" },
            { name: "Your Rules", link: "#your-rules" },
            { name: "Payouts", link: "#payment-rail" },
            { name: "World", link: "#built-on-world" },
          ]}
          ctaLabel="Install"
          ctaHref="#install"
        />

        <HeroSection />

        <DeadTimeSection />

        <HowItWorksSection />

        <SurfacesSection />

        <YourRulesSection />

        <PaymentRailSection />

        <BuiltOnWorldSection />

        <InstallSection />
      </main>

      <Footer />
    </>
  )
}
