import { DotGrid } from "@/components/shared/dot-grid";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { InlineNavbar } from "@/components/landing/inline-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { YourRulesSection } from "@/components/landing/your-rules-section";

export default function Home() {
  return (
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
        />

        <HeroSection />

        <HowItWorksSection />

        <YourRulesSection />

        {/* future sections: P0-004, P0-006, P0-008 through P0-013 */}
      </div>
    </main>
  );
}
