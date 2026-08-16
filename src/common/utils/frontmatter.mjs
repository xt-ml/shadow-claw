import matter from "gray-matter";

/**
 * @typedef {{ title: string; created: string; updated: string; slug: string }} PostFrontmatter
 */

/**
 * Parse YAML frontmatter from markdown text.
 *
 * @param {string} src
 *
 * @returns {{ data: PostFrontmatter; content: string }}
 */
export function splitFrontmatter(src) {
  const parsed = matter(src);

  const data =
    parsed.data && typeof parsed.data === "object"
      ? /** @type {PostFrontmatter} */ (parsed.data)
      : /** @type {PostFrontmatter} */ ({});

  return {
    data,
    content: parsed.content || "",
  };
}

/**
 * Build the frontmatter container element using DOM APIs.
 *
 * @param {PostFrontmatter} data
 * @param {Document} documentInstance
 *
 * @returns {Element}
 */
export function createFrontmatterElement(data, documentInstance) {
  // Create the main semantic header container
  const header = documentInstance.createElement("header");
  header.setAttribute("class", "markdown-frontmatter");

  // Create and append the title
  if (data.title) {
    const titleElement = documentInstance.createElement("h1");
    titleElement.setAttribute("class", "markdown-frontmatter__title");
    titleElement.appendChild(documentInstance.createTextNode(data.title));
    header.appendChild(titleElement);
  }

  // Determine the best timestamp (prefer updated, fallback to created)
  const timestamp = data.updated || data.created;

  // Create and append the time element
  if (timestamp) {
    const timeElement = documentInstance.createElement("time");
    timeElement.setAttribute("class", "markdown-frontmatter__date");
    timeElement.setAttribute("datetime", timestamp);

    // Format the date into a human-readable string
    const dateString = new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    timeElement.appendChild(documentInstance.createTextNode(dateString));
    header.appendChild(timeElement);
  }

  return header;
}

/**
 * Build the frontmatter details container element using DOM APIs.
 *
 * @param {PostFrontmatter} data
 * @param {Document} documentInstance
 *
 * @returns {Element}
 */
export function createFrontmatterDetailsElement(data, documentInstance) {
  if (
    !documentInstance ||
    typeof documentInstance.createElement !== "function"
  ) {
    throw new Error(
      "A valid documentInstance is required to build frontmatter DOM.",
    );
  }

  const json = JSON.stringify(data, null, 2) || "{}";

  const section = documentInstance.createElement("section");
  section.setAttribute("class", "markdown-frontmatter");
  section.setAttribute("data-markdown-frontmatter", "");
  section.setAttribute("data-frontmatter", json);

  const details = documentInstance.createElement("details");
  details.setAttribute("class", "markdown-frontmatter__details");
  details.setAttribute("hidden", "hidden");

  const summary = documentInstance.createElement("summary");
  summary.setAttribute("class", "markdown-frontmatter__summary");
  summary.appendChild(documentInstance.createTextNode("Frontmatter"));

  const pre = documentInstance.createElement("pre");
  pre.setAttribute("class", "markdown-frontmatter__pre");

  const code = documentInstance.createElement("code");
  code.setAttribute("class", "language-json");
  code.appendChild(documentInstance.createTextNode(json));

  pre.appendChild(code);
  details.appendChild(summary);
  details.appendChild(pre);
  section.appendChild(details);

  return section;
}

function resolveSerializer(documentInstance, serializeNode) {
  if (typeof serializeNode === "function") {
    return serializeNode;
  }

  const serializerCtor =
    documentInstance?.defaultView?.XMLSerializer || globalThis.XMLSerializer;

  if (typeof serializerCtor === "function") {
    return (node) => new serializerCtor().serializeToString(node);
  }

  return null;
}

/**
 * Render frontmatter payload as visible HTML + machine-readable data attribute.
 *
 * @param {PostFrontmatter} data
 * @param {(data: PostFrontmatter, documentInstance: Document) => Element} frontMatterRenderer
 * @param {{ documentInstance?: Document; serializeNode?: (node: Element) => string }} [options]
 *
 * @returns {string}
 */
export function renderFrontmatterMarkup(
  data,
  frontMatterRenderer,
  options = {},
) {
  const documentInstance =
    options.documentInstance ||
    (typeof document !== "undefined" ? document : null);

  if (!documentInstance) {
    throw new Error(
      "No document instance available for frontmatter rendering.",
    );
  }

  const element = frontMatterRenderer(data, documentInstance);

  if (typeof element.outerHTML === "string") {
    return element.outerHTML;
  }

  const serializer = resolveSerializer(documentInstance, options.serializeNode);

  if (serializer) {
    return serializer(element);
  }

  throw new Error("No serializer available for frontmatter DOM element.");
}
