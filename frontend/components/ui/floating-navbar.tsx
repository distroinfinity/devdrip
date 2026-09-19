"use client"
import React, { useState } from "react"
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react"
import { cn } from "@/lib/utils"

export const FloatingNav = ({
  navItems,
  className,
  ctaLabel = "Join Waitlist",
  ctaHref,
  onCtaClick,
}: {
  navItems: {
    name: string
    link: string
    icon?: React.ReactNode
  }[]
  className?: string
  ctaLabel?: string
  ctaHref?: string
  onCtaClick?: () => void
}) => {
  const { scrollYProgress } = useScroll()
  const [visible, setVisible] = useState(false)

  useMotionValueEvent(scrollYProgress, "change", (current) => {
    if (typeof current === "number") {
      const direction = current - scrollYProgress.getPrevious()!

      if (scrollYProgress.get() < 0.05) {
        setVisible(false)
      } else {
        if (direction < 0) {
          setVisible(true)
        } else {
          setVisible(false)
        }
      }
    }
  })

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{
          opacity: 1,
          y: -100,
        }}
        animate={{
          y: visible ? 0 : -100,
          opacity: visible ? 1 : 0,
        }}
        transition={{
          duration: 0.2,
        }}
        className={cn(
          "flex max-w-fit fixed top-10 inset-x-0 mx-auto z-[var(--z-sticky)]",
          className
        )}
      >
        <div
          className="flex items-center justify-center gap-2 rounded-full border border-[var(--rule-default)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-md backdrop-blur-md"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 90%, transparent)" }}
        >
          <div className="hidden sm:flex items-center gap-1">
            {navItems.map((navItem, idx: number) => (
              <a
                key={`link-${idx}`}
                href={navItem.link}
                className="relative flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]"
              >
                <span className="font-body">{navItem.name}</span>
              </a>
            ))}
          </div>

          <div className="hidden sm:block h-5 w-px bg-[var(--rule-default)]" />

          {ctaHref ? (
            <a
              href={ctaHref}
              className="relative rounded-full bg-[var(--ink-primary)] px-4 py-2 text-sm font-medium text-[var(--ink-inverse)] transition-all hover:bg-[var(--em-hover)] hover:shadow-md font-body"
            >
              {ctaLabel}
            </a>
          ) : (
            <button
              onClick={onCtaClick}
              className="relative rounded-full bg-[var(--ink-primary)] px-4 py-2 text-sm font-medium text-[var(--ink-inverse)] transition-all hover:bg-[var(--em-hover)] hover:shadow-md font-body"
            >
              <span>{ctaLabel}</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
