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

  // ---------------------------------------------------------------------------
  // BroadcastChannel Opaque-Origin Proxy Bridge
  // ---------------------------------------------------------------------------
  // When allow-same-origin is omitted from sandboxed preview iframes, the iframe
  // operates under a null (opaque) origin. Native BroadcastChannel instances are
  // partitioned by origin, preventing direct communication between parent/worker
  // tools and the iframe.
  //
  // This bridge wraps window.BroadcastChannel inside the iframe so that any
  // message posted by iframe scripts (e.g., tool responses) is automatically
  // relayed to the parent window via postMessage. It also listens for commands
  // posted from the parent window and re-emits them to the iframe's BroadcastChannel.
  // ---------------------------------------------------------------------------
  var isRelayingCommandFromParent = false;

  if (
    typeof BroadcastChannel !== "undefined" &&
    !window._shadowClawBcBridgeInstalled
  ) {
    window._shadowClawBcBridgeInstalled = true;
    var NativeBroadcastChannel = window.BroadcastChannel;
    var origPostMessage = NativeBroadcastChannel.prototype.postMessage;

    NativeBroadcastChannel.prototype.postMessage = function (message) {
      origPostMessage.call(this, message);
      if (isRelayingCommandFromParent) {
        return;
      }
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "shadow-claw-broadcast-result",
              channel: this.name,
              payload: message,
            },
            "*",
          );
        }
      } catch (e) {
        // Ignore postMessage transfer errors
      }
    };
  }

  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") {
      return;
    }

    if (event.data.type === "shadow-claw-broadcast-command") {
      var channelName = event.data.channel;
      var payload = event.data.payload;
      if (channelName && typeof NativeBroadcastChannel !== "undefined") {
        try {
          var bc = new NativeBroadcastChannel(channelName);
          isRelayingCommandFromParent = true;
          bc.postMessage(payload);
          isRelayingCommandFromParent = false;
          bc.close();
        } catch (e) {
          isRelayingCommandFromParent = false;
          // Ignore command relay errors
        }
      }
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

    if (event.data.type === "shadow-claw-update-url-params") {
      var searchStr = event.data.search || "";
      if (searchStr) {
        try {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + searchStr,
          );
        } catch (e) {}

        try {
          window.dispatchEvent(new Event("popstate"));
          window.dispatchEvent(new Event("locationchange"));
        } catch (e) {}

        var customEls = document.querySelectorAll("*");
        var retriggered = false;
        for (var i = 0; i < customEls.length; i++) {
          var el = customEls[i];
          if (el.tagName && el.tagName.indexOf("-") !== -1 && el.parentNode) {
            try {
              var cb = el.connectedCallback;
              var clone = el.cloneNode(true);
              if (typeof cb === "function") {
                clone.connectedCallback = cb;
              }
              el.parentNode.replaceChild(clone, el);
              if (typeof clone.connectedCallback === "function") {
                try {
                  clone.connectedCallback();
                } catch (e3) {}
              }
              retriggered = true;
            } catch (err) {
              if (typeof el.connectedCallback === "function") {
                try {
                  el.connectedCallback();
                  retriggered = true;
                } catch (e2) {}
              }
            }
          }
        }

        if (!retriggered) {
          window.location.reload();
        }
      }
      return;
    }
  });

  function isNavSuppressed(event) {
    if (!event) return false;
    var navAttributes = [
      "data-no-nav",
      "data-no-swipe",
      "data-no-page-nav",
      "data-prevent-nav",
      "data-prevent-page-nav",
      "data-isolate-input",
      "data-isolate-navigation",
      "data-game-controls",
    ];

    var path =
      typeof event.composedPath === "function" ? event.composedPath() : [];

    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (node && node.nodeType === 1) {
        var tag = (node.tagName || "").toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          tag === "option" ||
          node.isContentEditable ||
          node.getAttribute("contenteditable") === "true"
        ) {
          return true;
        }

        for (var j = 0; j < navAttributes.length; j++) {
          if (node.hasAttribute(navAttributes[j])) {
            return true;
          }
        }
      }
    }
    var target = event.target;
    if (target && target.nodeType === 3) {
      target = target.parentNode;
    }

    if (target && target instanceof Element) {
      var targetTag = (target.tagName || "").toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        targetTag === "option" ||
        target.isContentEditable ||
        target.getAttribute("contenteditable") === "true"
      ) {
        return true;
      }

      for (var k = 0; k < navAttributes.length; k++) {
        if (target.closest("[" + navAttributes[k] + "]")) {
          return true;
        }
      }
    }

    return false;
  }

  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTime = 0;

  document.addEventListener(
    "touchstart",
    function (event) {
      if (isNavSuppressed(event)) {
        touchStartX = 0;
        touchStartY = 0;
        touchStartTime = 0;
        return;
      }
      if (event.touches && event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchStartTime = Date.now();
      }
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    function (event) {
      if (!touchStartTime || isNavSuppressed(event)) {
        touchStartTime = 0;
        return;
      }
      if (event.changedTouches && event.changedTouches.length === 1) {
        var touchEndX = event.changedTouches[0].clientX;
        var touchEndY = event.changedTouches[0].clientY;
        var deltaTime = Date.now() - touchStartTime;

        var deltaX = touchEndX - touchStartX;
        var deltaY = touchEndY - touchStartY;

        if (
          Math.abs(deltaX) >= 50 &&
          Math.abs(deltaX) > Math.abs(deltaY) &&
          deltaTime <= 600
        ) {
          var direction = deltaX < 0 ? "left" : "right";
          window.parent.postMessage(
            { type: "shadow-claw-swipe", direction: direction },
            "*",
          );
        }
      }
      touchStartTime = 0;
    },
    { passive: true },
  );

  var mouseStartX = 0;
  var mouseStartY = 0;
  var mouseStartTime = 0;
  var isMouseDown = false;

  document.addEventListener(
    "mousedown",
    function (event) {
      if (event.button !== 0 || isNavSuppressed(event)) {
        isMouseDown = false;
        return;
      }
      isMouseDown = true;
      mouseStartX = event.clientX;
      mouseStartY = event.clientY;
      mouseStartTime = Date.now();
    },
    { passive: true },
  );

  document.addEventListener(
    "mouseup",
    function (event) {
      if (!isMouseDown) {
        return;
      }
      isMouseDown = false;
      if (isNavSuppressed(event)) {
        return;
      }

      var selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }

      var mouseEndX = event.clientX;
      var mouseEndY = event.clientY;
      var deltaTime = Date.now() - mouseStartTime;

      var deltaX = mouseEndX - mouseStartX;
      var deltaY = mouseEndY - mouseStartY;

      if (
        Math.abs(deltaX) >= 50 &&
        Math.abs(deltaX) > Math.abs(deltaY) &&
        deltaTime <= 600
      ) {
        var direction = deltaX < 0 ? "left" : "right";
        window.parent.postMessage(
          { type: "shadow-claw-swipe", direction: direction },
          "*",
        );
      }
    },
    { passive: true },
  );

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

    // Intercept all links so sandboxed preview iframes never navigate away from srcdoc.
    event.preventDefault();

    window.parent.postMessage(
      { type: "shadow-claw-file-viewer-link", href: href },
      "*",
    );
  });

  var lastReportedHeight = -1;

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

    if (height > 0 && Math.abs(height - lastReportedHeight) > 1) {
      lastReportedHeight = height;
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
