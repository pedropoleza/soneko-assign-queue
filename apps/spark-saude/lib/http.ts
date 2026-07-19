import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/ghl/errors";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(err: unknown) {
  const { status, payload } = toErrorResponse(err);
  return NextResponse.json(payload, { status });
}

export function locationFromRequest(req: Request): string | undefined {
  return new URL(req.url).searchParams.get("location") || undefined;
}
