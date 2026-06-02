import { NextResponse } from "next/server";
import { VOICES } from "@/lib/voices";

export async function GET() {
    return NextResponse.json(VOICES);
}