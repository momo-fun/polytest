import { NextResponse } from "next/server";
import { getDbPath } from "../../../lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    db: getDbPath(),
    timestamp: new Date().toISOString()
  });
}
