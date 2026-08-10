import { CONFIG_KEYS } from "../../../config/config.js";
import { getConfig } from "../../../db/getConfig.js";
import { stripHtml } from "../../utils/stripHtml.js";
import { wrapUntrustedContent } from "../../utils/wrapUntrustedContent.js";

import type { ShadowClawDatabase } from "../../../db/types.js";

export async function executeWebSearch(
  dbOrInput: ShadowClawDatabase | Record<string, any> | null | undefined,
  inputOrDb?: Record<string, any> | ShadowClawDatabase | null,
): Promise<string> {
  let db: ShadowClawDatabase | null = null;
  let input: Record<string, any> = {};

  if (dbOrInput && typeof dbOrInput === "object" && "query" in dbOrInput) {
    input = dbOrInput as Record<string, any>;
    db = (inputOrDb as ShadowClawDatabase) || null;
  } else {
    db = (dbOrInput as ShadowClawDatabase) || null;
    input = (inputOrDb as Record<string, any>) || {};
  }

  const { query } = input;
  if (!query) {
    return "Error: query is required.";
  }

  let useProxy = false;
  let proxyUrl = "/proxy";
  let searchUrlTemplate = "https://html.duckduckgo.com/html/?q={query}";

  if (db) {
    try {
      const rawUseProxy = await getConfig(db, CONFIG_KEYS.WEB_SEARCH_USE_PROXY);
      if (rawUseProxy !== null && rawUseProxy !== undefined) {
        const strVal = String(rawUseProxy).toLowerCase();
        useProxy = strVal === "true" || strVal === "1";
      }

      const rawProxyUrl = await getConfig(db, CONFIG_KEYS.WEB_SEARCH_PROXY_URL);
      const fallbackProxyUrl = await getConfig(db, CONFIG_KEYS.PROXY_URL);
      if (typeof rawProxyUrl === "string" && rawProxyUrl.trim().length > 0) {
        proxyUrl = rawProxyUrl.trim();
      } else if (
        typeof fallbackProxyUrl === "string" &&
        fallbackProxyUrl.trim().length > 0
      ) {
        proxyUrl = fallbackProxyUrl.trim();
      }

      const rawSearchUrl = await getConfig(db, CONFIG_KEYS.WEB_SEARCH_URL);
      if (typeof rawSearchUrl === "string" && rawSearchUrl.trim().length > 0) {
        searchUrlTemplate = rawSearchUrl.trim();
      }
    } catch (err) {
      console.warn("Failed to load web search configuration from db:", err);
    }
  }

  let targetUrl: string;
  if (searchUrlTemplate.includes("{query}")) {
    targetUrl = searchUrlTemplate.replace("{query}", encodeURIComponent(query));
  } else {
    targetUrl = searchUrlTemplate + encodeURIComponent(query);
  }

  const fetchUrl = useProxy
    ? `${proxyUrl}${proxyUrl.includes("?") ? "&" : "?"}url=${encodeURIComponent(targetUrl)}`
    : targetUrl;

  try {
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      return `Error fetching search results: ${res.status}`;
    }

    const html = await res.text();

    const results: string[] = [];
    const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
    const urlRegex = /<a class="result__url" href="([^"]+)">([^<]+)<\/a>/gi;

    let snippetMatch;
    let urlMatch;
    while (
      (snippetMatch = snippetRegex.exec(html)) &&
      (urlMatch = urlRegex.exec(html))
    ) {
      const rawUrl = urlMatch[1];
      let url = rawUrl;
      if (rawUrl.includes("//duckduckgo.com/l/?uddg=")) {
        url = decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0]);
      }

      const snippet = stripHtml(snippetMatch[1]);
      const title = stripHtml(urlMatch[2]);
      results.push(`Title: ${title}\nURL: ${url}\nSnippet: ${snippet}\n`);
      if (results.length >= 10) {
        break;
      }
    }

    if (results.length === 0) {
      return "No results found.";
    }

    // Option B: Wrap in UNTRUSTED markers so the LLM treats these externally-
    // sourced snippets as data, not instructions.
    return wrapUntrustedContent(results.join("\n---\n"), "web_search");
  } catch (e: any) {
    return `Search error: ${e.message}`;
  }
}
