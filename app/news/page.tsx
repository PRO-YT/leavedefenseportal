import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { formatMilitaryNewsDate, getMilitaryNews } from "@/lib/military-news";

export const revalidate = 86400;

export default async function NewsIndexPage() {
  const articles = await getMilitaryNews(100);

  return (
    <main className="min-h-dvh bg-[#eceef1] px-5 py-8 text-[#14294b] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <Link
            href="/#news"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b355f] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to homepage
          </Link>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
            U.S. Military News Feed
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[#2e415d] sm:text-lg">
            Live updates sourced from Defense.gov and Google News military headlines. This feed
            refreshes every 24 hours.
          </p>
        </div>

        {articles.length > 0 ? (
          <div className="grid gap-5">
            {articles.map((article) => (
              <article
                key={article.id}
                className="rounded-2xl border border-[#d1d8e1] bg-white p-5 shadow-sm"
              >
                <div className="relative mb-4 overflow-hidden rounded-xl border border-[#d1d8e1]">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    width={960}
                    height={480}
                    className="h-44 w-full object-cover sm:h-56"
                  />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#49608a] sm:text-sm">
                  {article.source} - {formatMilitaryNewsDate(article.publishedAt)}
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold leading-tight text-[#14294b] sm:text-2xl">
                  {article.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#2e415d] sm:text-base sm:leading-7">
                  {article.summary}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link
                    href={`/news/${article.id}`}
                    className="inline-flex items-center rounded-full bg-[#edc619] px-5 py-2 text-sm font-bold text-[#1b2415] transition hover:bg-[#f6d64f]"
                  >
                    Read full article
                  </Link>
                  <Link
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b355f] hover:underline"
                  >
                    Read original source
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#d1d8e1] bg-white p-6 text-sm text-[#2e415d] sm:text-base">
            No live news items are available right now. The feed will retry and refresh
            automatically in the next cycle.
          </div>
        )}
      </div>
    </main>
  );
}
