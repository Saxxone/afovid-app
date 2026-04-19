import { I18n } from "i18n-js";

import enSource from "@/app_directories/translations/en";
import ptOverride from "@/app_directories/translations/pt";

export type Messages = typeof enSource;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** Deep-merge `override` into a clone of `base` (for partial locale files). */
function deepMergeOverride(base: Messages, override: unknown): Messages {
  const out = deepClone(base) as Record<string, unknown>;
  if (!isRecord(override)) return out as Messages;

  function merge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ) {
    for (const key of Object.keys(source)) {
      const sv = source[key];
      const tv = target[key];
      if (isRecord(sv) && isRecord(tv)) {
        merge(tv, sv);
      } else {
        target[key] = sv;
      }
    }
  }

  merge(out, override);
  return out as Messages;
}

const en = enSource;
const pt = deepMergeOverride(enSource, ptOverride);

export const i18n = new I18n({ en, pt });

i18n.defaultLocale = "en";
i18n.enableFallback = true;

export function resolveAppLocale(
  languageCode: string | undefined | null,
): "en" | "pt" {
  const code = (languageCode ?? "en").toLowerCase();
  if (code.startsWith("pt")) return "pt";
  return "en";
}

export function syncI18nLocale(locale: "en" | "pt") {
  i18n.locale = locale;
}
