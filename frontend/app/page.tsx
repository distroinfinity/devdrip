import { DotGrid } from "@/components/shared/dot-grid";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { InlineNavbar } from "@/components/landing/inline-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { DeadTimeSection } from "@/components/landing/dead-time-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { SurfacesSection } from "@/components/landing/surfaces-section";
import { YourRulesSection } from "@/components/landing/your-rules-section";
import { PaymentRailSection } from "@/components/landing/payment-rail-section";
import { WaitlistSection } from "@/components/landing/waitlist-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <main className="relative min-h-screen">
        <DotGrid opacity={0.3} variant="heartbeat" />

        <div className="relative">
          <InlineNavbar />

          <FloatingNav
            navItems={[
              { name: "How It Works", link: "#how-it-works" },
              { name: "Surfaces", link: "#surfaces" },
              { name: "The Math", link: "#the-math" },
              { name: "FAQ", link: "#faq" },
            ]}
            ctaLabel="Join Waitlist"
            ctaHref="#waitlist"
          />

          <HeroSection />

          <DeadTimeSection />

          <HowItWorksSection />

          <SurfacesSection />

          <YourRulesSection />

          {/* P0-008 The Math — not yet built */}
          <PaymentRailSection />

          {/* P0-010 Open Source Fund, P0-011 Worldwide, P0-012 FAQ — not yet built */}
          <WaitlistSection />
        </div>
      </main>

      <Footer />
    </>
  );
}
