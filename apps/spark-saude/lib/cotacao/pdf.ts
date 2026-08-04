import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { LEAO_BRAND } from "./brand";
import { metalStyle } from "./metal";
import type { PlanOptionDraft, QuoteProfile } from "./types";

/**
 * The proposal as a PDF — what the client actually receives on WhatsApp.
 *
 * Design follows the Leão mark: navy as the structural color, gold reserved for
 * what the broker wants read first (the recommendation, the option numbers, the
 * rule under every header). The document is deliberately two-layered:
 *
 *   page 1  — the comparison: every option side by side, priced and ranked
 *   page 2+ — one detail sheet per option, in the same order
 *
 * The two layers are tied together by a numbering system: option ❶ in the
 * comparison is "Opção 1" on its detail sheet, and each sheet points back to
 * the comparison page. So the client can scan once, then read deeply.
 *
 * Built with pdf-lib on purpose — pure JavaScript, no headless browser and no
 * native binaries, so it runs inside a serverless function without surprises.
 */

const NAVY = rgb(0.106, 0.165, 0.29); // #1B2A4A — marca
const NAVY_SOFT = rgb(0.24, 0.31, 0.44);
const GOLD = rgb(0.788, 0.588, 0.18); // #C9962E — marca
const GOLD_WASH = rgb(0.988, 0.961, 0.898);
const INK = rgb(0.13, 0.15, 0.19);
const MUTED = rgb(0.45, 0.48, 0.53);
const HAIRLINE = rgb(0.886, 0.898, 0.918);
const WASH = rgb(0.969, 0.973, 0.98);
const GREEN = rgb(0.055, 0.42, 0.267);
const WHITE = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const CONTENT = A4[0] - M * 2;
const FOOT = 74; // piso: rodapé + respiro

const money = (n?: number | null) =>
  n == null ? "—" : `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n?: number | null) =>
  n == null ? "—" : `US$ ${Math.round(n).toLocaleString("pt-BR")}`;

/** pdf-lib desenha WinAnsi — normaliza o que a fonte não conhece. */
const safe = (s: string) =>
  (s || "")
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ]/g, "");

function hexRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return NAVY;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Quebra por caractere — para URLs assinadas, que não têm espaço nenhum. */
function wrapChars(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  const chars = safe(text).split("");
  const lines: string[] = [];
  let line = "";
  for (const c of chars) {
    if (font.widthOfTextAtSize(line + c, size) > maxWidth) {
      lines.push(line);
      line = c;
      if (lines.length === maxLines) break;
    } else line += c;
  }
  if (lines.length < maxLines && line) lines.push(line);
  // Estourou o espaço? Sinaliza que continua, em vez de cortar no escuro.
  if (lines.length === maxLines) {
    const used = lines.join("").length;
    if (used < chars.length) lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
  }
  return lines;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  logoWide: PDFImage | null;
  logoStacked: PDFImage | null;
  pages: PDFPage[];
  /** Rótulo da seção corrente, repetido no topo das páginas internas. */
  section: string;
}

async function loadLogo(doc: PDFDocument, file: string): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", file)));
  } catch {
    return null; // um logo ausente nunca impede a proposta de sair
  }
}

/** Cabeçalho das páginas internas: marca discreta + seção + fio dourado. */
function header(ctx: Ctx) {
  const { page, logoWide, regular } = ctx;
  if (logoWide) {
    const h = 24;
    page.drawImage(logoWide, {
      x: M, y: A4[1] - M - h, width: (logoWide.width / logoWide.height) * h, height: h,
    });
  }
  if (ctx.section) {
    const label = safe(ctx.section.toUpperCase());
    page.drawText(label, {
      x: A4[0] - M - regular.widthOfTextAtSize(label, 8),
      y: A4[1] - M - 15, size: 8, font: regular, color: MUTED,
    });
  }
  page.drawRectangle({ x: M, y: A4[1] - M - 34, width: CONTENT, height: 1.6, color: GOLD });
  ctx.y = A4[1] - M - 58;
}

function footer(page: PDFPage, font: PDFFont, bold: PDFFont, index: number, total: number) {
  page.drawRectangle({ x: M, y: 56, width: CONTENT, height: 0.8, color: HAIRLINE });
  page.drawText(safe(LEAO_BRAND.name), { x: M, y: 42, size: 8, font: bold, color: NAVY });
  page.drawText(safe(LEAO_BRAND.tagline), {
    x: M + bold.widthOfTextAtSize(safe(LEAO_BRAND.name), 8) + 6, y: 42, size: 8, font, color: MUTED,
  });
  const label = safe(`${index} / ${total}`);
  page.drawText(label, { x: A4[0] - M - font.widthOfTextAtSize(label, 8), y: 42, size: 8, font, color: MUTED });
}

function newPage(ctx: Ctx, section?: string) {
  if (section !== undefined) ctx.section = section;
  ctx.page = ctx.doc.addPage(A4);
  ctx.pages.push(ctx.page);
  header(ctx);
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed <= FOOT) newPage(ctx);
}

/** Selo numerado — o elo entre o comparativo e a folha de detalhe. */
function numberBadge(page: PDFPage, bold: PDFFont, x: number, y: number, n: number, highlight: boolean) {
  const r = 9;
  page.drawCircle({ x: x + r, y: y + r, size: r, color: highlight ? GOLD : NAVY });
  const label = String(n);
  page.drawText(label, {
    x: x + r - bold.widthOfTextAtSize(label, 9.5) / 2,
    y: y + r - 3.4, size: 9.5, font: bold, color: WHITE,
  });
}

/** Chip do nível metálico, na cor real do tier. */
function metalChip(page: PDFPage, bold: PDFFont, x: number, y: number, metalLevel: string) {
  const metal = metalStyle(metalLevel);
  const color = hexRgb(metal.ink);
  const label = safe(metal.label.toUpperCase());
  const w = bold.widthOfTextAtSize(label, 7) + 12;
  page.drawRectangle({ x, y: y - 2, width: w, height: 13, color, opacity: 0.12 });
  page.drawText(label, { x: x + 6, y: y + 2, size: 7, font: bold, color });
  return w;
}

// ---------------------------------------------------------------- Comparativo

/**
 * The comparison table — the page the client actually decides on.
 *
 * One row per option, priced left to right, with a bar that makes the monthly
 * premium comparable at a glance instead of forcing a number-by-number read.
 */
function drawComparison(
  ctx: Ctx,
  options: PlanOptionDraft[],
  recommendedPlanId: string | null | undefined,
  /** Página real da folha de detalhe de cada plano — o elo entre as seções. */
  detailPageOf: (planId: string) => number,
) {
  const { regular, bold } = ctx;
  const maxPremium = Math.max(...options.map((o) => o.premioMensal), 1);

  // Cabeçalho da tabela
  ensure(ctx, 30);
  const headY = ctx.y;
  ctx.page.drawRectangle({ x: M, y: headY - 18, width: CONTENT, height: 18, color: NAVY });
  const cols: Array<[string, number]> = [
    ["OPÇÃO", M + 10],
    ["MENSALIDADE", M + 232],
    ["DEDUTÍVEL", M + 350],
    ["MÁX. DO BOLSO", M + 430],
  ];
  cols.forEach(([label, x]) => {
    ctx.page.drawText(safe(label), { x, y: headY - 12.5, size: 7, font: bold, color: WHITE });
  });
  ctx.y = headY - 18;

  options.forEach((plan, i) => {
    const isRec = plan.planId === recommendedPlanId;
    const rowH = 52;
    ensure(ctx, rowH);
    const top = ctx.y;
    const page = ctx.page;

    page.drawRectangle({
      x: M, y: top - rowH, width: CONTENT, height: rowH,
      color: isRec ? GOLD_WASH : i % 2 ? WASH : WHITE,
    });
    if (isRec) page.drawRectangle({ x: M, y: top - rowH, width: 3, height: rowH, color: GOLD });
    page.drawRectangle({ x: M, y: top - rowH, width: CONTENT, height: 0.6, color: HAIRLINE });

    // Nº + nome + seguradora + tier
    numberBadge(page, bold, M + 10, top - 30, i + 1, isRec);
    const nameX = M + 36;
    const nameLines = wrap(plan.nomePlano, bold, 10, 172).slice(0, 2);
    nameLines.forEach((line, li) => {
      page.drawText(line, { x: nameX, y: top - 17 - li * 11, size: 10, font: bold, color: NAVY });
    });
    const belowName = top - 17 - nameLines.length * 11 - 1;
    page.drawText(safe(plan.seguradora).slice(0, 34), {
      x: nameX, y: belowName, size: 7.5, font: regular, color: MUTED,
    });
    metalChip(page, bold, nameX, belowName - 15, plan.metalLevel);
    if (isRec) {
      page.drawText(safe("RECOMENDADA"), { x: nameX + 52, y: belowName - 11, size: 6.5, font: bold, color: GOLD });
    }

    // Mensalidade + barra comparativa
    const price = safe(money(plan.premioMensal));
    page.drawText(price, { x: M + 232, y: top - 22, size: 13, font: bold, color: isRec ? hexRgb("#8A6410") : NAVY });
    const barW = 96;
    page.drawRectangle({ x: M + 232, y: top - 34, width: barW, height: 4, color: HAIRLINE });
    page.drawRectangle({
      x: M + 232, y: top - 34,
      width: Math.max(3, (plan.premioMensal / maxPremium) * barW), height: 4,
      color: isRec ? GOLD : NAVY_SOFT,
    });
    if (plan.creditoFiscal > 0) {
      page.drawText(safe(`crédito de ${moneyShort(plan.creditoFiscal)}/mês já aplicado`), {
        x: M + 232, y: top - 45, size: 6.5, font: regular, color: GREEN,
      });
    }

    // Dedutível / máximo do bolso
    page.drawText(safe(moneyShort(plan.dedutivel)), { x: M + 350, y: top - 22, size: 10, font: bold, color: INK });
    page.drawText(safe(moneyShort(plan.maxBolso)), { x: M + 430, y: top - 22, size: 10, font: bold, color: INK });
    page.drawText(safe(`detalhe na pág. ${detailPageOf(plan.planId)}`), {
      x: M + 350, y: top - 40, size: 6.5, font: regular, color: MUTED,
    });

    ctx.y = top - rowH;
  });

  // Legenda que ensina a ler a tabela
  ctx.y -= 12;
  ensure(ctx, 24);
  const legend =
    "A mensalidade já considera o crédito fiscal estimado. O dedutível é o valor que você paga antes de o plano começar a dividir os custos; o máximo do bolso é o teto que você gasta no ano.";
  wrap(legend, ctx.regular, 7.5, CONTENT).forEach((line, i) => {
    ctx.page.drawText(line, { x: M, y: ctx.y - i * 9.5, size: 7.5, font: ctx.regular, color: MUTED });
  });
  ctx.y -= wrap(legend, ctx.regular, 7.5, CONTENT).length * 9.5 + 8;
}

// ------------------------------------------------------------ Folha de detalhe

function drawDetail(ctx: Ctx, plan: PlanOptionDraft, index: number, isRec: boolean, comparisonPage: number) {
  const { regular, bold } = ctx;
  const rows: Array<[string, string | null | undefined]> = [
    ["Atenção primária", plan.atencaoPrimaria],
    ["Atenção de especialista", plan.atencaoEspecialista],
    ["Atenção de urgência", plan.atencaoUrgencia],
    ["Sala de emergência", plan.emergencia],
    ["Saúde mental", plan.saudeMental],
    ["Medicamento genérico", plan.medicamentoGenerico],
  ];
  const rowLines = rows.map(([, v]) => wrap(v || "—", regular, 8.5, 250));
  const rowsH = rowLines.reduce((a, l) => a + Math.max(15, l.length * 11), 0);
  const cardH = 148 + rowsH;

  ensure(ctx, cardH + 14);
  const top = ctx.y;
  const page = ctx.page;

  page.drawRectangle({
    x: M, y: top - cardH, width: CONTENT, height: cardH,
    color: WHITE, borderColor: isRec ? GOLD : HAIRLINE, borderWidth: isRec ? 1.4 : 0.8,
  });
  // Faixa superior: dourada na recomendada, navy nas demais
  page.drawRectangle({ x: M, y: top - 3, width: CONTENT, height: 3, color: isRec ? GOLD : NAVY });

  // Identidade
  numberBadge(page, bold, M + 16, top - 36, index, isRec);
  let y = top - 24;
  const titleX = M + 42;
  page.drawText(safe(`OPÇÃO ${index}`), { x: titleX, y, size: 7.5, font: bold, color: isRec ? GOLD : MUTED });
  if (isRec) page.drawText(safe("· RECOMENDADA PELA CORRETORA"), { x: titleX + 42, y, size: 7.5, font: bold, color: GOLD });
  y -= 15;
  wrap(plan.nomePlano, bold, 14, CONTENT - 220).slice(0, 2).forEach((line) => {
    page.drawText(line, { x: titleX, y, size: 14, font: bold, color: NAVY });
    y -= 16;
  });
  page.drawText(safe(plan.seguradora), { x: titleX, y, size: 9, font: regular, color: MUTED });
  y -= 6;
  metalChip(page, bold, titleX, y - 12, plan.metalLevel);
  if (plan.tipoPlano) {
    page.drawText(safe(plan.tipoPlano), { x: titleX + 62, y: y - 8, size: 7.5, font: regular, color: MUTED });
  }

  // Bloco de preço, alinhado à direita
  const priceStr = safe(money(plan.premioMensal));
  const per = safe(" /mês");
  const priceW = bold.widthOfTextAtSize(priceStr, 24);
  const perW = regular.widthOfTextAtSize(per, 9);
  const right = A4[0] - M - 16;
  page.drawText(priceStr, { x: right - perW - priceW, y: top - 44, size: 24, font: bold, color: NAVY });
  page.drawText(per, { x: right - perW, y: top - 44, size: 9, font: regular, color: MUTED });
  if (plan.creditoFiscal > 0) {
    const l1 = safe(`Sem o crédito: ${money(plan.premioSemCredito)}`);
    const l2 = safe(`Crédito fiscal estimado: −${money(plan.creditoFiscal)}/mês`);
    page.drawText(l1, { x: A4[0] - M - 16 - regular.widthOfTextAtSize(l1, 8), y: top - 58, size: 8, font: regular, color: MUTED });
    page.drawText(l2, { x: A4[0] - M - 16 - bold.widthOfTextAtSize(l2, 8), y: top - 69, size: 8, font: bold, color: GREEN });
  }

  // Números que decidem
  y = top - 92;
  const boxW = (CONTENT - 32 - 12) / 2;
  ([["Dedutível", money(plan.dedutivel)], ["Máximo do bolso", money(plan.maxBolso)]] as Array<[string, string]>).forEach(
    ([label, value], i) => {
      const x = M + 16 + i * (boxW + 12);
      page.drawRectangle({ x, y: y - 34, width: boxW, height: 34, color: WASH });
      page.drawRectangle({ x, y: y - 34, width: 2, height: 34, color: isRec ? GOLD : NAVY_SOFT });
      page.drawText(safe(label), { x: x + 10, y: y - 13, size: 7.5, font: regular, color: MUTED });
      page.drawText(safe(value), { x: x + 10, y: y - 27, size: 12, font: bold, color: INK });
    },
  );
  y -= 48;

  // Tabela "Você paga"
  page.drawText(safe("O QUE VOCÊ PAGA EM CADA ATENDIMENTO"), { x: M + 16, y, size: 7.5, font: bold, color: NAVY });
  y -= 6;
  page.drawRectangle({ x: M + 16, y: y - 2, width: CONTENT - 32, height: 0.6, color: HAIRLINE });
  y -= 14;
  rows.forEach(([label], i) => {
    const lines = rowLines[i];
    page.drawText(safe(label), { x: M + 16, y, size: 8.5, font: regular, color: MUTED });
    lines.forEach((line, li) => {
      page.drawText(line, {
        x: A4[0] - M - 16 - regular.widthOfTextAtSize(line, 8.5),
        y: y - li * 11, size: 8.5, font: li === 0 ? bold : regular, color: INK,
      });
    });
    const h = Math.max(15, lines.length * 11);
    y -= h;
    if (i < rows.length - 1) page.drawRectangle({ x: M + 16, y: y + 4, width: CONTENT - 32, height: 0.4, color: HAIRLINE });
  });

  // Elo de volta ao comparativo
  page.drawText(safe(`Compare com as outras opções na pág. ${comparisonPage}`), {
    x: M + 16, y: top - cardH + 10, size: 7, font: regular, color: MUTED,
  });

  ctx.y = top - cardH - 14;
}

export interface ProposalPdfInput {
  profile: QuoteProfile;
  options: PlanOptionDraft[];
  recommendedPlanId?: string | null;
  url?: string;
  expiresAt?: string;
}

export async function buildProposalPdf(input: ProposalPdfInput): Promise<{ bytes: Uint8Array; filename: string }> {
  const { profile, options, recommendedPlanId, url, expiresAt } = input;

  const doc = await PDFDocument.create();
  doc.setTitle(`Proposta de seguro saúde ${profile.year}`);
  doc.setAuthor(LEAO_BRAND.name);
  doc.setCreator(LEAO_BRAND.name);
  doc.setSubject("Cotação de seguro saúde — Marketplace / Obamacare");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoWide = await loadLogo(doc, "logo-a.png");
  const logoStacked = await loadLogo(doc, "logo-b.png");

  const first = doc.addPage(A4);
  const ctx: Ctx = {
    doc, page: first, y: 0, regular, bold, logoWide, logoStacked,
    pages: [first], section: "Comparativo das opções",
  };

  // ------------------------------------------------------------------ Capa
  // A marca abre o documento centralizada: é o primeiro contato do cliente.
  let y = A4[1] - M;
  if (logoStacked) {
    const h = 82;
    const w = (logoStacked.width / logoStacked.height) * h;
    first.drawImage(logoStacked, { x: (A4[0] - w) / 2, y: y - h, width: w, height: h });
    y -= h + 22;
  } else {
    y -= 30;
  }
  first.drawRectangle({ x: (A4[0] - 56) / 2, y, width: 56, height: 1.6, color: GOLD });
  y -= 26;

  const title = safe("Proposta de seguro saúde");
  first.drawText(title, { x: (A4[0] - bold.widthOfTextAtSize(title, 22)) / 2, y, size: 22, font: bold, color: NAVY });
  y -= 16;
  const sub = safe(`Marketplace / Obamacare · cobertura ${profile.year}`);
  first.drawText(sub, { x: (A4[0] - regular.widthOfTextAtSize(sub, 10)) / 2, y, size: 10, font: regular, color: MUTED });
  y -= 26;

  if (profile.contactName) {
    const who = safe(`Preparada para ${profile.contactName}`);
    first.drawText(who, { x: (A4[0] - bold.widthOfTextAtSize(who, 12)) / 2, y, size: 12, font: bold, color: INK });
    y -= 24;
  }

  // Faixa do perfil considerado — o que a cotação assumiu, explícito
  const ages = profile.people.map((p) => `${p.age}`).join(", ");
  const facts: Array<[string, string]> = [
    ["Pessoas no plano", `${profile.people.length}${ages ? ` (${ages} anos)` : ""}`],
    ["Zipcode", `${profile.zipcode} / ${profile.state}`],
    ["Renda anual declarada", money(profile.income)],
  ];
  const factH = 46;
  first.drawRectangle({ x: M, y: y - factH, width: CONTENT, height: factH, color: NAVY });
  const colW = CONTENT / facts.length;
  facts.forEach(([label, value], i) => {
    const cx = M + 14 + i * colW;
    first.drawText(safe(label.toUpperCase()), { x: cx, y: y - 18, size: 6.5, font: regular, color: rgb(0.65, 0.7, 0.8) });
    first.drawText(safe(value), { x: cx, y: y - 33, size: 11, font: bold, color: WHITE });
    if (i > 0) first.drawRectangle({ x: M + i * colW, y: y - factH + 10, width: 0.6, height: factH - 20, color: NAVY_SOFT });
  });
  y -= factH + 30;

  // Título do comparativo (a tabela em si é desenhada depois — ver abaixo).
  ctx.y = y;
  const heading = safe(`Suas ${options.length} opções, lado a lado`);
  ctx.page.drawText(heading, { x: M, y: ctx.y, size: 13, font: bold, color: NAVY });
  ctx.y -= 8;
  ctx.page.drawRectangle({ x: M, y: ctx.y, width: 34, height: 1.6, color: GOLD });
  ctx.y -= 18;
  const comparisonY = ctx.y;
  const comparisonPage = 1;

  // A recomendada primeiro — e essa ordem vale para o documento inteiro.
  const sorted = [...options].sort((a, b) => {
    if (a.planId === recommendedPlanId) return -1;
    if (b.planId === recommendedPlanId) return 1;
    return 0;
  });

  // ------------------------------------------------------- Detalhes (p.2+)
  // Desenhamos os detalhes ANTES do comparativo para saber em que página cada
  // opção caiu — é esse número que a tabela cita ("detalhe na pág. N").
  newPage(ctx, "Detalhe de cada opção");
  ctx.page.drawText(safe("Detalhe de cada opção"), { x: M, y: ctx.y, size: 13, font: bold, color: NAVY });
  ctx.y -= 8;
  ctx.page.drawRectangle({ x: M, y: ctx.y, width: 34, height: 1.6, color: GOLD });
  ctx.y -= 20;

  const pageOf = new Map<string, number>();
  sorted.forEach((plan, i) => {
    drawDetail(ctx, plan, i + 1, plan.planId === recommendedPlanId, comparisonPage);
    // a folha começa na página corrente no momento em que o card foi desenhado
    pageOf.set(plan.planId, ctx.pages.indexOf(ctx.page) + 1);
  });

  // ------------------------------------------------ Comparativo, agora na p.1
  // Mesmo contexto, mas apontando para a primeira página e a altura reservada.
  const compCtx: Ctx = { ...ctx, page: first, y: comparisonY };
  drawComparison(compCtx, sorted, recommendedPlanId, (id) => pageOf.get(id) ?? 2);

  // Fecho da página 1: o que fazer agora + link — costura com as páginas de detalhe.
  compCtx.y -= 6;
  const urlLines = url ? wrapChars(url, regular, 7.5, CONTENT - 28, 2) : [];
  const stepsH = url ? 62 + urlLines.length * 10 : 56;
  if (compCtx.y - stepsH > FOOT) {
    const top = compCtx.y;
    first.drawRectangle({ x: M, y: top - stepsH, width: CONTENT, height: stepsH, color: WASH });
    first.drawRectangle({ x: M, y: top - stepsH, width: 2.5, height: stepsH, color: GOLD });
    first.drawText(safe("Como seguir a partir daqui"), { x: M + 14, y: top - 18, size: 9.5, font: bold, color: NAVY });
    const steps = [
      `Nas próximas páginas, cada opção aparece detalhada com o que você paga em cada atendimento.`,
      `Escolheu uma? É só responder esta mensagem — eu cuido da inscrição com você.`,
    ];
    steps.forEach((step, i) => {
      first.drawText(safe(`${i + 1}.`), { x: M + 14, y: top - 34 - i * 12, size: 8, font: bold, color: GOLD });
      first.drawText(safe(step), { x: M + 26, y: top - 34 - i * 12, size: 8, font: regular, color: INK });
    });
    if (url) {
      first.drawText(safe("Ver online e responder:"), { x: M + 14, y: top - 62, size: 8, font: bold, color: NAVY });
      urlLines.forEach((line, i) => {
        first.drawText(line, { x: M + 14, y: top - 73 - i * 10, size: 7.5, font: regular, color: hexRgb("#8A6410") });
      });
    }
  }

  // ------------------------------------------------------------- Fecho: aviso
  if (url && expiresAt) {
    ensure(ctx, 20);
    ctx.page.drawText(safe(`Proposta válida até ${new Date(expiresAt).toLocaleDateString("pt-BR")} · ${url}`), {
      x: M, y: ctx.y, size: 7.5, font: regular, color: MUTED,
    });
    ctx.y -= 18;
  }

  const disclaimer = wrap(LEAO_BRAND.disclaimer, regular, 8, CONTENT - 26);
  const noteH = disclaimer.length * 10.5 + 22;
  ensure(ctx, noteH);
  ctx.page.drawRectangle({
    x: M, y: ctx.y - noteH, width: CONTENT, height: noteH,
    color: GOLD_WASH, borderColor: rgb(0.91, 0.8, 0.58), borderWidth: 0.8,
  });
  disclaimer.forEach((line, i) => {
    ctx.page.drawText(line, {
      x: M + 13, y: ctx.y - 16 - i * 10.5, size: 8, font: regular, color: hexRgb("#6B4E12"),
    });
  });

  ctx.pages.forEach((p, i) => footer(p, regular, bold, i + 1, ctx.pages.length));

  const bytes = await doc.save();
  const who = (profile.contactName || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return { bytes, filename: `proposta-${who}-${profile.year}.pdf` };
}
