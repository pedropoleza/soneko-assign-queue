/**
 * Entrada "core" do `qrcode` — só o encoder, sem os renderizadores.
 *
 * O pacote principal importa o renderizador PNG, que faz `require("fs")` em
 * tempo de módulo; num bundle serverless isso quebra. Aqui só precisamos da
 * matriz de módulos, que este entry devolve sem tocar em I/O.
 */
declare module "qrcode/lib/core/qrcode.js" {
  export interface QrBitMatrix {
    size: number;
    get(row: number, col: number): number;
  }
  export interface QrCode {
    modules: QrBitMatrix;
  }
  export function create(
    data: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H"; version?: number },
  ): QrCode;
  const _default: { create: typeof create };
  export default _default;
}
