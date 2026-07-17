import { stripHtml } from "../../stripHtml.js";

export async function executeWebSearch(
  input: Record<string, any>,
): Promise<string> {
  const { query } = input;
  if (!query) {
    return "Error: query is required.";
  }

  const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(targetUrl, {
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
    const urlRegex =
      /<a class="result__url" href="([^"]+)">([^<]+)<\/a>/gi;

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

    return results.join("\n---\n");
  } catch (e: any) {
    return `Search error: ${e.message}`;
  }
}
