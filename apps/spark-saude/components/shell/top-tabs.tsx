"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Cotação is a separate product with its own shell and its own GHL menu link
// (see app/cotacao/layout.tsx) — it is deliberately NOT a tab here.
const TABS = [
  { href: "/overview", label: "Visão geral" },
  { href: "/renewals", label: "Renovações" },
  { href: "/clients", label: "Clientes" },
];

/**
 * GoHighLevel-style top tabs: a horizontal bar with an underline indicator on
 * the active tab. Each tab is a route — clicking switches the screen (soft
 * navigation; the header/shell persists). Height matches the header so the
 * underline lands on the header's bottom border.
 */
export function TopTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className={cn("flex items-center gap-6", className)} aria-label="Seções do dashboard">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            onMouseEnter={() => router.prefetch(tab.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-12 shrink-0 items-center border-b-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
