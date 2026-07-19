"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/overview", label: "Visão geral" },
  { href: "/renewals", label: "Renovações" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/clients", label: "Clientes" },
];

export function TopTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1" aria-label="Seções do dashboard">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
