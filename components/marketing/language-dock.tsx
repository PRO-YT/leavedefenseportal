"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, Globe2, Languages } from "lucide-react";

type TranslatorWindow = Window & {
  google?: {
    translate?: {
      TranslateElement?: {
        new (
          options: Record<string, string | number | boolean>,
          elementId: string,
        ): unknown;
        InlineLayout?: {
          SIMPLE?: number;
        };
      };
    };
  };
  __initGoogleTranslate?: () => void;
};

interface LanguageOption {
  code: string;
  name: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", name: "English" },
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "am", name: "Amharic" },
  { code: "ar", name: "Arabic" },
  { code: "hy", name: "Armenian" },
  { code: "az", name: "Azerbaijani" },
  { code: "eu", name: "Basque" },
  { code: "be", name: "Belarusian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "ceb", name: "Cebuano" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "co", name: "Corsican" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "eo", name: "Esperanto" },
  { code: "et", name: "Estonian" },
  { code: "tl", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "fy", name: "Frisian" },
  { code: "gl", name: "Galician" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "ht", name: "Haitian Creole" },
  { code: "ha", name: "Hausa" },
  { code: "haw", name: "Hawaiian" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hmn", name: "Hmong" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "ig", name: "Igbo" },
  { code: "id", name: "Indonesian" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "jw", name: "Javanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "ko", name: "Korean" },
  { code: "ku", name: "Kurdish" },
  { code: "ky", name: "Kyrgyz" },
  { code: "lo", name: "Lao" },
  { code: "la", name: "Latin" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "lb", name: "Luxembourgish" },
  { code: "mk", name: "Macedonian" },
  { code: "mg", name: "Malagasy" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mt", name: "Maltese" },
  { code: "mi", name: "Maori" },
  { code: "mr", name: "Marathi" },
  { code: "mn", name: "Mongolian" },
  { code: "my", name: "Myanmar (Burmese)" },
  { code: "ne", name: "Nepali" },
  { code: "no", name: "Norwegian" },
  { code: "or", name: "Odia" },
  { code: "ps", name: "Pashto" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pa", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sm", name: "Samoan" },
  { code: "gd", name: "Scots Gaelic" },
  { code: "sr", name: "Serbian" },
  { code: "st", name: "Sesotho" },
  { code: "sn", name: "Shona" },
  { code: "sd", name: "Sindhi" },
  { code: "si", name: "Sinhala" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "so", name: "Somali" },
  { code: "es", name: "Spanish" },
  { code: "su", name: "Sundanese" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "tg", name: "Tajik" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "ug", name: "Uyghur" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "cy", name: "Welsh" },
  { code: "xh", name: "Xhosa" },
  { code: "yi", name: "Yiddish" },
  { code: "yo", name: "Yoruba" },
  { code: "zu", name: "Zulu" },
];

const PREFERENCE_KEY = "portal_language";
const YEAR_SECONDS = 60 * 60 * 24 * 365;
const LANGUAGE_CHANGE_EVENT = "portal-language-change";

function setTranslationCookie(languageCode: string) {
  const translationTarget = `/en/${languageCode}`;
  document.cookie = `googtrans=${translationTarget};path=/;max-age=${YEAR_SECONDS}`;
  document.cookie = `googtrans=${translationTarget};domain=.${window.location.hostname};path=/;max-age=${YEAR_SECONDS}`;
}

function applyGoogleTranslate(languageCode: string) {
  const selector = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!selector) {
    return false;
  }

  selector.value = languageCode;
  selector.dispatchEvent(new Event("change"));
  return true;
}

function readStoredLanguage(): string {
  if (typeof window === "undefined") {
    return "en";
  }
  return localStorage.getItem(PREFERENCE_KEY) ?? "en";
}

function subscribeLanguagePreference(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handler);
  };
}

function getClientLanguageSnapshot() {
  return readStoredLanguage();
}

function getServerLanguageSnapshot() {
  return "en";
}

export function LanguageDock() {
  const selectedLanguage = useSyncExternalStore(
    subscribeLanguagePreference,
    getClientLanguageSnapshot,
    getServerLanguageSnapshot,
  );
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const languageCodes = useMemo(() => {
    return LANGUAGE_OPTIONS.map((language) => language.code).join(",");
  }, []);

  useEffect(() => {
    const pageWindow = window as TranslatorWindow;

    pageWindow.__initGoogleTranslate = () => {
      const translateElement = pageWindow.google?.translate?.TranslateElement;
      if (!translateElement) {
        return;
      }

      new translateElement(
        {
          pageLanguage: "en",
          autoDisplay: false,
          includedLanguages: languageCodes,
          layout: pageWindow.google?.translate?.TranslateElement?.InlineLayout?.SIMPLE ?? 0,
        },
        "google_translate_element",
      );

      setScriptLoaded(true);
      const preferredLanguage = readStoredLanguage();
      if (preferredLanguage && preferredLanguage !== "en") {
        setTranslationCookie(preferredLanguage);
        setTimeout(() => {
          applyGoogleTranslate(preferredLanguage);
        }, 300);
      }
    };

    const existingScript = document.getElementById("google-translate-script") as
      | HTMLScriptElement
      | null;
    if (existingScript) {
      if (pageWindow.google?.translate?.TranslateElement) {
        pageWindow.__initGoogleTranslate?.();
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=__initGoogleTranslate";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [languageCodes]);

  const onLanguageChange = (languageCode: string) => {
    localStorage.setItem(PREFERENCE_KEY, languageCode);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    setTranslationCookie(languageCode);

    const wasApplied = applyGoogleTranslate(languageCode);
    if (!wasApplied) {
      if (!scriptLoaded && languageCode !== "en") {
        // Fallback translation view when widget load is delayed/blocked.
        const translatedUrl = `https://translate.google.com/translate?sl=en&tl=${encodeURIComponent(
          languageCode,
        )}&u=${encodeURIComponent(window.location.href)}`;
        window.location.href = translatedUrl;
        return;
      }
      window.location.reload();
    }
  };

  const selectedLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.code === selectedLanguage)?.name ?? "English";

  return (
    <>
      <div
        id="google_translate_element"
        className="pointer-events-none absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
      />
      <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-5 sm:left-5">
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#d6dce4] bg-white/95 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#1a2f4d] shadow-xl backdrop-blur transition hover:bg-white sm:w-auto sm:justify-start"
            aria-label="Expand language dock"
          >
            <Languages className="h-4 w-4" />
            {selectedLanguageLabel}
            <ChevronUp className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-[min(92vw,340px)] rounded-2xl border border-[#d6dce4] bg-white/95 p-3 text-[#1a2f4d] shadow-xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#2e456a]">
                <Languages className="h-4 w-4" />
                Language Dock
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3fb] px-2 py-1 text-[11px] font-semibold">
                  <Globe2 className="h-3.5 w-3.5" />
                  Global
                </span>
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#d2d9e6] text-[#2e456a] transition hover:bg-[#eef3fb]"
                  aria-label="Collapse language dock"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <label htmlFor="language-selector" className="sr-only">
              Choose language
            </label>
            <div className="relative">
              <select
                id="language-selector"
                value={selectedLanguage}
                onChange={(event) => onLanguageChange(event.target.value)}
                className="w-full appearance-none rounded-xl border border-[#ced7e6] bg-white px-3 py-2.5 pr-9 text-sm font-semibold text-[#18335e] outline-none transition focus:border-[#7f98c0]"
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3d5680]" />
            </div>
            <p className="mt-2 text-[11px] leading-4 text-[#4b6287]">
              Select any language to translate the full site automatically.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
