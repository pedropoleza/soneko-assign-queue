import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/ghl/errors";
import { cmsErrorPayload } from "@/lib/cms/errors";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(err: unknown) {
  // CMS errors first (rate limit / state-not-covered carry their own status),
  // then GHL + generic.
  const cms = cmsErrorPayload(err);
  const { status, payload } = cms ?? toErrorResponse(err);
  return NextResponse.json(payload, { status });
}

export function locationFromRequest(req: Request): string | undefined {
  return new URL(req.url).searchParams.get("location") || undefined;
}
