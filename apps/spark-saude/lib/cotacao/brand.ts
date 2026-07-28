import type { BrandConfig } from "./types";

/**
 * Leão Insurances brand (CLAUDE.md §8) — the DEFAULT for the pilot. Everything
 * here is parametrizable per broker for resale: in production the brand is read
 * from the tenant config, and this is only the fallback.
 */
export const LEAO_BRAND: BrandConfig = {
  name: "Leao Insurances",
  tagline: "Your future. Our protection.",
  primary: "#1B2A4A", // navy
  primaryDeep: "#14203A",
  secondary: "#8A8D91", // steel
  disclaimer:
    "Valores estimados com base nas informações informadas. O crédito fiscal (APTC) é uma estimativa " +
    "calculada sobre a renda e o núcleo familiar declarados e reconciliado na declaração de imposto. " +
    "O valor final é confirmado na aplicação oficial e pode ser menor.",
};

/** Resolve the active brand for a tenant. V1 returns the Leão default. */
export function getBrand(_corretoraId?: string): BrandConfig {
  return LEAO_BRAND;
}
