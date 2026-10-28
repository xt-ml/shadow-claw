/**
 * Built-in dual-theme syntax highlighting and file editor styles (Atom One Dark & Atom One Light).
 * Used out-of-the-box by shadow-claw-file-viewer so standalone / single-file deployments
 * do not require network fetching or manual fetch interception.
 */
export const DEFAULT_FILE_VIEWER_HIGHLIGHT_CSS = `
pre code.hljs {
  display: block;
  overflow-x: auto;
  padding: 1em;
}
code.hljs {
  padding: 3px 5px;
}
.modal-content {
  color: var(--shadow-claw-text-primary);
}

/* ==========================================================================
   Dark Theme (Default & .dark-mode) - Atom One Dark
   ========================================================================== */
.file-editor-container {
  background-color: var(--shadow-claw-hljs-background-color, #282c34) !important;
}
.file-editor {
  caret-color: #abb2bf !important;
}
.file-editor-container pre.file-editor-overlay code,
.file-editor-container pre.file-editor-overlay code.hljs {
  background: transparent !important;
  color: #abb2bf;
}
.hljs {
  background: #282c34;
  color: #abb2bf;
}
.hljs-comment,
.hljs-quote {
  color: #5c6370;
  font-style: italic;
}
.hljs-doctag,
.hljs-formula,
.hljs-keyword {
  color: #c678dd;
}
.hljs-deletion,
.hljs-name,
.hljs-section,
.hljs-selector-tag,
.hljs-subst {
  color: #e06c75;
}
.hljs-literal {
  color: #56b6c2;
}
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string,
.hljs-regexp,
.hljs-string {
  color: #98c379;
}
.hljs-attr,
.hljs-number,
.hljs-selector-attr,
.hljs-selector-class,
.hljs-selector-pseudo,
.hljs-template-variable,
.hljs-type,
.hljs-variable {
  color: #d19a66;
}
.hljs-bullet,
.hljs-link,
.hljs-meta,
.hljs-selector-id,
.hljs-symbol,
.hljs-title {
  color: #61aeee;
}
.hljs-built_in,
.hljs-class .hljs-title,
.hljs-title.class_ {
  color: #e6c07b;
}
.hljs-emphasis {
  font-style: italic;
}
.hljs-strong {
  font-weight: 700;
}
.hljs-link {
  text-decoration: underline;
}

/* ==========================================================================
   Light Theme (.light-mode) - Atom One Light
   ========================================================================== */
:host-context(.light-mode) .file-editor-container {
  background-color: #fafafa !important;
}
:host-context(.light-mode) .file-editor {
  caret-color: #383a42 !important;
}
:host-context(.light-mode) .file-editor-container pre.file-editor-overlay code,
:host-context(.light-mode) .file-editor-container pre.file-editor-overlay code.hljs {
  background: transparent !important;
  color: #383a42;
}
:host-context(.light-mode) .hljs {
  background: #fafafa;
  color: #383a42;
}
:host-context(.light-mode) .hljs-comment,
:host-context(.light-mode) .hljs-quote {
  color: #a0a1a7;
  font-style: italic;
}
:host-context(.light-mode) .hljs-doctag,
:host-context(.light-mode) .hljs-formula,
:host-context(.light-mode) .hljs-keyword {
  color: #a626a4;
}
:host-context(.light-mode) .hljs-deletion,
:host-context(.light-mode) .hljs-name,
:host-context(.light-mode) .hljs-section,
:host-context(.light-mode) .hljs-selector-tag,
:host-context(.light-mode) .hljs-subst {
  color: #e45649;
}
:host-context(.light-mode) .hljs-literal {
  color: #0184bb;
}
:host-context(.light-mode) .hljs-addition,
:host-context(.light-mode) .hljs-attribute,
:host-context(.light-mode) .hljs-meta .hljs-string,
:host-context(.light-mode) .hljs-regexp,
:host-context(.light-mode) .hljs-string {
  color: #50a14f;
}
:host-context(.light-mode) .hljs-attr,
:host-context(.light-mode) .hljs-number,
:host-context(.light-mode) .hljs-selector-attr,
:host-context(.light-mode) .hljs-selector-class,
:host-context(.light-mode) .hljs-selector-pseudo,
:host-context(.light-mode) .hljs-template-variable,
:host-context(.light-mode) .hljs-type,
:host-context(.light-mode) .hljs-variable {
  color: #986801;
}
:host-context(.light-mode) .hljs-bullet,
:host-context(.light-mode) .hljs-link,
:host-context(.light-mode) .hljs-meta,
:host-context(.light-mode) .hljs-selector-id,
:host-context(.light-mode) .hljs-symbol,
:host-context(.light-mode) .hljs-title {
  color: #4078f2;
}
:host-context(.light-mode) .hljs-built_in,
:host-context(.light-mode) .hljs-class .hljs-title,
:host-context(.light-mode) .hljs-title.class_ {
  color: #c18401;
}
`;
