import { escapeJsonForHtmlScript } from "../../prerender-dsd-shell/utils/escape-json-for-html-script.mjs";
import { insertBeforeClosingHead } from "./insert-before-closing-head.mjs";

export function injectStaticRoutingScript(html, routingJson) {
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
