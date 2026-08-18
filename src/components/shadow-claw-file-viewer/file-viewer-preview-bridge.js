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

  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") {
      return;
    }

    if (event.data.type === "shadow-claw-theme-update") {
      if (event.data.customProperties) {
        for (var key in event.data.customProperties) {
          if (
            Object.prototype.hasOwnProperty.call(
              event.data.customProperties,
              key,
            )
          ) {
            document.documentElement.style.setProperty(
              key,
              event.data.customProperties[key],
            );
          }
        }
      }

      if (event.data.theme === "dark") {
        document.documentElement.classList.add("dark-mode");
      } else {
        document.documentElement.classList.remove("dark-mode");
      }
    }
  });

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

  function reportHeight() {
    var body = document.body;
    var docEl = document.documentElement;

    if (!body && !docEl) {
      return;
    }

    // Temporarily collapse documentElement height so that scrollHeight reflects
    // only the natural content size — not the height the parent previously
    // injected into the iframe via style.height.  Without this reset the
    // browser keeps scrollHeight equal to the externally-set height, which
    // creates a feedback loop that leaves a scrollbar on the parent at wide
    // widths (the iframe reports its own height, the parent honours it, repeat).
    var prevDocElHeight = docEl ? docEl.style.height : null;
    if (docEl) {
      docEl.style.height = "0";
    }

    var height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
    );

    if (body && body.lastElementChild) {
      try {
        var lastEl = body.lastElementChild;
        var rect = lastEl.getBoundingClientRect();
        var bodyRect = body.getBoundingClientRect();
        var lastElBottom = rect.bottom - bodyRect.top + (window.scrollY || 0);
        if (lastElBottom > height) {
          height = Math.ceil(lastElBottom);
        }
      } catch (e) {
        // Fallback if bounding rect computation fails
      }
    }

    // Restore documentElement height.
    if (docEl) {
      docEl.style.height = prevDocElHeight || "";
    }

    if (height > 0) {
      window.parent.postMessage(
        { type: "shadow-claw-iframe-resize", height: height },
        "*",
      );
    }
  }

  // Always schedule via rAF so layout is settled before measuring.
  function scheduleReportHeight() {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(reportHeight);
    } else {
      reportHeight();
    }
  }

  // First measurement: wait for DOM to be parsed.
  // If the script runs during "loading" (sync <script> in <head>) we listen
  // for DOMContentLoaded; otherwise the DOM is already ready so measure now.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleReportHeight);
  } else {
    scheduleReportHeight();
  }

  // Re-measure after all sub-resources (images, fonts, etc.) have loaded,
  // in case they affect the layout height.
  window.addEventListener("load", scheduleReportHeight);

  // Re-measure on viewport resize (e.g. window narrowed → text reflows taller).
  window.addEventListener("resize", scheduleReportHeight);

  // Ongoing: watch for dynamic content changes after initial load.
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(scheduleReportHeight);
    if (document.documentElement) {
      ro.observe(document.documentElement);
    }
    if (document.body) {
      ro.observe(document.body);
    }
  }
})();
