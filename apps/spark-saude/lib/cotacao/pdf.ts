import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { LEAO_BRAND } from "./brand";
import { dict, type Dict } from "./i18n";
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

const money = (n: number | null | undefined, loc = "pt-BR") =>
  n == null ? "—" : `US$ ${n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number | null | undefined, loc = "pt-BR") =>
  n == null ? "—" : `US$ ${Math.round(n).toLocaleString(loc)}`;

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
  d: Dict;
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

/** Chip do nível metálico, na cor real do tier e na língua do cliente. */
function metalChip(page: PDFPage, bold: PDFFont, x: number, y: number, metalLevel: string, d: Dict) {
  const metal = metalStyle(metalLevel);
  const color = hexRgb(metal.ink);
  // O CMS devolve o tier em inglês; o rótulo PT vem do metal.ts (mesma peça que
  // a UI da corretora usa) e os outros idiomas, do dicionário.
  const label = safe((d.pdf.metals[metalLevel] ?? metal.label).toUpperCase());
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
  const { regular, bold, d } = ctx;
  const L = d.locale;
  const maxPremium = Math.max(...options.map((o) => o.premioMensal), 1);

  // Colunas: o nome fica com o espaço largo; os três números têm largura fixa.
  const COL_PRICE = M + 222;
  const COL_DED = M + 340;
  const COL_OOP = M + 424;
  const NAME_W = COL_PRICE - (M + 40) - 12;

  // Cabeçalho da tabela
  ensure(ctx, 34);
  const headY = ctx.y;
  ctx.page.drawRectangle({ x: M, y: headY - 22, width: CONTENT, height: 22, color: NAVY });
  ([[d.pdf.colOption, M + 12], [d.pdf.colPremium, COL_PRICE], [d.pdf.colDeductible, COL_DED], [d.pdf.colOopMax, COL_OOP]] as Array<
    [string, number]
  >).forEach(([label, x]) => {
    // Rótulos mudam de tamanho com o idioma — encosta no limite da tabela em vez
    // de vazar por fora dela.
    const text = safe(label);
    const right = M + CONTENT - 10;
    const w = bold.widthOfTextAtSize(text, 8);
    ctx.page.drawText(text, { x: Math.min(x, right - w), y: headY - 15, size: 8, font: bold, color: WHITE });
  });
  ctx.y = headY - 22;

  options.forEach((plan, i) => {
    const isRec = plan.planId === recommendedPlanId;
    const nameLines = wrap(plan.nomePlano, bold, 11.5, NAME_W).slice(0, 2);
    const rowH = 46 + nameLines.length * 14;
    ensure(ctx, rowH);
    const top = ctx.y;
    const page = ctx.page;

    page.drawRectangle({
      x: M, y: top - rowH, width: CONTENT, height: rowH,
      color: isRec ? GOLD_WASH : i % 2 ? WASH : WHITE,
    });
    if (isRec) page.drawRectangle({ x: M, y: top - rowH, width: 3.5, height: rowH, color: GOLD });
    page.drawRectangle({ x: M, y: top - rowH, width: CONTENT, height: 0.6, color: HAIRLINE });

    // Nº + nome + seguradora + tier
    numberBadge(page, bold, M + 12, top - 32, i + 1, isRec);
    const nameX = M + 40;
    let ny = top - 20;
    nameLines.forEach((line) => {
      page.drawText(line, { x: nameX, y: ny, size: 11.5, font: bold, color: NAVY });
      ny -= 14;
    });
    page.drawText(safe(plan.seguradora), { x: nameX, y: ny, size: 8.5, font: regular, color: MUTED });
    ny -= 16;
    const chipW = metalChip(page, bold, nameX, ny, plan.metalLevel, d);
    if (isRec) {
      page.drawText(safe(d.pdf.recommended), { x: nameX + chipW + 8, y: ny + 3, size: 8, font: bold, color: GOLD });
    }

    // Mensalidade + barra comparativa
    const price = safe(money(plan.premioMensal, L));
    page.drawText(price, { x: COL_PRICE, y: top - 24, size: 15, font: bold, color: isRec ? hexRgb("#8A6410") : NAVY });
    const barW = 104;
    page.drawRectangle({ x: COL_PRICE, y: top - 38, width: barW, height: 5, color: HAIRLINE });
    page.drawRectangle({
      x: COL_PRICE, y: top - 38,
      width: Math.max(4, (plan.premioMensal / maxPremium) * barW), height: 5,
      color: isRec ? GOLD : NAVY_SOFT,
    });
    if (plan.creditoFiscal > 0) {
      page.drawText(safe(d.pdf.creditIncluded(moneyShort(plan.creditoFiscal, L))), {
        x: COL_PRICE, y: top - 51, size: 7.5, font: regular, color: GREEN,
      });
    }

    // Dedutível / máximo do bolso
    page.drawText(safe(moneyShort(plan.dedutivel, L)), { x: COL_DED, y: top - 24, size: 11.5, font: bold, color: INK });
    page.drawText(safe(moneyShort(plan.maxBolso, L)), { x: COL_OOP, y: top - 24, size: 11.5, font: bold, color: INK });
    page.drawText(safe(d.pdf.detailOnPage(detailPageOf(plan.planId))), {
      x: COL_DED, y: top - 44, size: 8, font: regular, color: MUTED,
    });

    ctx.y = top - rowH;
  });

  // Legenda que ensina a ler a tabela
  ctx.y -= 12;
  ensure(ctx, 24);
  const legend = d.pdf.legend;
  const legendLines = wrap(legend, ctx.regular, 8.5, CONTENT);
  legendLines.forEach((line, i) => {
    ctx.page.drawText(line, { x: M, y: ctx.y - i * 11, size: 8.5, font: ctx.regular, color: MUTED });
  });
  ctx.y -= legendLines.length * 11 + 10;
}

// ------------------------------------------------------------ Folha de detalhe

/*
 * Escala tipográfica da folha de detalhe. O cliente lê isto no celular, muitas
 * vezes com o dedo — nada abaixo de 9pt, e a linha da tabela é uma GRADE de
 * duas colunas (rótulo à esquerda, valor à direita), cada uma com a própria
 * quebra. Antes o valor era desenhado na mesma linha-base do rótulo e textos
 * longos ("25% coaseguro después del deducible") invadiam a linha de cima.
 */
const PAD = 22; // respiro interno do card
const ROW_LABEL_W = 190; // coluna do rótulo
const ROW_LEAD = 13.5; // entrelinha das células
const ROW_PAD = 9; // ar acima/abaixo de cada linha

function drawDetail(ctx: Ctx, plan: PlanOptionDraft, index: number, isRec: boolean, comparisonPage: number) {
  const { regular, bold, d } = ctx;
  const L = d.locale;
  const rows: Array<[string, string | null | undefined]> = [
    [d.pdf.rowPrimary, plan.atencaoPrimaria],
    [d.pdf.rowSpecialist, plan.atencaoEspecialista],
    [d.pdf.rowUrgent, plan.atencaoUrgencia],
    [d.pdf.rowEmergency, plan.emergencia],
    [d.pdf.rowMental, plan.saudeMental],
    [d.pdf.rowGeneric, plan.medicamentoGenerico],
  ];

  const valueW = CONTENT - PAD * 2 - ROW_LABEL_W - 18;
  const cells = rows.map(([label, value]) => ({
    label: wrap(label, regular, 10, ROW_LABEL_W),
    value: wrap(value || "—", bold, 10, valueW),
  }));
  const rowHeights = cells.map((c) => Math.max(c.label.length, c.value.length) * ROW_LEAD + ROW_PAD * 2);
  const rowsH = rowHeights.reduce((a, h) => a + h, 0);

  // Cabeçalho do card medido de verdade (o nome do plano pode ir a 2 linhas).
  const nameLines = wrap(plan.nomePlano, bold, 16, CONTENT - PAD * 2 - 210).slice(0, 2);
  const headH = 34 + nameLines.length * 19 + 34;
  const figuresH = 46;
  const cardH = headH + figuresH + 30 + rowsH + 26;

  ensure(ctx, cardH + 16);
  const top = ctx.y;
  const page = ctx.page;
  const left = M + PAD;
  const right = A4[0] - M - PAD;

  page.drawRectangle({
    x: M, y: top - cardH, width: CONTENT, height: cardH,
    color: WHITE, borderColor: isRec ? GOLD : HAIRLINE, borderWidth: isRec ? 1.4 : 0.8,
  });
  page.drawRectangle({ x: M, y: top - 4, width: CONTENT, height: 4, color: isRec ? GOLD : NAVY });

  // --- Identidade
  let y = top - 26;
  numberBadge(page, bold, left, y - 12, index, isRec);
  const titleX = left + 30;
  page.drawText(safe(d.pdf.option(index)), { x: titleX, y, size: 9, font: bold, color: isRec ? GOLD : MUTED });
  if (isRec) {
    page.drawText(safe(d.pdf.recommendedByBroker), {
      x: titleX + bold.widthOfTextAtSize(safe(d.pdf.option(index)), 9) + 6, y, size: 9, font: bold, color: GOLD,
    });
  }
  y -= 20;
  nameLines.forEach((line) => {
    page.drawText(line, { x: titleX, y, size: 16, font: bold, color: NAVY });
    y -= 19;
  });
  page.drawText(safe(plan.seguradora), { x: titleX, y, size: 10, font: regular, color: MUTED });
  y -= 18;
  const chipW = metalChip(page, bold, titleX, y, plan.metalLevel, d);
  if (plan.tipoPlano) {
    page.drawText(safe(plan.tipoPlano), { x: titleX + chipW + 8, y: y + 3, size: 9, font: regular, color: MUTED });
  }

  // --- Preço (alinhado à direita, sem colidir com o nome)
  const priceStr = safe(money(plan.premioMensal, L));
  const per = safe(d.pdf.perMonth);
  const priceW = bold.widthOfTextAtSize(priceStr, 26);
  const perW = regular.widthOfTextAtSize(per, 10);
  page.drawText(priceStr, { x: right - perW - priceW, y: top - 46, size: 26, font: bold, color: NAVY });
  page.drawText(per, { x: right - perW, y: top - 46, size: 10, font: regular, color: MUTED });
  if (plan.creditoFiscal > 0) {
    const l1 = safe(d.pdf.withoutCredit(money(plan.premioSemCredito, L)));
    const l2 = safe(d.pdf.creditEstimated(money(plan.creditoFiscal, L)));
    page.drawText(l1, { x: right - regular.widthOfTextAtSize(l1, 9), y: top - 62, size: 9, font: regular, color: MUTED });
    page.drawText(l2, { x: right - bold.widthOfTextAtSize(l2, 9), y: top - 75, size: 9, font: bold, color: GREEN });
  }

  // --- Números que decidem
  y = top - headH;
  const boxW = (CONTENT - PAD * 2 - 14) / 2;
  ([[d.pdf.deductible, money(plan.dedutivel, L)], [d.pdf.oopMax, money(plan.maxBolso, L)]] as Array<[string, string]>).forEach(
    ([label, value], i) => {
      const x = left + i * (boxW + 14);
      page.drawRectangle({ x, y: y - figuresH + 6, width: boxW, height: figuresH - 6, color: WASH });
      page.drawRectangle({ x, y: y - figuresH + 6, width: 2.5, height: figuresH - 6, color: isRec ? GOLD : NAVY_SOFT });
      page.drawText(safe(label), { x: x + 12, y: y - 12, size: 9, font: regular, color: MUTED });
      page.drawText(safe(value), { x: x + 12, y: y - 30, size: 14, font: bold, color: INK });
    },
  );
  y -= figuresH + 14;

  // --- Tabela "o que você paga": grade de duas colunas, cada célula quebrando
  page.drawText(safe(d.pdf.youPayHeading), { x: left, y, size: 9, font: bold, color: NAVY });
  y -= 8;
  page.drawRectangle({ x: left, y, width: CONTENT - PAD * 2, height: 0.8, color: NAVY_SOFT });
  y -= 4;

  cells.forEach((cell, i) => {
    const h = rowHeights[i];
    // Zebra discreta para o olho não pular de linha na leitura horizontal.
    if (i % 2 === 0) {
      page.drawRectangle({ x: left, y: y - h, width: CONTENT - PAD * 2, height: h, color: WASH });
    }
    const textTop = y - ROW_PAD - 8;
    cell.label.forEach((line, li) => {
      page.drawText(line, { x: left + 8, y: textTop - li * ROW_LEAD, size: 10, font: regular, color: MUTED });
    });
    cell.value.forEach((line, li) => {
      page.drawText(line, {
        x: right - 8 - bold.widthOfTextAtSize(line, 10),
        y: textTop - li * ROW_LEAD, size: 10, font: bold, color: INK,
      });
    });
    y -= h;
  });

  // Elo de volta ao comparativo
  page.drawText(safe(d.pdf.compareOnPage(comparisonPage)), {
    x: left, y: top - cardH + 12, size: 8.5, font: regular, color: MUTED,
  });

  ctx.y = top - cardH - 16;
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

  const d = dict(profile.idioma);
  const L = d.locale;

  const doc = await PDFDocument.create();
  doc.setTitle(`${d.pdf.title} ${profile.year}`);
  doc.setAuthor(LEAO_BRAND.name);
  doc.setCreator(LEAO_BRAND.name);
  doc.setSubject(`${d.pdf.title} — Marketplace / Obamacare`);
  doc.setLanguage(L);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoWide = await loadLogo(doc, "logo-a.png");
  const logoStacked = await loadLogo(doc, "logo-b.png");

  const first = doc.addPage(A4);
  const ctx: Ctx = {
    doc, page: first, y: 0, regular, bold, logoWide, logoStacked,
    pages: [first], section: d.pdf.sideBySide(options.length), d,
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

  const title = safe(d.pdf.title);
  first.drawText(title, { x: (A4[0] - bold.widthOfTextAtSize(title, 22)) / 2, y, size: 22, font: bold, color: NAVY });
  y -= 16;
  const sub = safe(d.pdf.subtitle(profile.year));
  first.drawText(sub, { x: (A4[0] - regular.widthOfTextAtSize(sub, 10)) / 2, y, size: 10, font: regular, color: MUTED });
  y -= 26;

  if (profile.contactName) {
    const who = safe(d.pdf.preparedFor(profile.contactName));
    first.drawText(who, { x: (A4[0] - bold.widthOfTextAtSize(who, 12)) / 2, y, size: 12, font: bold, color: INK });
    y -= 24;
  }

  // Faixa do perfil considerado — o que a cotação assumiu, explícito
  const ages = profile.people.map((p) => `${p.age}`).join(", ");
  const facts: Array<[string, string]> = [
    [d.pdf.peopleOnPlan, `${profile.people.length}${ages ? ` (${ages} ${d.yearsOld})` : ""}`],
    [d.pdf.zipcode, `${profile.zipcode} / ${profile.state}`],
    [d.pdf.income, money(profile.income, L)],
  ];
  const factH = 50;
  first.drawRectangle({ x: M, y: y - factH, width: CONTENT, height: factH, color: NAVY });
  const colW = CONTENT / facts.length;
  facts.forEach(([label, value], i) => {
    const cx = M + 14 + i * colW;
    first.drawText(safe(label.toUpperCase()), { x: cx, y: y - 18, size: 7.5, font: regular, color: rgb(0.68, 0.73, 0.82) });
    first.drawText(safe(value), { x: cx, y: y - 34, size: 12, font: bold, color: WHITE });
    if (i > 0) first.drawRectangle({ x: M + i * colW, y: y - factH + 10, width: 0.6, height: factH - 20, color: NAVY_SOFT });
  });
  y -= factH + 30;

  // Título do comparativo (a tabela em si é desenhada depois — ver abaixo).
  ctx.y = y;
  const heading = safe(d.pdf.sideBySide(options.length));
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
  newPage(ctx, d.pdf.detailSection);
  ctx.page.drawText(safe(d.pdf.detailSection), { x: M, y: ctx.y, size: 13, font: bold, color: NAVY });
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
  const urlLines = url ? wrapChars(url, regular, 8.5, CONTENT - 28, 2) : [];
  const stepsH = url ? 72 + urlLines.length * 11 : 64;
  if (compCtx.y - stepsH > FOOT) {
    const top = compCtx.y;
    first.drawRectangle({ x: M, y: top - stepsH, width: CONTENT, height: stepsH, color: WASH });
    first.drawRectangle({ x: M, y: top - stepsH, width: 2.5, height: stepsH, color: GOLD });
    first.drawText(safe(d.pdf.howToProceed), { x: M + 14, y: top - 18, size: 11, font: bold, color: NAVY });
    const steps = [d.pdf.step1, d.pdf.step2];
    steps.forEach((step, i) => {
      first.drawText(safe(`${i + 1}.`), { x: M + 14, y: top - 38 - i * 14, size: 9.5, font: bold, color: GOLD });
      first.drawText(safe(step), { x: M + 28, y: top - 38 - i * 14, size: 9.5, font: regular, color: INK });
    });
    if (url) {
      first.drawText(safe(d.pdf.seeOnline), { x: M + 14, y: top - 72, size: 9, font: bold, color: NAVY });
      urlLines.forEach((line, i) => {
        first.drawText(line, { x: M + 14, y: top - 85 - i * 11, size: 8.5, font: regular, color: hexRgb("#8A6410") });
      });
    }
  }

  // ------------------------------------------------------------- Fecho: aviso
  if (url && expiresAt) {
    ensure(ctx, 20);
    ctx.page.drawText(safe(`${d.pdf.validUntil(new Date(expiresAt).toLocaleDateString(L))} · ${url}`), {
      x: M, y: ctx.y, size: 7.5, font: regular, color: MUTED,
    });
    ctx.y -= 18;
  }

  // Em português vale o aviso da marca (configurável para revenda, §8); nos
  // outros idiomas, a versão traduzida — o §7 exige o aviso, não o texto exato.
  const disclaimer = wrap(
    profile.idioma && profile.idioma !== "pt" ? d.pdf.disclaimer : LEAO_BRAND.disclaimer,
    regular, 9, CONTENT - 28,
  );
  const noteH = disclaimer.length * 12 + 24;
  ensure(ctx, noteH);
  ctx.page.drawRectangle({
    x: M, y: ctx.y - noteH, width: CONTENT, height: noteH,
    color: GOLD_WASH, borderColor: rgb(0.91, 0.8, 0.58), borderWidth: 0.8,
  });
  disclaimer.forEach((line, i) => {
    ctx.page.drawText(line, {
      x: M + 14, y: ctx.y - 18 - i * 12, size: 9, font: regular, color: hexRgb("#6B4E12"),
    });
  });

  ctx.pages.forEach((p, i) => footer(p, regular, bold, i + 1, ctx.pages.length));

  const bytes = await doc.save();
  const who = (profile.contactName || "cliente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return { bytes, filename: `${d.pdf.filename}-${who}-${profile.year}.pdf` };
}
