"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type MobileCollapsingHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileCollapsingHeader({
  children,
  className,
}: MobileCollapsingHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (currentY < 24) {
        setIsCollapsed(false);
      } else if (delta > 8) {
        setIsCollapsed(true);
      } else if (delta < -8) {
        setIsCollapsed(false);
      }

      lastY = currentY;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        className,
        "transition-transform duration-200 ease-out lg:translate-y-0",
        isCollapsed ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
