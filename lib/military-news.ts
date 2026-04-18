import { createHash } from "node:crypto";

export const MILITARY_NEWS_REVALIDATE_SECONDS = 60 * 60 * 24;

const NEWS_FEEDS = [
  {
    source: "Defense.gov",
    url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=60",
  },
  {
    source: "U.S. Army",
    url: "https://www.army.mil/rss/static/1.xml",
  },
  {
    source: "DVIDS",
    url: "https://www.dvidshub.net/rss/news",
  },
] as const;

const LOCAL_NEWS_FALLBACK_IMAGES = [
  "/images/hero-main.jpg",
  "/images/section-feature.jpg",
  "/images/section-footer.jpg",
  "/images/hero-slide-2.jpg",
  "/images/hero-slide-4.jpeg",
] as const;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "-",
  "&mdash;": "-",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
};

const MOJIBAKE_FIXES: Record<string, string> = {
  "â€”": "-",
  "â€“": "-",
  "â€™": "'",
  "â€˜": "'",
  "â€œ": '"',
  "â€\u009d": '"',
  "Â ": " ",
  "Â": "",
};

export interface MilitaryNewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
  content: string;
  imageUrl: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .trim();
}

function extractTag(xml: string, tag: string): string | null {
  const escapedTag = escapeRegex(tag);
  const regex = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
  const match = xml.match(regex);
  if (!match?.[1]) {
    return null;
  }
  return stripCdata(match[1]);
}

function extractAttributeValue(xml: string, tag: string, attribute: string): string | null {
  const escapedTag = escapeRegex(tag);
  const escapedAttribute = escapeRegex(attribute);
  const regex = new RegExp(
    `<${escapedTag}\\b[^>]*${escapedAttribute}=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function decodeHtmlEntities(value: string): string {
  const namedDecoded = value.replace(/&[a-zA-Z]+;/g, (entity) => {
    return NAMED_HTML_ENTITIES[entity] ?? entity;
  });

  const decimalDecoded = namedDecoded.replace(/&#(\d+);/g, (_, code) => {
    const parsed = Number.parseInt(code, 10);
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
  });

  return decimalDecoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hexCode) => {
    const parsed = Number.parseInt(hexCode, 16);
    return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
  });
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function normalizeMojibake(value: string): string {
  return Object.entries(MOJIBAKE_FIXES).reduce((current, [broken, fixed]) => {
    return current.split(broken).join(fixed);
  }, value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toPlainText(value: string | null): string {
  if (!value) {
    return "";
  }

  // Decode first, strip HTML second, then decode again to handle escaped tags like &lt;a href=...&gt;.
  const decodedOnce = decodeHtmlEntities(stripCdata(value));
  const stripped = stripHtml(decodedOnce);
  const decodedTwice = decodeHtmlEntities(stripped);
  return normalizeWhitespace(normalizeMojibake(decodedTwice));
}

function toIsoDate(value: string | null): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(0).toISOString();
  }

  return parsedDate.toISOString();
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function extractImageFromDescription(description: string | null): string | null {
  if (!description) {
    return null;
  }
  const decoded = decodeHtmlEntities(description);
  const match = decoded.match(/<img[^>]*src=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? null;
}

function isHttpUrl(url: string | null): url is string {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function chooseFallbackImage(seed: string): string {
  const digest = createHash("sha1").update(seed).digest("hex");
  const numericSeed = Number.parseInt(digest.slice(0, 8), 16);
  return LOCAL_NEWS_FALLBACK_IMAGES[numericSeed % LOCAL_NEWS_FALLBACK_IMAGES.length];
}

function extractImageUrl(itemXml: string, descriptionRaw: string | null): string | null {
  const candidates = [
    extractAttributeValue(itemXml, "enclosure", "url"),
    extractAttributeValue(itemXml, "media:content", "url"),
    extractAttributeValue(itemXml, "media:thumbnail", "url"),
    extractImageFromDescription(descriptionRaw),
  ];

  for (const candidate of candidates) {
    if (isHttpUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function parseItemsFromFeed(feedXml: string, fallbackSource: string): MilitaryNewsItem[] {
  const itemBlocks = feedXml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemBlocks
    .map((itemXml) => {
      const title = toPlainText(extractTag(itemXml, "title"));
      const link = normalizeUrl(extractTag(itemXml, "link")?.trim() ?? "");
      const source = fallbackSource;
      const publishedAt = toIsoDate(extractTag(itemXml, "pubDate"));

      const descriptionRaw = extractTag(itemXml, "description");
      const contentRaw = extractTag(itemXml, "content:encoded") ?? descriptionRaw;
      const summary = truncateText(toPlainText(descriptionRaw), 260);
      const content = toPlainText(contentRaw);
      const imageUrl =
        extractImageUrl(itemXml, descriptionRaw) ?? chooseFallbackImage(`${title}-${source}`);

      if (!title || !link) {
        return null;
      }

      return {
        id: createHash("sha1").update(`${title}-${link}`).digest("hex").slice(0, 16),
        title,
        link,
        source,
        publishedAt,
        summary: summary || "Open article to read full details.",
        content: content || summary || "Open the original source for complete article text.",
        imageUrl,
      } satisfies MilitaryNewsItem;
    })
    .filter((item): item is MilitaryNewsItem => item !== null);
}

async function fetchNewsFeed(source: (typeof NEWS_FEEDS)[number]): Promise<MilitaryNewsItem[]> {
  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "MilitaryNewsAggregator/1.0 (+https://localhost)",
      },
      next: { revalidate: MILITARY_NEWS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return [];
    }

    const feedXml = await response.text();
    return parseItemsFromFeed(feedXml, source.source);
  } catch {
    return [];
  }
}

export async function getMilitaryNews(limit = 12): Promise<MilitaryNewsItem[]> {
  const allItems = (await Promise.all(NEWS_FEEDS.map((source) => fetchNewsFeed(source)))).flat();
  const deduped = new Map<string, MilitaryNewsItem>();

  for (const item of allItems) {
    const key = normalizeUrl(item.link);
    if (!key || deduped.has(key)) {
      continue;
    }
    deduped.set(key, item);
  }

  return [...deduped.values()]
    .sort((first, second) => {
      return new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime();
    })
    .slice(0, limit);
}

export async function getMilitaryNewsById(articleId: string): Promise<MilitaryNewsItem | null> {
  const items = await getMilitaryNews(200);
  return items.find((item) => item.id === articleId) ?? null;
}

export function formatMilitaryNewsDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
