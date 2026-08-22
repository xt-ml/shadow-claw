import { escapeJsonForHtmlScript } from "./escape-json-for-html-script.mjs";
import { insertBeforeClosingHead } from "./insert-before-closing-head.mjs";

export function injectStaticManifestScript(html, manifestJson) {
  const safeManifestJson = escapeJsonForHtmlScript(manifestJson);
  const manifestScriptTag = `<script id="shadow-claw-static-manifest" type="application/json">${safeManifestJson}</script>`;
  const routingScriptTag = `<script id="shadow-claw-static-routing" type="application/json">{"routes":{}}</script>`;

  let resultHtml = html;

  if (/id="shadow-claw-static-manifest"/iu.test(resultHtml)) {
    resultHtml = resultHtml.replace(
      /<script\s+id="shadow-claw-static-manifest"[\s\S]*?<\/script>/iu,
      () => manifestScriptTag,
    );
  } else {
    resultHtml = insertBeforeClosingHead(resultHtml, `  ${manifestScriptTag}`);
  }

  if (!/id="shadow-claw-static-routing"/iu.test(resultHtml)) {
    resultHtml = insertBeforeClosingHead(resultHtml, `  ${routingScriptTag}`);
  }

  return resultHtml;
}
