import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { formatMilitaryNewsDate, getMilitaryNewsById } from "@/lib/military-news";

export const revalidate = 86400;

interface NewsArticlePageProps {
  params: Promise<{ articleId: string }>;
}

function toReadableParagraphs(content: string): string[] {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) {
    return [content];
  }

  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) {
    paragraphs.push(sentences.slice(index, index + 3).join(" "));
  }
  return paragraphs;
}

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { articleId } = await params;
  const article = await getMilitaryNewsById(articleId);

  if (!article) {
    notFound();
  }

  const paragraphs = toReadableParagraphs(article.content);

  return (
    <main className="min-h-dvh bg-[#eceef1] px-5 py-8 text-[#14294b] sm:px-8 lg:px-12">
      <article className="mx-auto max-w-4xl rounded-2xl border border-[#d1d8e1] bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b355f] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all updates
        </Link>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#49608a] sm:text-sm">
          {article.source} - {formatMilitaryNewsDate(article.publishedAt)}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-[#14294b] sm:text-4xl">
          {article.title}
        </h1>
        <div className="relative mt-5 overflow-hidden rounded-xl border border-[#d1d8e1]">
          <Image
            src={article.imageUrl}
            alt={article.title}
            width={1200}
            height={640}
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>
        <p className="mt-4 text-base leading-7 text-[#2e415d] sm:text-lg sm:leading-8">
          {article.summary}
        </p>

        <div className="mt-7 space-y-4">
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 60)} className="text-sm leading-7 text-[#203857] sm:text-base">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-[#d1d8e1] bg-[#f5f7fa] p-4">
          <Link
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b355f] hover:underline"
          >
            Open original source for full article context
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </main>
  );
}
