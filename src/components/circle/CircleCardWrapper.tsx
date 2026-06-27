"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

interface CircleCardWrapperProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a circle card article so the entire card is activatable
 * via Enter or Space key for keyboard users.
 */
export function CircleCardWrapper({ href, children, className }: CircleCardWrapperProps) {
  const router = useRouter();

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(href);
    }
  }

  return (
    <div
      role="group"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={className}
      aria-label="Circle card — press Enter to view details"
    >
      {children}
    </div>
  );
}
