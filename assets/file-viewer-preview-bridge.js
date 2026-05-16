(function () {
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    var link = target.closest("a");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    var href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) {
      return;
    }

    if (/^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(href)) {
      return;
    }

    event.preventDefault();
    window.parent.postMessage(
      {
        type: "shadow-claw-file-viewer-link",
        href: href,
      },
      "*",
    );
  });
})();
