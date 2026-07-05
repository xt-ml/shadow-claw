/**
 * file-viewer-preview-bridge.js
 *
 * Injected into sandboxed preview iframes (file viewer + pages HTML preview)
 * via a per-render nonce. Intercepts link clicks and posts them to the parent
 * so the app can handle workspace-relative navigation.
 *
 * SECURITY: This file is served same-origin and loaded with a per-render nonce.
 * The Trusted Types policy and nonce-gated CSP prevent any other scripts from
 * running inside the sandboxed srcdoc iframe.
 */

(function () {
  "use strict";

  document.addEventListener("click", function (event) {
    // Only handle unmodified primary clicks.
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    var target = event.target;
    if (!target) {
      return;
    }

    if (target.nodeType === 3) {
      {
        // Node.TEXT_NODE;
      }

      target = target.parentNode;
    }

    if (!(target instanceof Element)) {
      return;
    }

    var link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    var href = link.getAttribute("href") || "";
    if (!href) {
      return;
    }

    // Let fragment-only same-page anchors pass through normally.
    if (
      href.startsWith("#") &&
      !href.includes("?") &&
      !href.includes("groupId")
    ) {
      return;
    }

    // External links: open in new tab (base target=_blank handles this).
    // We intercept everything that looks like it could be a workspace/app link.
    var isExternal =
      /^(?:https?|ftp|mailto|tel):\/\//i.test(href) || href.startsWith("//");

    if (isExternal) {
      return;
    }

    // All other hrefs are potentially workspace links — intercept and postMessage.
    event.preventDefault();

    window.parent.postMessage(
      { type: "shadow-claw-file-viewer-link", href: href },
      "*",
    );
  });
})();
