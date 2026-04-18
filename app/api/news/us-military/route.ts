import { NextResponse } from "next/server";

import { getMilitaryNews } from "@/lib/military-news";

export const revalidate = 86400;

export async function GET() {
  const articles = await getMilitaryNews(30);

  return NextResponse.json({
    articles,
    count: articles.length,
    refreshedAt: new Date().toISOString(),
    revalidateInSeconds: 86400,
  });
}
