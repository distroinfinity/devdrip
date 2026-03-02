import dynamic from "next/dynamic";
import { FloatingNav } from "@/components/ui/floating-navbar";

import { InlineNavbar } from "@/components/landing/inline-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { DeadTimeSection } from "@/components/landing/dead-time-section";
import { Footer } from "@/components/landing/footer";

// below-fold sections — code-split JS, still SSR for SEO
const HowItWorksSection = dynamic(
  () => import("@/components/landing/how-it-works-section").then((m) => ({ default: m.HowItWorksSection })),
  { ssr: true },
);
const SurfacesSection = dynamic(
  () => import("@/components/landing/surfaces-section").then((m) => ({ default: m.SurfacesSection })),
  { ssr: true },
);
const YourRulesSection = dynamic(
  () => import("@/components/landing/your-rules-section").then((m) => ({ default: m.YourRulesSection })),
  { ssr: true },
);
const PaymentRailSection = dynamic(
  () => import("@/components/landing/payment-rail-section").then((m) => ({ default: m.PaymentRailSection })),
  { ssr: true },
);
const WorldwideSection = dynamic(
  () => import("@/components/landing/worldwide-section").then((m) => ({ default: m.WorldwideSection })),
  { ssr: true },
);
const WaitlistSection = dynamic(
  () => import("@/components/landing/waitlist-section").then((m) => ({ default: m.WaitlistSection })),
  { ssr: true },
);

export default function Home() {
  return (
    <>
      <main className="relative min-h-screen">
        <InlineNavbar />

        <FloatingNav
          navItems={[
            { name: "How It Works", link: "#how-it-works" },
            { name: "Surfaces", link: "#surfaces" },
            { name: "Your Rules", link: "#your-rules" },
            { name: "Payment Rail", link: "#payment-rail" },
          ]}
          ctaLabel="Request Access"
          ctaHref="#waitlist"
        />

        <HeroSection />

        <DeadTimeSection />

        <HowItWorksSection />

        <SurfacesSection />

        <YourRulesSection />

        {/* P0-008 The Math — not yet built */}
        <PaymentRailSection />

        <WorldwideSection />

        {/* P0-010 Open Source Fund, P0-012 FAQ — not yet built */}
        <WaitlistSection />
      </main>

      <Footer />
    </>
  );
}
