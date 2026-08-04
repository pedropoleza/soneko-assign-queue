import fs from "node:fs/promises";
import path from "node:path";
import { create as createQr } from "qrcode/lib/core/qrcode.js";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { LEAO_BRAND } from "./brand";
import { dict, type Dict } from "./i18n";
import { describePeople } from "./message";
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

/*
 * Gramática de layout do template — vale para o comparativo e para as folhas de
 * detalhe, e é o que impede uma célula de comer a linha da outra.
 *
 * A regra é uma só: NADA é desenhado numa linha-base fixa. Cada célula é
 * quebrada na largura da sua própria coluna, a altura da linha vem da célula
 * mais alta, e os números são ancorados à DIREITA da coluna — assim um valor
 * mais longo cresce para dentro do próprio espaço em vez de invadir o vizinho.
 * Qualquer tabela nova neste documento deve seguir estas medidas.
 */
const COL_PAD = 12; // respiro nas bordas da linha
const COL_GAP = 10; // espaço entre colunas numéricas
const BADGE_W = 18; // selo numerado
const W_PRICE = 96; // mensalidade (15pt) + barra + linha do crédito
const W_DED = 70; // dedutível
const W_OOP = 78; // máximo do bolso (o rótulo mais longo dos três)
const ROW_PAD_Y = 10; // respiro vertical dentro da linha
const LEAD_TITLE = 14; // entrelinha do nome do plano (11.5pt)
const LEAD_META = 10.5; // entrelinha dos textos de apoio (8pt)
const CHIP_H = 13; // altura do chip de metal


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

/**
 * Quebra com teto de linhas. Cortar no limite sem avisar é o que fazia nomes de
 * plano sumirem pela metade; aqui o corte é explícito, com reticências.
 */
function wrapMax(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const lines = wrap(text, font, size, maxWidth);
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  let last = cut[maxLines - 1] ?? "";
  while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
  cut[maxLines - 1] = `${last}...`;
  return cut;
}

/** Texto alinhado à direita de um limite — é assim que número fica sob número. */
function rightText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  rightX: number,
  y: number,
  color: RGB,
) {
  const t = safe(text);
  page.drawText(t, { x: rightX - font.widthOfTextAtSize(t, size), y, size, font, color });
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
  /**
   * Páginas já criadas que o próximo `newPage` deve consumir antes de abrir uma
   * nova. É o que mantém o comparativo na frente do documento: as páginas dele
   * são reservadas ANTES das folhas de detalhe, mesmo sendo desenhadas depois.
   */
  reserved?: PDFPage[];
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
  const reserved = ctx.reserved?.shift();
  if (reserved) {
    ctx.page = reserved; // já está em ctx.pages, na posição certa
  } else {
    ctx.page = ctx.doc.addPage(A4);
    ctx.pages.push(ctx.page);
  }
  header(ctx);
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed <= FOOT) newPage(ctx);
}

/**
 * Área clicável apontando para uma URL.
 *
 * O link da proposta era só TEXTO desenhado na página: o cliente tinha que
 * selecionar 180 caracteres de base64 quebrados em duas linhas e colar no
 * navegador — e a quebra de linha entrava junto, então o link chegava quebrado.
 * Agora o PDF carrega uma anotação de link de verdade, que o leitor abre com um
 * toque.
 */
function linkArea(doc: PDFDocument, page: PDFPage, url: string, x: number, y: number, w: number, h: number) {
  const annot = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + w, y + h],
      // Sem moldura: o desenho embaixo já comunica que é clicável.
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    }),
  );
  const existing = page.node.get(PDFName.of("Annots"));
  if (existing instanceof PDFArray) existing.push(annot);
  else page.node.set(PDFName.of("Annots"), doc.context.obj([annot]));
}

/**
 * QR da proposta — para quem abre o PDF no computador e não tem onde tocar.
 * Desenhado módulo a módulo; a lib só devolve a matriz, sem canvas, o que
 * mantém a geração rodando dentro de uma função serverless.
 */
function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = createQr(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  page.drawRectangle({ x: x - 4, y: y - 4, width: size + 8, height: size + 8, color: WHITE });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      page.drawRectangle({
        x: x + c * cell,
        // A matriz conta as linhas de cima para baixo; o PDF, de baixo para cima.
        y: y + (n - 1 - r) * cell,
        width: cell,
        height: cell,
        color: NAVY,
      });
    }
  }
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
/* Geometria das colunas do comparativo — uma só definição para quem mede e
   para quem desenha, senão a reserva de páginas erra por alguns pontos. */
const X_RIGHT = M + CONTENT - COL_PAD;
const X_OOP = X_RIGHT - W_OOP;
const X_DED = X_OOP - COL_GAP - W_DED;
const X_PRICE = X_DED - COL_GAP - W_PRICE;
const X_NAME = M + COL_PAD + BADGE_W + 8;
const W_NAME = X_PRICE - COL_GAP - X_NAME;

/** As células de uma linha, já quebradas — medir e desenhar leem o mesmo objeto. */
function comparisonRow(plan: PlanOptionDraft, regular: PDFFont, bold: PDFFont, d: Dict) {
  const nameLines = wrapMax(plan.nomePlano, bold, 11.5, W_NAME, 2);
  const insurerLines = wrapMax(plan.seguradora, regular, 8, W_NAME, 2);
  const creditLines =
    plan.creditoFiscal > 0
      ? wrapMax(d.pdf.creditIncluded(moneyShort(plan.creditoFiscal, d.locale)), regular, 7, W_PRICE, 2)
      : [];
  const leftH = nameLines.length * LEAD_TITLE + 4 + insurerLines.length * LEAD_META + 8 + CHIP_H;
  const rightH = 17 + 12 + creditLines.length * 9;
  const height = ROW_PAD_Y * 2 + Math.max(leftH, rightH, 42);
  return { nameLines, insurerLines, creditLines, height };
}

const HEAD_H = 22;

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

  /*
   * Grade da tabela — a mesma gramática das folhas de detalhe (ver ROW_LEAD /
   * ROW_PAD abaixo): as colunas numéricas têm largura própria e são alinhadas
   * pela DIREITA, e o bloco do nome recebe o que sobra. Nada é desenhado numa
   * linha-base fixa: cada célula é quebrada na largura da sua coluna e a altura
   * da linha vem da coluna mais alta. Era isso que faltava — o nome da
   * seguradora saía sem quebra e atravessava a coluna da mensalidade.
   */
  // Cabeçalho: rótulos numéricos alinhados à direita, sob os próprios números.
  ensure(ctx, HEAD_H + 12);
  const headY = ctx.y;
  ctx.page.drawRectangle({ x: M, y: headY - HEAD_H, width: CONTENT, height: HEAD_H, color: NAVY });
  ctx.page.drawText(safe(d.pdf.colOption), {
    x: M + COL_PAD, y: headY - 14.5, size: 8, font: bold, color: WHITE,
  });
  (
    [
      [d.pdf.colPremium, X_PRICE + W_PRICE],
      [d.pdf.colDeductible, X_DED + W_DED],
      [d.pdf.colOopMax, X_RIGHT],
    ] as Array<[string, number]>
  ).forEach(([label, right]) => rightText(ctx.page, label, bold, 8, right, headY - 14.5, WHITE));
  ctx.y = headY - HEAD_H;

  options.forEach((plan, i) => {
    const isRec = plan.planId === recommendedPlanId;

    // 1) Medir tudo antes de desenhar qualquer coisa.
    const { nameLines, insurerLines, creditLines, height: rowH } = comparisonRow(plan, regular, bold, d);
    const before = ctx.page;
    ensure(ctx, rowH);
    if (ctx.page !== before) {
      // Continuou noutra página: o cabeçalho vai junto, senão a tabela perde os rótulos.
      ctx.page.drawRectangle({ x: M, y: ctx.y - HEAD_H, width: CONTENT, height: HEAD_H, color: NAVY });
      ctx.page.drawText(safe(d.pdf.colOption), { x: M + COL_PAD, y: ctx.y - 14.5, size: 8, font: bold, color: WHITE });
      (
        [
          [d.pdf.colPremium, X_PRICE + W_PRICE],
          [d.pdf.colDeductible, X_DED + W_DED],
          [d.pdf.colOopMax, X_RIGHT],
        ] as Array<[string, number]>
      ).forEach(([label, right]) => rightText(ctx.page, label, bold, 8, right, ctx.y - 14.5, WHITE));
      ctx.y -= HEAD_H;
    }
    const top = ctx.y;
    const page = ctx.page;

    page.drawRectangle({
      x: M, y: top - rowH, width: CONTENT, height: rowH,
      color: isRec ? GOLD_WASH : i % 2 ? WASH : WHITE,
    });
    if (isRec) page.drawRectangle({ x: M, y: top - rowH, width: 3.5, height: rowH, color: GOLD });
    page.drawRectangle({ x: M, y: top - rowH, width: CONTENT, height: 0.6, color: HAIRLINE });

    // 2) Coluna da esquerda: selo, nome, seguradora, tier.
    const startY = top - ROW_PAD_Y;
    numberBadge(page, bold, M + COL_PAD, startY - 17, i + 1, isRec);

    let ny = startY - 11;
    nameLines.forEach((line) => {
      page.drawText(line, { x: X_NAME, y: ny, size: 11.5, font: bold, color: NAVY });
      ny -= LEAD_TITLE;
    });
    ny -= 4;
    insurerLines.forEach((line) => {
      page.drawText(line, { x: X_NAME, y: ny, size: 8, font: regular, color: MUTED });
      ny -= LEAD_META;
    });
    ny -= 6;
    const chipW = metalChip(page, bold, X_NAME, ny, plan.metalLevel, d);
    if (isRec) {
      page.drawText(safe(d.pdf.recommended), { x: X_NAME + chipW + 8, y: ny + 3, size: 8, font: bold, color: GOLD });
    }
    // A ponte para a folha de detalhe fecha a linha, na mesma altura do chip.
    rightText(page, d.pdf.detailOnPage(detailPageOf(plan.planId)), regular, 8, X_RIGHT, ny + 3, MUTED);

    // 3) Colunas numéricas, todas ancoradas à direita.
    const numY = startY - 15;
    rightText(page, money(plan.premioMensal, L), bold, 15, X_PRICE + W_PRICE, numY, isRec ? hexRgb("#8A6410") : NAVY);
    rightText(page, moneyShort(plan.dedutivel, L), bold, 11.5, X_DED + W_DED, numY, INK);
    rightText(page, moneyShort(plan.maxBolso, L), bold, 11.5, X_RIGHT, numY, INK);

    // Barra comparativa da mensalidade, na largura exata da coluna.
    const barY = numY - 11;
    page.drawRectangle({ x: X_PRICE, y: barY, width: W_PRICE, height: 5, color: HAIRLINE });
    page.drawRectangle({
      x: X_PRICE, y: barY,
      width: Math.max(4, (plan.premioMensal / maxPremium) * W_PRICE), height: 5,
      color: isRec ? GOLD : NAVY_SOFT,
    });
    let cy = barY - 10;
    creditLines.forEach((line) => {
      rightText(page, line, regular, 7, X_PRICE + W_PRICE, cy, GREEN);
      cy -= 9;
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

// --------------------------------------------------------------- Premissas

/**
 * As premissas da cotação, com as palavras dela.
 *
 * É o texto que a Dani manda junto de toda cotação — inclusive a ressalva de
 * que o preço tende a cair na inscrição, porque o sistema de cotação não
 * reconhece as idades das crianças. Sem isso o cliente lê um número e acha que
 * é o final; a ressalva é parte do trabalho dela, não um rodapé.
 *
 * As mesmas frases do WhatsApp e do e-mail (lib/cotacao/message.ts), montadas
 * aqui como blocos em vez de um parágrafo corrido.
 */
function drawPremises(ctx: Ctx, profile: QuoteProfile): number {
  const { page, regular, bold, d } = ctx;
  const top = ctx.y;
  const innerW = CONTENT - 32;

  const introLines = wrap(d.msg.intro(profile.year), regular, 9.5, CONTENT);
  const bullets = [
    d.msg.household(profile.people.length, describePeople(profile.people, d)),
    d.msg.zip(profile.zipcode),
    d.msg.income(profile.year, `$${Math.round(profile.income).toLocaleString("en-US")}`),
  ].map((b) => wrap(b.replace(/^•\s*/, ""), regular, 9.5, innerW - 14));
  const caveatLines = wrap(d.msg.caveat, regular, 8.5, CONTENT);

  const cardH = 14 + bullets.reduce((h, lines) => h + lines.length * 12.5 + 5, 0);

  introLines.forEach((line, i) => {
    page.drawText(line, { x: M, y: top - 10 - i * 12, size: 9.5, font: regular, color: INK });
  });
  let y = top - 10 - introLines.length * 12 - 8;

  page.drawRectangle({ x: M, y: y - cardH, width: CONTENT, height: cardH, color: WASH });
  page.drawRectangle({ x: M, y: y - cardH, width: 2.5, height: cardH, color: GOLD });
  let by = y - 16;
  bullets.forEach((lines) => {
    page.drawText("-", { x: M + 16, y: by, size: 9.5, font: bold, color: GOLD });
    lines.forEach((line) => {
      page.drawText(line, { x: M + 26, y: by, size: 9.5, font: regular, color: INK });
      by -= 12.5;
    });
    by -= 5;
  });
  y -= cardH + 10;

  caveatLines.forEach((line, i) => {
    page.drawText(line, { x: M, y: y - i * 10.5, size: 8.5, font: regular, color: hexRgb("#8A6410") });
  });
  y -= caveatLines.length * 10.5 + 6;

  ctx.y = y;
  return top - y;
}

// ------------------------------------------------------- Como seguir daqui

const QR_SIZE = 74;
/** Altura fixa do bloco — usada para decidir se ele cabe na página corrente. */
const NEXT_STEPS_H = 104;

/**
 * O convite para responder: os dois passos, um botão clicável e o QR.
 *
 * Nada de URL em texto. A URL assinada tem ~180 caracteres de base64: impressa,
 * quebrava em duas linhas e era truncada com reticências, e quem copiasse levava
 * um link quebrado — foi assim que a proposta chegou "inválida" ao cliente. O
 * botão e o QR carregam o link inteiro, sem o cliente precisar transcrever nada.
 */
function drawNextSteps(ctx: Ctx, url?: string) {
  const { page, doc, regular, bold, d } = ctx;
  const top = ctx.y;
  const H = NEXT_STEPS_H;

  page.drawRectangle({ x: M, y: top - H, width: CONTENT, height: H, color: WASH });
  page.drawRectangle({ x: M, y: top - H, width: 2.5, height: H, color: GOLD });

  // O QR mora à direita e define a largura do texto à esquerda.
  const textW = url ? CONTENT - 28 - QR_SIZE - 24 : CONTENT - 28;
  if (url) {
    const qrX = M + CONTENT - 16 - QR_SIZE;
    const qrY = top - H + (H - QR_SIZE) / 2;
    drawQr(page, url, qrX, qrY, QR_SIZE);
    linkArea(doc, page, url, qrX - 4, qrY - 4, QR_SIZE + 8, QR_SIZE + 8);
  }

  page.drawText(safe(d.pdf.howToProceed), { x: M + 14, y: top - 18, size: 11, font: bold, color: NAVY });
  let sy = top - 36;
  [d.pdf.step1, d.pdf.step2].forEach((step, i) => {
    page.drawText(safe(`${i + 1}.`), { x: M + 14, y: sy, size: 9, font: bold, color: GOLD });
    wrap(step, regular, 9, textW - 14).forEach((line) => {
      page.drawText(line, { x: M + 28, y: sy, size: 9, font: regular, color: INK });
      sy -= 11.5;
    });
    sy -= 2;
  });

  if (url) {
    // Botão clicável — a área de link cobre exatamente a pílula desenhada.
    const label = safe(d.pdf.ctaButton);
    const btnW = Math.min(textW, bold.widthOfTextAtSize(label, 9.5) + 28);
    const btnH = 22;
    const btnY = top - H + 12;
    page.drawRectangle({ x: M + 14, y: btnY, width: btnW, height: btnH, color: NAVY });
    page.drawText(label, {
      x: M + 14 + (btnW - bold.widthOfTextAtSize(label, 9.5)) / 2,
      y: btnY + 7.5, size: 9.5, font: bold, color: WHITE,
    });
    linkArea(doc, page, url, M + 14, btnY, btnW, btnH);
    wrap(d.pdf.scanQr, regular, 7, textW - btnW - 12).forEach((line, i) => {
      page.drawText(line, { x: M + 14 + btnW + 10, y: btnY + 12 - i * 8.5, size: 7, font: regular, color: MUTED });
    });
  }

  ctx.y = top - H;
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
    const h = 72;
    const w = (logoStacked.width / logoStacked.height) * h;
    first.drawImage(logoStacked, { x: (A4[0] - w) / 2, y: y - h, width: w, height: h });
    y -= h + 18;
  } else {
    y -= 30;
  }
  first.drawRectangle({ x: (A4[0] - 56) / 2, y, width: 56, height: 1.6, color: GOLD });
  y -= 22;

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

  // As premissas, com o texto dela — é o que enquadra tudo o que vem depois.
  ctx.y = y - 6;
  drawPremises(ctx, profile);
  ctx.y -= 12;

  // Título do comparativo (a tabela em si é desenhada depois — ver abaixo).
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

  /*
   * Reserva das páginas do comparativo.
   *
   * A tabela é DESENHADA depois das folhas de detalhe (é assim que ela sabe em
   * que página cada opção caiu), mas precisa APARECER antes delas. Enquanto
   * coubesse na página 1 isso funcionava sozinho; com muitas opções, a linha que
   * transbordava era criada no fim do documento, depois dos detalhes. Aqui
   * medimos a tabela — as mesmas medidas que o desenho vai usar — e criamos as
   * páginas extras agora, na posição certa.
   */
  const extraPages: PDFPage[] = [];
  {
    let free = comparisonY - FOOT - HEAD_H - 12;
    const pageFree = A4[1] - M - 58 - FOOT - HEAD_H;
    for (const plan of sorted) {
      const { height } = comparisonRow(plan, regular, bold, d);
      if (free - height <= 0) {
        const p = doc.addPage(A4);
        ctx.pages.push(p);
        extraPages.push(p);
        free = pageFree;
      }
      free -= height;
    }
  }

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
  const compCtx: Ctx = {
    ...ctx, page: first, y: comparisonY,
    reserved: [...extraPages],
    // O rótulo do topo volta a ser o do comparativo: ctx.section já tinha sido
    // trocado para o das folhas de detalhe quando elas foram desenhadas.
    section: d.pdf.sideBySide(options.length),
  };
  drawComparison(compCtx, sorted, recommendedPlanId, (id) => pageOf.get(id) ?? 2);

  /*
   * O bloco "como seguir": a única chamada à ação do documento.
   *
   * Ele cabe embaixo do comparativo quando há poucas opções; com muitas, vai
   * para o fim do documento. O que ele NÃO faz mais é sumir — antes, quando não
   * coubesse na página 1, era descartado em silêncio e o cliente ficava sem
   * saber como responder.
   */
  compCtx.y -= 8;
  if (compCtx.y - NEXT_STEPS_H > FOOT) drawNextSteps(compCtx, url);
  else {
    ensure(ctx, NEXT_STEPS_H + 8);
    ctx.y -= 8;
    drawNextSteps(ctx, url);
  }

  // ------------------------------------------------------------- Fecho: aviso
  if (url && expiresAt) {
    ctx.y -= 14; // respiro depois do bloco de ação
    ensure(ctx, 20);
    // Só a validade em texto; o link vive no botão e no QR da página 1.
    ctx.page.drawText(safe(d.pdf.validUntil(new Date(expiresAt).toLocaleDateString(L))), {
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
