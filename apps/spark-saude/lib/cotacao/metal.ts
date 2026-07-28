/**
 * Metal-level visual identity.
 *
 * The tier is the first thing a client reads on a plan, so it should be visible
 * before any text is: each card carries its own accent rail, chip and price
 * color. Kept in one place because the broker's builder and the client's
 * proposal must show the same plan the same way.
 *
 * Hues stay close to the real metals (and to the HealthCare.gov tiers), muted
 * enough to sit next to the Leão navy without competing with it.
 */
export interface MetalStyle {
  /** Display label — the API returns English tiers; the client reads Portuguese. */
  label: string;
  /** Gradient for the accent rail at the top of the card. */
  rail: string;
  /** Solid tone for the price and small marks. */
  ink: string;
  /** Tinted chip background + foreground. */
  chip: string;
  /** Soft wash behind the price block. */
  wash: string;
}

const METALS: Record<string, MetalStyle> = {
  Bronze: {
    label: "Bronze",
    rail: "linear-gradient(90deg, #C2703B 0%, #92400E 100%)",
    ink: "#9A4C12",
    chip: "bg-[#FBEDE2] text-[#8A4310]",
    wash: "linear-gradient(180deg, rgba(194,112,59,0.07) 0%, rgba(194,112,59,0) 100%)",
  },
  "Expanded Bronze": {
    label: "Bronze+",
    rail: "linear-gradient(90deg, #C2703B 0%, #92400E 100%)",
    ink: "#9A4C12",
    chip: "bg-[#FBEDE2] text-[#8A4310]",
    wash: "linear-gradient(180deg, rgba(194,112,59,0.07) 0%, rgba(194,112,59,0) 100%)",
  },
  Silver: {
    label: "Prata",
    rail: "linear-gradient(90deg, #94A3B8 0%, #64748B 100%)",
    ink: "#475569",
    chip: "bg-[#EEF2F6] text-[#41506A]",
    wash: "linear-gradient(180deg, rgba(100,116,139,0.08) 0%, rgba(100,116,139,0) 100%)",
  },
  Gold: {
    label: "Ouro",
    rail: "linear-gradient(90deg, #E0B44A 0%, #A16207 100%)",
    ink: "#8A6410",
    chip: "bg-[#FBF1DC] text-[#7A570D]",
    wash: "linear-gradient(180deg, rgba(224,180,74,0.12) 0%, rgba(224,180,74,0) 100%)",
  },
  Platinum: {
    label: "Platina",
    rail: "linear-gradient(90deg, #7C8BF0 0%, #4338CA 100%)",
    ink: "#4338CA",
    chip: "bg-[#EDEDFC] text-[#3B32B4]",
    wash: "linear-gradient(180deg, rgba(124,139,240,0.10) 0%, rgba(124,139,240,0) 100%)",
  },
  Catastrophic: {
    label: "Catastrófico",
    rail: "linear-gradient(90deg, #A3ADBB 0%, #6B7684 100%)",
    ink: "#5A6472",
    chip: "bg-muted text-muted-foreground",
    wash: "linear-gradient(180deg, rgba(107,118,132,0.07) 0%, rgba(107,118,132,0) 100%)",
  },
};

const FALLBACK: MetalStyle = {
  label: "—",
  rail: "linear-gradient(90deg, #A3ADBB 0%, #6B7684 100%)",
  ink: "#5A6472",
  chip: "bg-muted text-muted-foreground",
  wash: "linear-gradient(180deg, rgba(107,118,132,0.06) 0%, rgba(107,118,132,0) 100%)",
};

export function metalStyle(metalLevel: string): MetalStyle {
  return METALS[metalLevel] ?? { ...FALLBACK, label: metalLevel || "—" };
}
