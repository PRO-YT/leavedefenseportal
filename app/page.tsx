import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CircleHelp,
  Headphones,
  Home,
  ListChecks,
  Mail,
  Newspaper,
  Phone,
  Plane,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Video,
} from "lucide-react";

import { FaqAccordion, type FaqItem } from "@/components/marketing/faq-accordion";
import { HeroBackgroundSlider } from "@/components/marketing/hero-background-slider";
import { LanguageDock } from "@/components/marketing/language-dock";
import { MemberIdSearchForm } from "@/components/marketing/member-id-search-form";
import { formatMilitaryNewsDate, getMilitaryNews } from "@/lib/military-news";

const HERO_SLIDES = [
  "/images/hero-slide-1.jpg",
  "/images/hero-slide-2.jpg",
  "/images/hero-slide-3.jpg",
  "/images/hero-slide-4.jpeg",
] as const;

const SITE_CONTACT_PHONE_DISPLAY = "+1 (267) 607-0897";
const SITE_CONTACT_PHONE_HREF = "tel:+12676070897";
const SITE_CONTACT_EMAIL = "leavedefenseportalarmy@gmail.com";

const navLinks = [
  { href: "#home", label: "Home", icon: Home },
  { href: "#about", label: "About Us", icon: Shield },
  { href: "/dossier?service=FLIGHT", label: "Apply Online", icon: ListChecks },
  { href: "#news", label: "News", icon: Newspaper },
  { href: "/dossier", label: "Dossier Portal", icon: BadgeCheck },
];

const supportCards = [
  {
    id: "s-1",
    title: "Book a Flight",
    description:
      "Facilitate travel arrangements for a service member's approved leave. We assist in coordinating with airlines to ensure a smooth journey home.",
    image: "/images/support-airplane.jpg",
    cta: "Initiate Request",
    supportPath: "/dossier?service=FLIGHT",
    icon: Plane,
  },
  {
    id: "s-2",
    title: "Purchase Call Time",
    description:
      "Help your service member stay connected. Request to purchase satellite or international call time on their behalf for delivery to their unit.",
    image: "/images/support-phone-call.jpg",
    cta: "Initiate Request",
    supportPath: "/dossier?service=CALL_TIME",
    icon: Phone,
  },
  {
    id: "s-3",
    title: "Request Shopping",
    description:
      "Arrange for essential personal items or care packages to be procured and delivered to a service member's designated location.",
    image: "/images/support-shopping.jpeg",
    cta: "Initiate Request",
    supportPath: "/dossier?service=SHOPPING",
    icon: ShoppingCart,
  },
  {
    id: "s-4",
    title: "Support Our Troops",
    description:
      "Your contribution helps fund morale, welfare, and recreation (MWR) programs that directly benefit our deployed personnel.",
    image: "/images/support-donate.jpg",
    cta: "Make a Donation",
    supportPath: "/dossier?service=MWR",
    icon: ShieldCheck,
  },
];

const faqItems: FaqItem[] = [
  {
    id: "faq-1",
    question: "How much leave time am I entitled to?",
    answer:
      "Active duty service members generally accrue 2.5 days of leave per month, totaling up to 30 days annually. Unit policy windows can affect approval timing.",
  },
  {
    id: "faq-2",
    question: "How do I apply for military leave?",
    answer:
      "Open the leave application portal, verify your member profile, complete your request details, and submit your coverage plan for command routing.",
  },
  {
    id: "faq-3",
    question: "Can emergency leave be routed faster?",
    answer:
      "Yes. Emergency leave packets are prioritized and routed with elevated review lanes when verified contact and mission handoff details are complete.",
  },
  {
    id: "faq-4",
    question: "Who can I contact for support?",
    answer:
      "Use the 24/7 support channel shown below or message your chain of command through the portal help desk.",
  },
];

export default async function HomePage() {
  const latestNews = await getMilitaryNews(6);
  const homepageNews = latestNews.slice(0, 6);

  return (
    <main className="min-h-dvh w-full pb-0 text-[0.95rem] sm:text-base">
      <div className="min-h-dvh w-full">
        <section
          id="home"
          className="flex min-h-[100dvh] w-full flex-col overflow-hidden border border-white/10 border-x-0 border-t-0 bg-[linear-gradient(120deg,#253220_0%,#5e6954_100%)]"
        >
          <div className="flex flex-col items-start gap-3 border-b border-[#d9dee5] bg-white px-4 py-3 text-sm text-[#1a2b4c] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-center gap-2 font-semibold">
              <span className="rounded-md bg-[#13a84d] px-2 py-1 text-[0.72rem] font-bold tracking-[0.08em] text-white">
                SECURE
              </span>
              Official Government Leave Department
            </div>
            <div className="flex items-center gap-2 font-medium">
              <Phone className="h-4 w-4" />
              24/7 Contact Line: {SITE_CONTACT_PHONE_DISPLAY}
            </div>
            <div className="flex items-center gap-3 font-semibold uppercase tracking-[0.08em] text-[#10284f]">
              Operational
              <span className="inline-flex items-center gap-2 rounded-full border border-[#9dc7b1] bg-[#def3e8] px-3 py-1 text-xs">
                <BadgeCheck className="h-4 w-4" />
                Verified
              </span>
            </div>
          </div>

          <div className="flex-1 px-4 py-6 sm:px-7 sm:py-7">
            <div className="grid gap-5 border-b border-white/25 pb-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[#ffde8a]/40 bg-[#0d2a6f]">
                  <Image
                    src="/images/dod-seal.png"
                    alt="Department of Defense seal"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="font-display text-[2rem] font-semibold leading-tight text-white sm:text-4xl sm:leading-none lg:text-5xl">
                    USA Defense Military Leave Portal
                  </h1>
                  <p className="mt-2 text-base italic text-[#f4e6be] sm:text-lg">
                    Honor, Service, Excellence, Sacrifice
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/20 bg-black/15 px-5 py-4 text-left sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f4e6be]">
                  Authorized Assistance
                </p>
                <p className="mt-1 text-sm font-semibold text-white sm:text-base">
                  Official Government Support
                </p>
              </div>
            </div>

            <nav className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label="Primary">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 sm:w-auto sm:justify-start"
                >
                  <item.icon className="h-4 w-4 text-[#f8dc8a]" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="relative mt-6 overflow-hidden rounded-[1.5rem] border border-white/20">
              <HeroBackgroundSlider
                slides={HERO_SLIDES}
                intervalMs={3000}
                className="h-[68dvh] min-h-[380px] w-full sm:min-h-[480px]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,17,11,0.08)_0%,rgba(9,17,11,0.64)_48%,rgba(9,17,11,0.78)_100%)]" />
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center sm:px-6">
                <div className="max-w-4xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#f4e6be]">
                    Official U.S. Military Service
                  </p>
                  <h2 className="mt-4 font-display text-[2.2rem] font-semibold leading-[0.95] text-white sm:text-5xl lg:text-7xl">
                    Supporting Our Heroes
                    <br />
                    & Their Families
                  </h2>
                  <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#ebeff3] sm:text-lg sm:leading-8">
                    The military leave program helps service members balance duty and family life
                    through secure, policy-aligned leave and support workflows.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <Link
                      href="/dossier?service=FLIGHT"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#edc619] px-7 py-3 text-base font-bold text-[#1b2415] transition hover:bg-[#f6d64f] sm:w-auto sm:text-lg"
                    >
                      <ListChecks className="h-5 w-5" />
                      Apply for Leave
                    </Link>
                    <Link
                      href="/dossier"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white bg-white/10 px-7 py-3 text-base font-semibold text-white transition hover:bg-white/20 sm:w-auto sm:text-lg"
                    >
                      <CircleHelp className="h-5 w-5" />
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-14 border border-[#d2d7dd] border-x-0 border-b-0 bg-[#eceef1] px-4 py-10 text-[#12284b] sm:px-8 sm:py-12 lg:px-12 lg:py-16 lg:space-y-20">
          <section>
            <h2 className="text-center font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
              Featured Video
            </h2>
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#d1d7df] bg-white shadow-xl">
              <div className="relative h-[420px] w-full sm:h-[500px] lg:h-[560px]">
                <iframe
                  src="https://www.youtube.com/embed/Rrcb36pCWD0?start=128&autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1"
                  title="Featured video player"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          </section>

          <section id="news">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
                  Latest News & Announcements
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#2e415d] sm:text-xl sm:leading-8">
                  Live U.S. military headlines aggregated from trusted sources and refreshed every
                  24 hours.
                </p>
              </div>
              <Link
                href="/news"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#edc619] px-7 py-3 text-sm font-bold text-[#1b2415] transition hover:bg-[#f6d64f] sm:w-auto sm:text-base"
              >
                <ListChecks className="h-5 w-5" />
                View All Updates
              </Link>
            </div>

            {homepageNews.length > 0 ? (
              <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
                {homepageNews.map((news) => (
                  <article
                    key={news.id}
                    className="flex h-full flex-col overflow-hidden rounded-[1.2rem] border border-[#d2d8e1] bg-white shadow-sm"
                  >
                    <div className="relative">
                      <Image
                        src={news.imageUrl}
                        alt={news.title}
                        width={720}
                        height={420}
                        className="h-36 w-full object-cover sm:h-40"
                      />
                      <div className="absolute left-4 top-4 rounded-lg bg-[#0d274b]/90 px-3 py-2 text-xs font-bold text-white sm:text-sm">
                        {formatMilitaryNewsDate(news.publishedAt)}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col space-y-3 p-4">
                      <span className="inline-block w-fit rounded-full bg-[#e8eef8] px-3 py-1 text-xs font-semibold text-[#1d3761] sm:text-sm">
                        {news.source}
                      </span>
                      <h3 className="font-display text-lg font-semibold leading-tight break-words text-[#14294b] sm:text-xl">
                        {news.title}
                      </h3>
                      <p className="line-clamp-4 text-sm leading-6 text-[#2e415d]">
                        {news.summary}
                      </p>
                      <div className="pt-1">
                        <Link
                          href={`/news/${news.id}`}
                          className="inline-flex items-center gap-2 text-sm font-bold text-[#1b355f] underline-offset-4 transition hover:text-[#2b4b7d] hover:underline"
                        >
                          Open full readable article
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-[#d2d8e1] bg-white p-6 text-sm text-[#2e415d] sm:text-base">
                Live military news is temporarily unavailable. The feed auto-refreshes every 24
                hours and will repopulate automatically.
              </div>
            )}
          </section>

          <section>
            <div className="text-center">
              <h2 className="font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
                Heartwarming Reunions
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-[#2e415d] sm:text-xl sm:leading-8">
                Witness emotional moments as service members reunite with loved ones after long
                deployments.
              </p>
            </div>

            <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
              {[
                {
                  id: "r-1",
                  title: "U.S. Army Surprise Homecoming",
                  image: "/images/hero-main.jpg",
                  videoEmbedUrl:
                    "https://www.youtube.com/embed/Rrcb36pCWD0?start=83&autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1",
                },
                {
                  id: "r-2",
                  title: "IDF Soldier's Emotional Return",
                  videoEmbedUrl:
                    "https://www.youtube.com/embed/86RXTSKxi4Y?start=48&autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1",
                },
              ].map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-[1.25rem] border border-[#d1d7df] bg-white p-4 shadow-sm"
                >
                  <h3 className="font-display text-lg font-semibold leading-tight break-words text-[#14294b] sm:text-xl lg:text-2xl">
                    {item.title}
                  </h3>
                  <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#d1d7df]">
                    {item.videoEmbedUrl ? (
                      <div className="relative h-52 w-full sm:h-56">
                        <iframe
                          src={item.videoEmbedUrl}
                          title={item.title}
                          className="h-full w-full"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      </div>
                    ) : (
                      <>
                        <Image
                          src={item.image ?? "/images/hero-main.jpg"}
                          alt={item.title}
                          width={920}
                          height={560}
                          className="h-52 w-full object-cover sm:h-56"
                        />
                        <div className="absolute inset-0 bg-black/25" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            type="button"
                            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#10284f] transition hover:scale-105"
                            aria-label={`Play video for ${item.title}`}
                          >
                            <Video className="h-6 w-6" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="about"
            className="overflow-hidden rounded-[1.6rem] border border-[#768467]/45 bg-[linear-gradient(120deg,#1f2b16_0%,#6b765e_100%)] px-6 py-8 text-white sm:px-8 lg:px-10"
          >
            <div className="mx-auto max-w-5xl text-center">
              <h2 className="font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
                A Legacy of Honor & Alliance
              </h2>
              <p className="mt-4 text-base leading-7 text-[#e9eef4] sm:text-xl sm:leading-8">
                The United States and Israel share a deep, strategic partnership rooted in common
                values and mutual respect. Their armed forces stand as pillars of strength,
                defending democracy and ensuring stability in a complex world.
              </p>
            </div>

            <div className="mt-7 grid items-stretch gap-5 lg:grid-cols-2">
              <article className="rounded-[1.15rem] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <Image
                  src="/images/us-flag.png"
                  alt="United States flag"
                  width={52}
                  height={32}
                  className="mb-2 h-8 w-14 rounded-sm border border-white/30 object-cover"
                />
                <p className="sr-only" role="img" aria-label="United States flag">
                  🇺🇸
                </p>
                <h3 className="font-display text-lg font-semibold leading-tight break-words sm:text-xl lg:text-2xl">
                  The United States Armed Forces
                </h3>
                <p className="mt-2 text-sm italic text-[#f4e6be] sm:text-base">Established: 1775</p>
                <p className="mt-4 text-sm leading-6 text-[#e7edf4] sm:text-sm sm:leading-7">
                  Forged in the American Revolution, the U.S. Armed Forces have grown into the
                  most technologically advanced military in the world. From the beaches of
                  Normandy to the mountains of Afghanistan, American service members have defended
                  freedom and projected power across the globe. The U.S. military leave program is
                  a cornerstone of its personnel support system, providing up to 30 days of annual
                  leave to ensure soldiers remain rested, resilient, and connected with their
                  families.
                </p>
              </article>
              <article className="rounded-[1.15rem] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <Image
                  src="/images/israel-flag.png"
                  alt="Israel flag"
                  width={52}
                  height={32}
                  className="mb-2 h-8 w-14 rounded-sm border border-white/30 object-cover"
                />
                <p className="sr-only" role="img" aria-label="Israel flag">
                  🇮🇱
                </p>
                <h3 className="font-display text-lg font-semibold leading-tight break-words sm:text-xl lg:text-2xl">
                  The Israel Defense Forces (IDF)
                </h3>
                <p className="mt-2 text-sm italic text-[#f4e6be] sm:text-base">Established: 1948</p>
                <p className="mt-4 text-sm leading-6 text-[#e7edf4] sm:text-sm sm:leading-7">
                  Born from the necessity to defend a new nation, the Israel Defense Forces (IDF)
                  have become renowned for their innovation, intelligence, and operational
                  excellence. Operating on the principle of a &quot;people&apos;s army,&quot; the IDF relies on
                  compulsory service, deeply embedding it within Israeli society. Leave for IDF
                  soldiers is considered a vital component of service, allowing them to return
                  home, recharge, and maintain the strong societal bonds that are crucial to the
                  nation&apos;s defense and morale.
                </p>
              </article>
            </div>
          </section>

          <section id="apply">
            <h2 className="text-center font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
              Available Support Applications
            </h2>
            <div className="mt-8 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {supportCards.map((card) => (
                <article
                  key={card.id}
                    className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[1.1rem] border border-[#cfd5de] bg-white shadow-sm sm:min-h-[360px]"
                >
                  <Image
                    src={card.image}
                    alt={card.title}
                    width={640}
                    height={400}
                    className="h-24 w-full object-cover sm:h-28"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-lg font-semibold leading-tight break-words text-[#1a355f] sm:text-xl">
                      {card.title}
                    </h3>
                    <p className="mt-2 flex-1 text-xs leading-5 text-[#2e415d] sm:text-sm sm:leading-6">
                      {card.description}
                    </p>
                    <Link
                      href={card.supportPath}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#59714b] px-4 py-2 text-xs font-bold text-[#24421d] transition hover:bg-[#edf4e6] sm:text-sm"
                    >
                      <card.icon className="h-4 w-4" />
                      {card.cta}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-[#78866d]/40 bg-[linear-gradient(120deg,#051706_0%,#122d10_40%,#0e220e_100%)] px-6 py-10 text-center sm:px-8">
            <h2 className="font-display text-3xl font-semibold leading-none text-[#f4d747] sm:text-4xl lg:text-5xl">
              Leave Application Portal
            </h2>
            <p className="mx-auto mt-4 max-w-4xl text-base leading-7 text-[#f1f5fb] sm:text-xl sm:leading-8">
              To begin a support request, verify the service member profile using their official
              Member ID in the portal.
            </p>
            <MemberIdSearchForm service="FLIGHT" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="overflow-hidden rounded-[1.25rem] border border-[#d1d7de] bg-white">
              <Image
                src="/images/hero-slide-2.jpg"
                alt="U.S. service members moving across an operations zone."
                width={920}
                height={640}
                className="h-[280px] w-full object-cover sm:h-[320px]"
              />
            </div>
            <div>
              <h2 className="font-display text-3xl font-semibold leading-none text-[#14294b] sm:text-4xl lg:text-5xl">
                Common Questions About Military Leave
              </h2>
              <div className="mt-5">
                <FaqAccordion items={faqItems} />
              </div>
            </div>
          </section>

          <footer className="overflow-hidden border border-[#78866d]/40 border-x-0 border-b-0 bg-[linear-gradient(120deg,#1f2b16_0%,#6b765e_100%)] px-6 py-12 text-white sm:px-8">
            <div className="text-center">
              <h2 className="font-display text-3xl font-semibold leading-none sm:text-4xl lg:text-5xl">
                Serving Those Who Serve Our Nation
              </h2>
              <p className="mx-auto mt-4 max-w-4xl text-base leading-7 text-[#e7edf4] sm:text-xl sm:leading-8">
                Ready to access your military benefits? Our dedicated support team is here 24/7.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/dossier?service=FLIGHT"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#edc619] px-7 py-3 text-base font-bold text-[#1b2415] transition hover:bg-[#f6d64f] sm:w-auto sm:text-lg"
                >
                  <ListChecks className="h-5 w-5" />
                  Apply for Leave
                </Link>
                <Link
                  href="/dossier"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white bg-white/10 px-7 py-3 text-base font-semibold transition hover:bg-white/20 sm:w-auto sm:text-lg"
                >
                  <Headphones className="h-5 w-5" />
                  Get Support
                </Link>
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-5xl text-center">
              <div className="inline-flex flex-col items-center gap-3 sm:flex-row">
                <div className="relative h-14 w-14 overflow-hidden rounded-full border border-[#ffde8a]/40 bg-[#0d2a6f]">
                  <Image
                    src="/images/dod-seal.png"
                    alt="Department of Defense seal"
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-display text-xl font-semibold leading-tight break-words sm:text-3xl lg:text-4xl">
                    USA Defense Military Leave Portal
                  </p>
                  <p className="mt-1 text-base text-[#e8edf4] sm:text-lg">
                    Protecting Those Who Protect America
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
              <section>
                <h3 className="inline-flex items-center gap-2 font-display text-lg font-semibold leading-tight break-words sm:text-xl">
                  <ShieldCheck className="h-5 w-5 text-[#f7d879]" />
                  About Our Mission
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#e7edf4]">
                  The Joint Military Leave Department streamlines leave processes across active
                  duty branches with high-integrity support standards.
                </p>
              </section>
              <section>
                <h3 className="font-display text-lg font-semibold leading-tight break-words sm:text-xl">
                  Our Services
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[#e7edf4]">
                  <li>Book a Flight</li>
                  <li>Purchase Call Time</li>
                  <li>Request Shopping</li>
                  <li>Support Our Troops</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-semibold leading-tight break-words sm:text-xl">
                  Quick Access
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[#e7edf4]">
                  <li>Home</li>
                  <li>About Us</li>
                  <li>News</li>
                </ul>
              </section>
              <section>
                <h3 className="font-display text-lg font-semibold leading-tight break-words sm:text-xl">
                  24/7 Support
                </h3>
                <div className="mt-3 rounded-xl bg-white/15 px-4 py-4">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Phone className="h-5 w-5 text-[#f7d879]" />
                      Phone Support
                    </p>
                    <a
                      href={SITE_CONTACT_PHONE_HREF}
                      className="mt-2 block text-sm text-[#e7edf4] transition hover:text-white"
                    >
                      {SITE_CONTACT_PHONE_DISPLAY}
                    </a>
                  </div>
                  <div className="mt-4 border-t border-white/15 pt-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Mail className="h-5 w-5 text-[#f7d879]" />
                      Email Support
                    </p>
                    <p className="mt-2 break-words text-sm text-[#e7edf4]">{SITE_CONTACT_EMAIL}</p>
                  </div>
                </div>
              </section>
            </div>
          </footer>
        </div>
      </div>

      <LanguageDock />
    </main>
  );
}
