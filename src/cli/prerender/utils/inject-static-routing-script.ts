import { escapeJsonForHtmlScript } from "./escape-json-for-html-script.js";
import { insertBeforeClosingHead } from "./insert-before-closing-head.js";

export function injectStaticRoutingScript(
  html: string,
  routingJson: string,
): string {
  const safeRoutingJson = escapeJsonForHtmlScript(routingJson);
  const scriptTag = `<script id="shadow-claw-static-routing" type="application/json">${safeRoutingJson}</script>`;
  if (/id="shadow-claw-static-routing"/iu.test(html)) {
    return html.replace(
      /<script\s+id="shadow-claw-static-routing"[\s\S]*?<\/script>/iu,
      () => scriptTag,
    );
  }

  return insertBeforeClosingHead(html, `  ${scriptTag}`);
}
