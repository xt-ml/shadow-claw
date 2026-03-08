// @ts-ignore
import JSZip from "jszip";

import { CONFIG_KEYS } from "../config.mjs";

import { exportChatData } from "../db/exportChatData.mjs";
import { getConfig } from "../db/getConfig.mjs";
import { importChatData } from "../db/importChatData.mjs";

import { effect } from "../effect.mjs";
import { renderMarkdown } from "../markdown.mjs";
import { Orchestrator } from "../orchestrator.mjs";

import { resetStorageDirectory } from "../storage/storage.mjs";

import { requestPersistentStorage } from "../storage/requestPersistentStorage.mjs";
import { getStorageEstimate } from "../storage/getStorageEstimate.mjs";
import { selectStorageDirectory } from "../storage/selectStorageDirectory.mjs";

import { isPersistent } from "../storage/isPersistent.mjs";

import { fileViewerStore } from "../stores/file-viewer.mjs";
import { orchestratorStore } from "../stores/orchestrator.mjs";
import { Themes, themeStore } from "../stores/theme.mjs";

import { formatDateForFilename, formatTimestamp } from "../utils.mjs";
import { showError, showInfo, showSuccess, showWarning } from "../toast.mjs";

import "./shadow-claw-files.mjs";
import "./shadow-claw-tasks.mjs";
import "./shadow-claw-toast.mjs";
import "../types.mjs";

/**
 * @typedef {import("../db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 * @typedef {import("../stores/file-viewer.mjs").FileInfo} FileInfo
 * @typedef {import("../stores/file-viewer.mjs").FileViewerStore} FileViewerStoreInstance
 * @typedef {import("../stores/orchestrator.mjs").OrchestratorStore} OrchestratorStoreInstance
 * @typedef {import("../stores/orchestrator.mjs").TokenUsage} TokenUsage
 * @typedef {import("../stores/orchestrator.mjs").ToolActivity} ToolActivity
 * @typedef {import("../types.mjs").LLMProvider} LLMProvider
 * @typedef {import("../types.mjs").StoredMessage} StoredMessage
 * @typedef {import("../types.mjs").ThinkingLogEntry} ThinkingLogEntry
 */

/**
 * ShadowClaw - main application component
 */
export class ShadowClaw extends HTMLElement {
  /**
   * @type {Orchestrator|null}
   */
  orchestrator = null;

  /**
   * @type {string}
   */
  currentPage = "chat";

  /**
   * Create the template with Declarative Shadow DOM
   *
   * @param {string} template - HTML template
   *
   * @returns {HTMLTemplateElement}
   */
  static createTemplate(template) {
    const tmpl = document.createElement("template");

    tmpl.innerHTML = template;

    return tmpl;
  }

  /**
   * Get the static template HTML and styles
   *
   * @returns {string}
   */
  static getTemplate() {
    return `
      <style>
        :host {
          --shadow-claw-font-mono: "Fira Code", "Courier New", monospace;
          --shadow-claw-font-sans:
            system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

          /* Softness tokens */
          --shadow-claw-radius-s: 0.5rem;
          --shadow-claw-radius-m: 0.75rem;
          --shadow-claw-radius-l: 1.25rem;
          --shadow-claw-shadow-sm:
            0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.1),
            0 0.0625rem 0.125rem rgba(0, 0, 0, 0.06);
          --shadow-claw-shadow-md:
            0 0.25rem 0.375rem -0.0625rem rgba(0, 0, 0, 0.1),
            0 0.125rem 0.25rem -0.0625rem rgba(0, 0, 0, 0.06);
          --shadow-claw-shadow-lg:
            0 0.625rem 0.9375rem -0.1875rem rgba(0, 0, 0, 0.1),
            0 0.25rem 0.375rem -0.125rem rgba(0, 0, 0, 0.05);

          /* Icon colors - Refined Premium Red */
          --shadow-claw-icon-accent-dark: #8e1d13;
          --shadow-claw-icon-bg: transparent;
          --shadow-claw-icon-body-segment: #c0392b;
          --shadow-claw-icon-body-shine: #e74c3c;
          --shadow-claw-icon-body: #922b21;
          --shadow-claw-icon-claw-inner: #922b21;
          --shadow-claw-icon-claw-main: #c0392b;
          --shadow-claw-icon-eye-shine: #ffffff;
          --shadow-claw-icon-eye: #171d1e;

          display: contents;
        }

        :host(.light-mode) {
          --shadow-claw-accent-hover: #1e293b;
          --shadow-claw-accent-primary: #334155;
          --shadow-claw-on-primary: #ffffff;
          --shadow-claw-surface-tint: #334155;
          --shadow-claw-bg-primary: #f8fafc;
          --shadow-claw-bg-secondary: #f1f5f9;
          --shadow-claw-bg-tertiary: #e2e8f0;
          --shadow-claw-border-color: #e2e8f0;
          --shadow-claw-error-color: #ba1a1a;
          --shadow-claw-link: #1e40af;
          --shadow-claw-link-hover: #1e3a8a;
          --shadow-claw-on-error: #ffffff;
          --shadow-claw-success-color: #059669;
          --shadow-claw-warning-color: #d97706;
          --shadow-claw-text-primary: #0f172a;
          --shadow-claw-text-secondary: #475569;
          --shadow-claw-text-tertiary: #64748b;
        }

        :host(.dark-mode) {
          --shadow-claw-accent-hover: #cbd5e1;
          --shadow-claw-accent-primary: #94a3b8;
          --shadow-claw-on-primary: #0f172a;
          --shadow-claw-surface-tint: #94a3b8;
          --shadow-claw-bg-primary: #0f172a;
          --shadow-claw-bg-secondary: #1e293b;
          --shadow-claw-bg-tertiary: #334155;
          --shadow-claw-border-color: #334155;
          --shadow-claw-error-color: #ffb4ab;
          --shadow-claw-link: #93c5fd;
          --shadow-claw-link-hover: #bfdbfe;
          --shadow-claw-on-error: #690005;
          --shadow-claw-success-color: #34d399;
          --shadow-claw-text-primary: #f1f5f9;
          --shadow-claw-text-secondary: #cbd5e1;
          --shadow-claw-text-tertiary: #94a3b8;

          /* Shadow adjustments for Dark Mode */
          --shadow-claw-shadow-sm: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.3);
          --shadow-claw-shadow-md: 0 0.25rem 0.375rem -0.0625rem rgba(0, 0, 0, 0.4);
          --shadow-claw-shadow-lg: 0 0.625rem 0.9375rem -0.1875rem rgba(0, 0, 0, 0.5);

          /* Icon colors - Brightened for Dark Mode */
          --shadow-claw-icon-accent-dark: #ff6b6b;
          --shadow-claw-icon-bg: transparent;
          --shadow-claw-icon-body-segment: #ff5252;
          --shadow-claw-icon-body-shine: rgba(255, 255, 255, 0.3);
          --shadow-claw-icon-body: #ff1744;
          --shadow-claw-icon-claw-inner: #ff1744;
          --shadow-claw-icon-claw-main: #ff5252;
          --shadow-claw-icon-eye-shine: #171d1e;
          --shadow-claw-icon-eye: #dee3e5;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        a {
          color: var(--shadow-claw-link);
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        a:hover {
          color: var(--shadow-claw-link-hover);
        }

        /* Links inside user message bubbles sit on a dark accent background —
                  always render them as white so they're readable in both themes. */
        .message.user .message-content a,
        .message.user .message-content a:visited {
          color: #ffffff;
          opacity: 0.9;
          text-decoration: underline;
          text-underline-offset: 0.125rem;
        }

        .message.user .message-content a:hover {
          color: #ffffff;
          opacity: 1;
        }

        .header {
          align-items: center;
          background-color: var(--shadow-claw-bg-secondary);
          border-bottom: 0.0625rem solid var(--shadow-claw-bg-tertiary);
          display: flex;
          gap: 1rem;
          height: 4rem;
          justify-content: flex-start;
          max-height: 4rem;
          padding: 0.5rem 1rem;
          width: 100%;
        }

        .header h1 {
          align-items: start;
          color: var(--shadow-claw-text-primary);
          display: flex;
          flex-direction: row;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
          width: 100%;
        }

        #menu-button {
          align-items: center;
          background: transparent;
          border-radius: 0.25rem;
          border: none;
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          display: flex;
          justify-content: center;
          padding: 0.5rem;
        }

        #menu-button:hover,
        .theme-toggle:hover {
          background-color: var(--shadow-claw-bg-tertiary);
          color: var(--shadow-claw-text-primary);
        }

        .logo {
          height: 2.25rem;
          width: 1.5rem;
        }

        .header-title-link,
        .header-title-link:hover {
          color: var(--shadow-claw-text-primary);
          display: flex;
          text-decoration: none;
        }

        .header-title {
          align-items: center;
          display: flex;
          height: 2.5rem;
          margin-left: 0.5rem;
        }

        .header-actions {
          align-items: center;
          display: flex;
          gap: 0.5rem;
          margin-left: auto;
        }

        .theme-toggle {
          align-items: center;
          background: transparent;
          border-radius: 0.25rem;
          border: none;
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          display: flex;
          justify-content: center;
          padding: 0.5rem;
        }

        .github-link {
          align-items: center;
          color: inherit;
          display: flex;
          flex-direction: row;
          height: 2.5rem;
          justify-content: start;
        }

        .github-link svg {
          height: 1.5rem;
          width: 1.5rem;
        }

        .app {
          background-color: var(--shadow-claw-bg-primary);
          color: var(--shadow-claw-text-primary);
          display: flex;
          flex-direction: column;
          font-family: var(--shadow-claw-font-sans);
          height: 100dvh;
          height: 100vh;
          width: 100%;
        }

        .app-body {
          display: flex;
          flex-direction: row;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          background-color: var(--shadow-claw-bg-secondary);
          border-right: 0.0625rem solid var(--shadow-claw-bg-tertiary);
          display: flex;
          flex-direction: column;
          flex: none;
          overflow-y: auto;
          width: 15.625rem;
        }

        @media (max-width: 47.9375rem) {
          .sidebar {
            display: none;
          }
          .sidebar.open {
            border-radius: 0 var(--shadow-claw-radius-m) var(--shadow-claw-radius-m) 0;
            box-shadow: var(--shadow-claw-shadow-lg);
            display: flex;
            height: calc(100dvh - 4rem);
            height: calc(100vh - 4rem);
            position: absolute;
            z-index: 100;
          }
        }

        @media (min-width: 48rem) {
          #menu-button {
            display: none;
          }
        }

        .sidebar-header {
          display: none;
        }

        .sidebar-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
          display: flex;
          font-size: 1.125rem;
          font-weight: 600;
          gap: 0.5rem;
          padding: 1rem;
        }

        .nav-menu {
          flex: 1;
          list-style: none;
          padding: 0.5rem;
        }

        .nav-item {
          border-radius: var(--shadow-claw-radius-m);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
          padding: 0.625rem 0.75rem;
          transition:
            background-color 0.15s,
            color 0.15s;
        }

        .nav-item:hover {
          background-color: var(--shadow-claw-bg-tertiary);
          color: var(--shadow-claw-text-primary);
        }

        .nav-item.active {
          background-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-on-primary);
        }

        .sidebar-footer {
          border-top: 0.0625rem solid var(--shadow-claw-border-color);
          margin-top: auto;
          padding: 0.5rem;
        }

        .settings-btn {
          background-color: transparent;
          border-radius: 0.375rem;
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.8125rem;
          padding: 0.625rem 0.75rem;
          transition: all 0.15s;
          width: 100%;
        }

        .settings-btn:hover {
          background-color: var(--shadow-claw-bg-tertiary);
          border-color: var(--shadow-claw-accent-primary);
          color: var(--shadow-claw-text-primary);
        }

        .main-content {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .page {
          display: flex;
          display: none;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
        }

        .page.active {
          display: flex;
        }

        .chat-page {
          flex-direction: column;
        }

        .chat-header, .settings-header {
          align-items: center;
          background-color: var(--shadow-claw-bg-primary);
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
          display: flex;
          justify-content: space-between;
          padding: 1rem;
        }

        .chat-header h2, .settings-header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
        }

        .chat-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 0.75rem;
          overflow: hidden;
          padding: 1rem;
        }

        .messages-container {
          background-color: var(--shadow-claw-bg-secondary);
          border-radius: var(--shadow-claw-radius-l);
          border: 0.0625rem solid var(--shadow-claw-bg-tertiary);
          box-shadow: inset var(--shadow-claw-shadow-sm);
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .message {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .message-sender {
          color: var(--shadow-claw-text-tertiary);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.03125rem;
          text-transform: uppercase;
        }

        .message-header {
          align-items: baseline;
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.125rem;
        }

        .message-timestamp {
          color: var(--shadow-claw-text-tertiary);
          font-size: 0.625rem;
          font-weight: 400;
        }

        .message-content {
          background-color: var(--shadow-claw-bg-primary);
          border-left: 0.25rem solid var(--shadow-claw-accent-primary);
          border-radius: 0.25rem var(--shadow-claw-radius-m) var(--shadow-claw-radius-m)
            0.25rem;
          border-radius: var(--shadow-claw-radius-m);
          font-size: 0.875rem;
          line-height: 1.5;
          padding: 0.75rem 1rem;
          word-wrap: break-word;
        }

        .message.user .message-content {
          background-color: var(--shadow-claw-accent-primary);
          border-left-color: var(--shadow-claw-accent-hover);
          color: var(--shadow-claw-on-primary);
        }

        .message-content p {
          margin-bottom: 0.5rem;
        }

        .message-content p:last-child {
          margin-bottom: 0;
        }

        .message-content pre {
          background: var(--shadow-claw-bg-secondary);
          border-radius: var(--shadow-claw-radius-m);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          margin: 0.75rem 0;
          overflow-x: auto;
          padding: 0;
        }

        .message-content pre code.hljs {
          background-color: transparent;
          border-radius: 0.375rem;
          color: var(--shadow-claw-text-primary);
          display: block;
          font-size: 0.8125rem;
          line-height: 1.6;
          margin: 0;
          padding: 0.75rem;
        }

        .message-content code {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.1875rem;
          color: var(--shadow-claw-text-primary);
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          padding: 0.125rem 0.375rem;
        }

        .message-content code.hljs {
          background: transparent;
          color: var(--shadow-claw-text-primary);
          padding: 0;
        }

        .message-content ul,
        .message-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .message-content ul:last-child,
        .message-content ol:last-child {
          margin-bottom: 0;
        }

        .message-content li {
          margin-bottom: 0.25rem;
        }

        .message-content li:last-child {
          margin-bottom: 0;
        }

        .message-content li input[type="checkbox"] {
          accent-color: var(--shadow-claw-accent-primary);
          cursor: pointer;
          margin-right: 0.5rem;
          vertical-align: middle;
        }

        .message-content blockquote {
          border-left: 0.25rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          font-style: italic;
          margin: 0.5rem 0;
          padding-left: 0.75rem;
        }

        .message-content hr {
          border: 0;
          border-top: 0.0625rem solid var(--shadow-claw-border-color);
          margin: 0.75rem 0;
        }

        .tool-activity {
          align-items: center;
          color: var(--shadow-claw-accent-primary);
          display: none;
          font-size: 0.75rem;
          font-style: italic;
          gap: 0.375rem;
          padding: 0.25rem 0.75rem;
        }

        .tool-activity.active {
          display: flex;
        }

        .activity-log {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.25rem;
          color: var(--shadow-claw-text-tertiary);
          display: none;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.6875rem;
          margin-bottom: 0.5rem;
          max-height: 6.25rem;
          overflow-y: auto;
          padding: 0.5rem 0.75rem;
        }

        .activity-log.active {
          display: block;
        }

        .file-viewer-modal {
          align-items: center;
          background-color: rgba(0, 0, 0, 0.5);
          display: none;
          height: 100%;
          justify-content: center;
          left: 0;
          position: fixed;
          top: 0;
          width: 100%;
          z-index: 1000;
        }

        .file-viewer-modal.active {
          display: flex;
        }

        .modal-content {
          background-color: var(--shadow-claw-bg-primary);
          border-radius: var(--shadow-claw-radius-l);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          box-shadow: var(--shadow-claw-shadow-lg);
          display: flex;
          flex-direction: column;
          height: 80%;
          width: 80%;
        }

        .modal-header {
          align-items: center;
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
        }

        .modal-body {
          flex: 1;
          overflow: auto;
          padding: 1rem;
        }

        .modal-body pre {
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .close-modal-btn {
          background: transparent;
          border: none;
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 1.25rem;
        }

        .chat-input-area {
          align-items: flex-end;
          display: flex;
          gap: 0.5rem;
        }

        .chat-input-wrapper {
          background-color: var(--shadow-claw-bg-primary);
          border-radius: var(--shadow-claw-radius-l);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          box-shadow: var(--shadow-claw-shadow-sm);
          display: flex;
          flex: 1;
          transition: all 0.15s;
        }

        .chat-input-wrapper:focus-within {
          border-color: var(--shadow-claw-accent-primary);
          box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
        }

        .chat-input {
          background: transparent;
          border: none;
          color: var(--shadow-claw-text-primary);
          flex: 1;
          font-family: var(--shadow-claw-font-sans);
          font-size: 0.875rem;
          max-height: 6.25rem;
          padding: 0.625rem 0.75rem;
          resize: none;
        }

        .chat-input::placeholder {
          color: var(--shadow-claw-text-tertiary);
        }

        .chat-input:focus {
          outline: none;
        }

        .send-btn {
          background-color: var(--shadow-claw-accent-primary);
          border-radius: var(--shadow-claw-radius-l);
          border: none;
          color: var(--shadow-claw-on-primary);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.625rem 1.25rem;
          transition: background-color 0.15s;
          white-space: nowrap;
        }

        .send-btn:hover {
          background-color: var(--shadow-claw-accent-hover);
        }

        .send-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .settings-page {
          overflow-y: auto;
          padding: 1rem;
        }

        .settings-section {
          margin-bottom: 1.5rem;
        }

        .settings-section h3 {
          align-items: center;
          display: flex;
          font-size: 1rem;
          font-weight: 600;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .settings-warning {
          background-color: #fee2e2;
          border-radius: 0.375rem;
          border: 0.0625rem solid #fecaca;
          color: #991b1b;
          display: none;
          font-size: 0.8125rem;
          margin-bottom: 1rem;
          padding: 0.75rem;
        }

        .settings-warning b {
          font-weight: 700;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .radio-item {
          align-items: flex-start;
          cursor: pointer;
          display: flex;
          gap: 0.625rem;
        }

        .radio-item input {
          margin-top: 0.1875rem;
        }

        .radio-label-text {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .radio-label-title {
          color: var(--shadow-claw-text-primary);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .radio-label-desc {
          color: var(--shadow-claw-text-secondary);
          font-size: 0.75rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-label {
          color: var(--shadow-claw-text-primary);
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          margin-bottom: 0.375rem;
        }

        .form-input,
        .form-select {
          background-color: var(--shadow-claw-bg-primary);
          border-radius: 0.375rem;
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-primary);
          font-family: var(--shadow-claw-font-sans);
          font-size: 0.875rem;
          padding: 0.625rem 0.75rem;
          transition: border-color 0.15s;
          width: 100%;
        }

        .form-input:focus,
        .form-select:focus {
          border-color: var(--shadow-claw-accent-primary);
          box-shadow: 0 0 0 0.125rem rgba(59, 130, 246, 0.1);
          outline: none;
        }

        .form-helper {
          color: var(--shadow-claw-text-tertiary);
          font-size: 0.75rem;
          margin-top: 0.25rem;
        }

        .save-btn {
          background-color: var(--shadow-claw-success-color);
          border-radius: 0.375rem;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 0.625rem 1.5rem;
          transition: background-color 0.15s;
        }

        .save-btn:hover {
          background-color: #059669;
        }

        .empty-state {
          align-items: center;
          color: var(--shadow-claw-text-tertiary);
          display: flex;
          flex: 1;
          justify-content: center;
          text-align: center;
        }

        .empty-state p {
          font-size: 0.875rem;
        }

        ::-webkit-scrollbar {
          height: 0.5rem;
          width: 0.5rem;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: var(--shadow-claw-border-color);
          border-radius: 0.25rem;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: var(--shadow-claw-text-tertiary);
        }

        /* Utility classes refactored from inline styles */
        .hidden {
          display: none;
        }

        .chat-status-bar {
          align-items: center;
          color: var(--shadow-claw-text-tertiary);
          display: flex;
          font-size: 0.75rem;
          gap: 0.5rem;
        }

        .chat-action-btn {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.25rem;
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          transition: all 0.15s;
        }

        .ml-auto {
          margin-left: auto;
        }

        .storage-header {
          display: flex;
          font-size: 0.8125rem;
          justify-content: space-between;
          margin-bottom: 0.375rem;
        }

        .opacity-60 {
          opacity: 0.6;
        }

        .storage-progress-container {
          background-color: var(--shadow-claw-bg-tertiary);
          border-radius: 0.25rem;
          height: 0.5rem;
          margin-bottom: 0.75rem;
          overflow: hidden;
          width: 100%;
        }

        .storage-progress-bar {
          background-color: var(--shadow-claw-accent-primary);
          height: 100%;
          transition: width 0.3s;
          width: 0%;
        }

        .storage-info-row {
          align-items: center;
          display: flex;
          font-size: 0.875rem;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .storage-badge {
          border-radius: 0.25rem;
          display: none;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.125rem 0.375rem;
        }

        .persistent-badge {
          background-color: var(--shadow-claw-success-color);
          border-radius: 0.25rem;
          color: white;
          display: none;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.125rem 0.375rem;
        }

        .storage-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .w-auto {
          width: auto;
        }

        .grant-storage-btn {
          background-color: var(--shadow-claw-accent-primary);
          border-color: var(--shadow-claw-accent-primary);
          color: white;
        }

        .reset-storage-btn {
          border-color: var(--shadow-claw-error-color);
          color: var(--shadow-claw-error-color);
        }
      </style>

      <div class="app">
        <!-- Header -->
        <header class="header">
          <button id="menu-button" aria-label="Open menu">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="1.5rem"
              height="1.5rem"
              fill="currentColor"
              viewBox="0 -960 960 960"
            >
              <path d="M120-680v-80h720v80zm0 480v-80h720v80zm0-240v-80h720v80z" />
            </svg>
          </button>
          <h1>
            <a class="header-title-link" href="https://xt-ml.github.io/shadow-claw/">
              <svg
                class="logo"
                viewBox="0 0 128 128"
                xmlns="http://www.w3.org/2000/svg"
              >
                <!-- Background -->
                <rect
                  width="128"
                  height="128"
                  rx="16"
                  fill="var(--shadow-claw-icon-bg)"
                />

                <!-- Tail Fan -->
                <ellipse
                  cx="64"
                  cy="108"
                  rx="18"
                  ry="12"
                  fill="var(--shadow-claw-icon-body)"
                />
                <ellipse
                  cx="52"
                  cy="112"
                  rx="8"
                  ry="10"
                  fill="var(--shadow-claw-icon-accent-dark)"
                />
                <ellipse
                  cx="76"
                  cy="112"
                  rx="8"
                  ry="10"
                  fill="var(--shadow-claw-icon-accent-dark)"
                />

                <!-- Tail Segments -->
                <ellipse
                  cx="64"
                  cy="92"
                  rx="14"
                  ry="8"
                  fill="var(--shadow-claw-icon-body-segment)"
                />
                <ellipse
                  cx="64"
                  cy="82"
                  rx="12"
                  ry="7"
                  fill="var(--shadow-claw-icon-body)"
                />
                <ellipse
                  cx="64"
                  cy="74"
                  rx="10"
                  ry="6"
                  fill="var(--shadow-claw-icon-body-segment)"
                />

                <!-- Main Body -->
                <ellipse
                  cx="64"
                  cy="58"
                  rx="20"
                  ry="18"
                  fill="var(--shadow-claw-icon-body)"
                />

                <!-- Body Segments -->
                <ellipse
                  cx="64"
                  cy="50"
                  rx="16"
                  ry="10"
                  fill="var(--shadow-claw-icon-body-segment)"
                />

                <!-- Left Claw Arm -->
                <rect
                  x="28"
                  y="45"
                  width="18"
                  height="8"
                  rx="4"
                  fill="var(--shadow-claw-icon-body)"
                  transform="rotate(-20 37 49)"
                />

                <!-- Left Claw -->
                <ellipse
                  cx="20"
                  cy="38"
                  rx="14"
                  ry="10"
                  fill="var(--shadow-claw-icon-claw-main)"
                />
                <ellipse
                  cx="16"
                  cy="36"
                  rx="10"
                  ry="7"
                  fill="var(--shadow-claw-icon-claw-inner)"
                />
                <ellipse
                  cx="12"
                  cy="34"
                  rx="5"
                  ry="4"
                  fill="var(--shadow-claw-icon-accent-dark)"
                />

                <!-- Right Claw Arm -->
                <rect
                  x="82"
                  y="45"
                  width="18"
                  height="8"
                  rx="4"
                  fill="var(--shadow-claw-icon-body)"
                  transform="rotate(20 91 49)"
                />

                <!-- Right Claw -->
                <ellipse
                  cx="108"
                  cy="38"
                  rx="14"
                  ry="10"
                  fill="var(--shadow-claw-icon-claw-main)"
                />
                <ellipse
                  cx="112"
                  cy="36"
                  rx="10"
                  ry="7"
                  fill="var(--shadow-claw-icon-claw-inner)"
                />
                <ellipse
                  cx="116"
                  cy="34"
                  rx="5"
                  ry="4"
                  fill="var(--shadow-claw-icon-accent-dark)"
                />

                <!-- Legs - Left -->
                <rect
                  x="38"
                  y="62"
                  width="12"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(-30 44 64)"
                />
                <rect
                  x="36"
                  y="68"
                  width="14"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(-25 43 70)"
                />
                <rect
                  x="38"
                  y="74"
                  width="12"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(-20 44 76)"
                />

                <!-- Legs - Right -->
                <rect
                  x="78"
                  y="62"
                  width="12"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(30 84 64)"
                />
                <rect
                  x="78"
                  y="68"
                  width="14"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(25 85 70)"
                />
                <rect
                  x="78"
                  y="74"
                  width="12"
                  height="4"
                  rx="2"
                  fill="var(--shadow-claw-icon-accent-dark)"
                  transform="rotate(20 84 76)"
                />

                <!-- Head -->
                <ellipse
                  cx="64"
                  cy="38"
                  rx="14"
                  ry="12"
                  fill="var(--shadow-claw-icon-body)"
                />

                <!-- Eyes (Adjusted for Neutral/Happy expression) -->
                <!-- Eyes lowered slightly and made simpler/kinder -->
                <circle cx="56" cy="34" r="5" fill="var(--shadow-claw-icon-eye)" />
                <circle cx="72" cy="34" r="5" fill="var(--shadow-claw-icon-eye)" />
                <!-- Shine centered to look friendly -->
                <circle
                  cx="56"
                  cy="33"
                  r="2"
                  fill="var(--shadow-claw-icon-eye-shine)"
                />
                <circle
                  cx="72"
                  cy="33"
                  r="2"
                  fill="var(--shadow-claw-icon-eye-shine)"
                />

                <!-- Mouth (New: Small smile for happiness) -->
                <path
                  d="M60 42 Q64 46 68 42"
                  stroke="var(--shadow-claw-icon-accent-dark)"
                  stroke-width="2"
                  fill="none"
                  stroke-linecap="round"
                />

                <!-- Antennae -->
                <path
                  d="M58 26 Q50 14 42 8"
                  stroke="var(--shadow-claw-icon-accent-dark)"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                />
                <path
                  d="M70 26 Q78 14 86 8"
                  stroke="var(--shadow-claw-icon-accent-dark)"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                />
                <path
                  d="M60 24 Q54 16 50 10"
                  stroke="var(--shadow-claw-icon-body)"
                  stroke-width="2"
                  fill="none"
                  stroke-linecap="round"
                />
                <path
                  d="M68 24 Q74 16 78 10"
                  stroke="var(--shadow-claw-icon-body)"
                  stroke-width="2"
                  fill="none"
                  stroke-linecap="round"
                />

                <!-- Highlight on body -->
                <ellipse
                  cx="60"
                  cy="55"
                  rx="6"
                  ry="8"
                  fill="var(--shadow-claw-icon-body-shine)"
                  opacity="0.4"
                />
              </svg>
              <span class="header-title">ShadowClaw</span>
            </a>
            <div class="header-actions">
              <button class="theme-toggle" aria-label="Toggle theme">
                <svg
                  class="sun-icon hidden"
                  xmlns="http://www.w3.org/2000/svg"
                  width="1.5rem"
                  height="1.5rem"
                  fill="currentColor"
                  viewBox="0 -960 960 960"
                >
                  <path
                    d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280zM200-440H40v-80h160v80zm720 0H760v-80h160v80zM440-760v-160h80v160h-80zm0 720v-160h80v160h-80zM256-650l-101-97 57-59 96 100-52 56zm492 496-97-101 53-55 101 97-57 59zm-98-550 97-101 59 57-101 97-55-53zM158-190l97-101 55 53-101 97-51-49z"
                  />
                </svg>
                <svg
                  class="moon-icon hidden"
                  xmlns="http://www.w3.org/2000/svg"
                  width="1.5rem"
                  height="1.5rem"
                  fill="currentColor"
                  viewBox="0 -960 960 960"
                >
                  <path
                    d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q52 0 99-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-74 30-122.5 100T204-480q0 116 82 198t194 82zm-12-274z"
                  />
                </svg>
              </button>
              <a
                aria-label="Github"
                class="github-link"
                href="https://github.com/xt-ml/shadow-claw"
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 496 512"
                >
                  <path
                    fill="currentColor"
                    d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8z"
                  ></path>
                </svg>
              </a>
            </div>
          </h1>
        </header>

        <!-- Main Body -->
        <div class="app-body">
          <!-- Sidebar -->
          <aside class="sidebar">
            <nav class="nav-menu">
              <li class="nav-item active" data-page="chat">💬 Chat</li>
              <li class="nav-item" data-page="tasks">✓ Tasks</li>
              <li class="nav-item" data-page="files">📁 Files</li>
            </nav>
            <div class="sidebar-footer">
              <button class="settings-btn" data-action="show-settings">
                ⚙️ Settings
              </button>
            </div>
          </aside>

          <!-- Main Content -->
          <div class="main-content">
            <!-- Chat Page -->
            <div class="page chat-page active" data-page-id="chat">
              <div class="chat-header">
                <h2>💬 Chat</h2>
                <div class="chat-status-bar">
                  <span class="status-indicator">●</span> Ready
                  <button class="chat-action-btn ml-auto" data-action="download-chat">
                    💾 Backup
                  </button>
                  <button class="chat-action-btn" data-action="restore-chat">
                    ♻️ Restore
                  </button>
                  <button class="chat-action-btn" data-action="compact-chat">
                    📦 Compact
                  </button>
                  <button class="chat-action-btn" data-action="clear-chat">
                    🗑️ Clear Chat
                  </button>
                </div>
              </div>
              <div class="chat-body">
                <div class="tool-activity">⚙️ Working...</div>
                <div class="activity-log"></div>
                <div class="messages-container"></div>
                <div class="chat-input-area">
                  <div class="chat-input-wrapper">
                    <textarea
                      class="chat-input"
                      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                      rows="1"
                    ></textarea>
                  </div>
                  <button class="send-btn" data-action="send-message">Send</button>
                </div>
              </div>
            </div>

            <!-- Tasks Page -->
            <div class="page" data-page-id="tasks">
              <shadow-claw-tasks></shadow-claw-tasks>
            </div>

            <!-- Files Page -->
            <div class="page" data-page-id="files">
              <shadow-claw-files></shadow-claw-files>
            </div>

            <!-- File Viewer Modal Overlay -->
            <div class="file-viewer-modal">
              <div class="modal-content">
                <div class="modal-header">
                  <h3 class="modal-title">File: name.txt</h3>
                  <button class="close-modal-btn">&times;</button>
                </div>
                <div class="modal-body">
                  <pre class="file-content"></pre>
                </div>
              </div>
            </div>

            <!-- Settings Page -->
            <div class="page" data-page-id="settings">
              <div class="settings-header"><h2>⚙️ Settings</h2></div>
              <div class="settings-page">
                <div class="settings-section">
                  <h3>👤 Assistant Name</h3>
                  <div class="form-group">
                    <label class="form-label">Name</label>
                    <input
                      class="form-input"
                      data-setting="assistant-name-input"
                      placeholder="rover"
                      type="text"
                      value="rover"
                    />
                    <div class="form-helper">
                      Used to mention the assistant in chat (@name)
                    </div>
                  </div>
                  <button class="save-btn" data-action="save-assistant-name">
                    💾 Save Name
                  </button>
                </div>

                <div class="settings-section">
                  <h3>🔑 LLM Provider</h3>
                  <div class="form-group">
                    <label class="form-label">Provider</label>
                    <select class="form-select" data-setting="provider-select">
                      <!-- Populated dynamically -->
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">API Key</label>
                    <input
                      type="password"
                      class="form-input"
                      data-setting="api-key-input"
                      placeholder="Enter your API key..."
                    />
                    <div class="form-helper" data-setting="api-key-helper">
                      Your API key is encrypted and stored locally. It never leaves
                      your browser.
                    </div>
                  </div>
                  <button class="save-btn" data-action="save-api-key">
                    💾 Save API Key & Provider
                  </button>
                </div>

                <div class="settings-section">
                  <h3>🤖 Model</h3>
                  <div class="form-group">
                    <label class="form-label">Select Model</label>
                    <select class="form-select" data-setting="model-select">
                      <!-- Populated dynamically based on provider -->
                    </select>
                  </div>
                  <button class="save-btn" data-action="save-model">
                    💾 Save Model
                  </button>
                </div>

                <div class="settings-section">
                  <h3>🔀 Git</h3>
                  <div class="form-group">
                    <label class="form-label">CORS Proxy</label>
                    <div class="radio-group">
                      <label class="radio-item">
                        <input
                          type="radio"
                          name="git-proxy"
                          value="local"
                          checked
                          data-setting="git-proxy-local"
                        />
                        <div class="radio-label-text">
                          <span class="radio-label-title"
                            >Local Proxy (Recommended)</span
                          >
                          <span class="radio-label-desc"
                            >Uses your local server. Secure and private.</span
                          >
                        </div>
                      </label>
                      <label class="radio-item">
                        <input
                          type="radio"
                          name="git-proxy"
                          value="public"
                          data-setting="git-proxy-public"
                        />
                        <div class="radio-label-text">
                          <span class="radio-label-title">Public Proxy</span>
                          <span class="radio-label-desc"
                            >Uses cors.isomorphic-git.org. Potential credential leak
                            risk.</span
                          >
                        </div>
                      </label>
                    </div>
                    <div class="settings-warning" data-setting="git-proxy-warning">
                      ⚠️ <b>Security Warning</b>: You have a Git Token configured and
                      are using the Public Proxy. Your token will pass through a
                      third-party server.
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Git Token (PAT)</label>
                    <input
                      type="password"
                      class="form-input"
                      data-setting="git-token-input"
                      placeholder="ghp_xxxxxxxxxxxx"
                    />
                    <div class="form-helper">
                      Optional. Required for push or private repos. Stored encrypted
                      locally.
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Author Name</label>
                    <input
                      type="text"
                      class="form-input"
                      data-setting="git-author-name-input"
                      placeholder="ShadowClaw"
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label">Author Email</label>
                    <input
                      type="text"
                      class="form-input"
                      data-setting="git-author-email-input"
                      placeholder="k9@shadowclaw.local"
                    />
                  </div>

                  <button class="save-btn" data-action="save-git-settings">
                    💾 Save Git Settings
                  </button>
                </div>

                <div class="settings-section">
                  <h3>💾 Storage</h3>
                  <div class="form-group">
                    <div class="storage-header">
                      <span data-info="storage-usage">0 B used</span>
                      <span data-info="storage-quota" class="opacity-60">of 0 B</span>
                    </div>
                    <div class="storage-progress-container">
                      <div
                        data-info="storage-progress"
                        class="storage-progress-bar"
                      ></div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">Storage Type</label>
                    <div class="storage-info-row">
                      <span data-info="storage-type">Browser Internal (OPFS)</span>
                      <span
                        data-info="storage-status-badge"
                        class="storage-badge"
                      ></span>
                      <span
                        data-info="storage-persistent-badge"
                        class="persistent-badge"
                        >PERSISTENT</span
                      >
                    </div>
                    <div class="storage-buttons">
                      <button
                        class="settings-btn w-auto hidden grant-storage-btn"
                        data-action="grant-storage-permission"
                      >
                        🔓 Grant Permission
                      </button>
                      <button
                        class="settings-btn w-auto"
                        data-action="request-persistent"
                      >
                        🔒 Request Persistent
                      </button>
                      <button
                        class="settings-btn w-auto"
                        data-action="change-storage-dir"
                      >
                        📁 Change Location
                      </button>
                      <button
                        class="settings-btn w-auto reset-storage-btn"
                        data-action="reset-storage-dir"
                      >
                        ♻️ Reset to Default
                      </button>
                    </div>
                    <div class="form-helper" data-info="storage-help-general">
                      Persistent storage prevents the browser from deleting your chat
                      history and configuration when disk space is low.
                      <b>Note:</b> Browsers often only grant this if you bookmark the
                      site or use it frequently.
                    </div>
                    <div class="form-helper" data-info="storage-help-local">
                      You can use a local folder on your computer for storage. This
                      makes files directly accessible on your disk.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <shadow-claw-toast></shadow-claw-toast>
          </div>
        </div>
      </div>
    `;
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    /** @type {'idle'|'thinking'|'responding'|'error'} */
    this.previousOrchestratorState = "idle";
    /** @type {string|null} */
    this.lastErrorToast = null;
  }

  async connectedCallback() {
    // apply highlight.js atom-one-dark.min.css to shadow dom
    const cssText = await (
      await fetch(
        "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css",
      )
    ).text();

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);

    if (this.shadowRoot?.adoptedStyleSheets) {
      this.shadowRoot.adoptedStyleSheets.push(sheet);
    }
  }

  /**
   * Initialize the component with an orchestrator
   *
   * @param {ShadowClawDatabase} db
   * @param {Orchestrator} orchestrator
   *
   * @returns {Promise<void>}
   */
  async initialize(db, orchestrator) {
    this.orchestrator = orchestrator;
    this.db = db;

    // Render the shadow DOM
    const template = ShadowClaw.createTemplate(ShadowClaw.getTemplate());
    if (this.shadowRoot) {
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    // Bind event listeners
    this.bindEventListeners(db);

    // Load initial settings
    await this.loadSettings(db);

    // Initialize the orchestratorStore
    await orchestratorStore.init(db, orchestrator);

    // React to store changes using effect()
    this.setupEffects();

    // Update status indicator color
    if (this.shadowRoot) {
      const statusEl = this.shadowRoot.querySelector(".status-indicator");
      if (statusEl) {
        const el = /** @type {HTMLElement} */ (statusEl);
        el.style.color = "#10b981";
      }
    }

    console.log("ShadowClaw UI initialized");
  }

  /**
   * Bind all event listeners to the component
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {void}
   */
  bindEventListeners(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Navigation items
    root.querySelectorAll(".nav-item[data-page]").forEach((item) => {
      const el = /** @type {HTMLElement} */ (item);
      el.addEventListener("click", () =>
        this.showPage(el.dataset.page || "chat"),
      );
    });

    // Menu toggle logic
    const menuButton = root.getElementById("menu-button");
    const sidebar = root.querySelector(".sidebar");

    if (menuButton && sidebar) {
      menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");
      });

      // Close sidebar when an item is tapped (only on mobile)
      root.querySelectorAll(".nav-item, .settings-btn").forEach((item) => {
        item.addEventListener("click", () => {
          if (window.innerWidth < 768) {
            sidebar.classList.remove("open");
          }
        });
      });

      // Responsive matchMedia handler for orientation/resizing
      const matchMedia = globalThis.matchMedia("(min-width: 768px)");

      /** @param {MediaQueryListEvent|MediaQueryList} e */
      const handleMediaQuery = (e) => {
        if (e.matches) {
          sidebar.classList.remove("open"); // Desktop view handles visibility implicitly
        }
      };

      // Setup initial state
      handleMediaQuery(matchMedia);

      // Listen for changes
      matchMedia.addEventListener("change", handleMediaQuery);
    }

    // Settings button
    const settingsBtn = root.querySelector('[data-action="show-settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.showPage("settings"));
    }

    // Chat input
    const chatInput = root.querySelector(".chat-input");
    if (chatInput) {
      /** @type {HTMLTextAreaElement} */
      const input = /** @type {HTMLTextAreaElement} */ (chatInput);
      input.addEventListener("keydown", (e) => {
        /** @type {KeyboardEvent} */
        const event = e;
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();

          this.sendMessage();
        }
      });

      input.addEventListener("input", function (e) {
        const target = /** @type {HTMLTextAreaElement} */ (e.target);
        if (target) {
          target.style.height = "auto";
          target.style.height = Math.min(target.scrollHeight, 100) + "px";
        }
      });
    }

    // Send button
    const sendBtn = root.querySelector('[data-action="send-message"]');
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    // Provider change
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    );

    if (providerSelect) {
      providerSelect.addEventListener("change", () =>
        this.onProviderChange(db),
      );
    }

    // Settings actions
    const saveApiKeyBtn = root.querySelector('[data-action="save-api-key"]');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener("click", () => this.saveApiKey(db));
    }

    const saveModelBtn = root.querySelector('[data-action="save-model"]');
    if (saveModelBtn) {
      saveModelBtn.addEventListener("click", () => this.saveModel(db));
    }

    const saveNameBtn = root.querySelector(
      '[data-action="save-assistant-name"]',
    );
    if (saveNameBtn) {
      saveNameBtn.addEventListener("click", () => this.saveAssistantName(db));
    }

    // Clear chat button
    const clearChatBtn = root.querySelector('[data-action="clear-chat"]');
    if (clearChatBtn) {
      clearChatBtn.addEventListener("click", () => this.handleClearChat(db));
    }

    // Download chat button
    const downloadChatBtn = root.querySelector('[data-action="download-chat"]');
    if (downloadChatBtn) {
      downloadChatBtn.addEventListener("click", () => this.downloadChat(db));
    }

    // Restore chat button
    const restoreChatBtn = root.querySelector('[data-action="restore-chat"]');
    if (restoreChatBtn) {
      restoreChatBtn.addEventListener("click", () => this.restoreChat(db));
    }

    // Close modal
    const closeModalBtn = root.querySelector(".close-modal-btn");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () =>
        fileViewerStore.closeFile(),
      );
    }

    // Storage actions
    root
      .querySelector('[data-action="request-persistent"]')
      ?.addEventListener("click", () => this.handleRequestPersistent(db));

    root
      .querySelector('[data-action="compact-chat"]')
      ?.addEventListener("click", () => this.handleCompactChat(db));

    root
      .querySelector('[data-action="clear-chat"]')
      ?.addEventListener("click", () => this.handleClearChat(db));

    root
      .querySelector('[data-action="change-storage-dir"]')
      ?.addEventListener("click", () => this.handleChangeStorageDir(db));

    root
      .querySelector('[data-action="reset-storage-dir"]')
      ?.addEventListener("click", () => this.handleResetStorageDir(db));

    // Theme toggle
    const themeToggle = root.querySelector(".theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const { resolved } = themeStore.getTheme();

        const newTheme = resolved === Themes.Dark ? Themes.Light : Themes.Dark;
        themeStore.setTheme(newTheme);
      });
    }

    // Listen for theme changes to update icons and host class
    window.addEventListener("shadow-claw-theme-change", (e) => {
      const theme = /** @type {CustomEvent} */ (e).detail.theme;
      this.updateThemeIcons(theme);
      this.updateHostTheme(theme);
    });

    // Initial state
    const currentTheme = themeStore.resolved;
    this.updateThemeIcons(currentTheme);
    this.updateHostTheme(currentTheme);

    // Git settings listeners
    const saveGitBtn = root.querySelector('[data-action="save-git-settings"]');
    if (saveGitBtn) {
      saveGitBtn.addEventListener("click", () => this.saveGitSettings(db));
    }

    // Git radio buttons change
    root.querySelectorAll('input[name="git-proxy"]').forEach((radio) => {
      radio.addEventListener("change", () => this.updateGitWarning());
    });

    // Git token input change (to trigger warning if needed)
    root
      .querySelector('[data-setting="git-token-input"]')
      ?.addEventListener("input", () => this.updateGitWarning());
  }

  /**
   * Update host element theme classes
   *
   * @param {string} theme
   */
  updateHostTheme(theme) {
    if (theme === Themes.Dark) {
      this.classList.add("dark-mode");
      this.classList.remove("light-mode");
    } else {
      this.classList.add("light-mode");
      this.classList.remove("dark-mode");
    }
  }

  /**
   * Update theme toggle icons based on current theme
   *
   * @param {string} theme
   */
  updateThemeIcons(theme) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const sunIcon = /** @type {HTMLElement} */ (
      root.querySelector(".sun-icon")
    );

    const moonIcon = /** @type {HTMLElement} */ (
      root.querySelector(".moon-icon")
    );

    if (sunIcon && moonIcon) {
      if (theme === Themes.Dark) {
        sunIcon.style.display = "block";
        moonIcon.style.display = "none";
      } else {
        sunIcon.style.display = "none";
        moonIcon.style.display = "block";
      }
    }
  }

  /**
   * Show a specific page
   *
   * @param {string} page
   *
   * @returns {void}
   */
  showPage(page) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Hide all pages
    root.querySelectorAll(".page").forEach((p) => {
      const el = p;
      el.classList.remove("active");
    });

    root.querySelectorAll(".nav-item").forEach((n) => {
      const el = n;
      el.classList.remove("active");
    });

    // Show selected page
    const pageEl = root.querySelector(`[data-page-id="${page}"]`);
    if (pageEl) {
      const el = pageEl;
      el.classList.add("active");
    }

    const navEl = root.querySelector(`[data-page="${page}"]`);
    if (navEl) {
      const el = navEl;
      el.classList.add("active");
    }

    this.currentPage = page;

    // Scroll to top
    const activePage = root.querySelector(".page.active");
    if (activePage) {
      const el = activePage;
      el.scrollTo(0, 0);
    }
  }

  /**
   * Send a message
   *
   * @returns {Promise<void>}
   */
  async sendMessage() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(".chat-input");
    if (!input) {
      return;
    }

    /** @type {HTMLTextAreaElement} */
    const textArea = /** @type {HTMLTextAreaElement} */ (input);
    const message = textArea.value.trim();

    if (!message) {
      return;
    }

    if (!this.orchestrator) {
      showWarning("ShadowClaw is still initializing. Please try again.", 3500);

      return;
    }

    // Clear input and reset height
    textArea.value = "";
    textArea.style.height = "auto";

    try {
      orchestratorStore.sendMessage(message);
    } catch (err) {
      console.error("Error sending message:", err);

      const errorMsg = err instanceof Error ? err.message : String(err);
      // Small manual override for error display if needed,
      // though typically orchestratorStore handles this.
      showError(`Error sending message: ${errorMsg}`, 6000);
    }
  }

  /**
   * Setup reactive effects
   */
  setupEffects() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // React to messages
    effect(() => {
      /** @type {StoredMessage[]} */
      const messages = orchestratorStore.messages;
      const container = root.querySelector(".messages-container");
      if (container) {
        container.innerHTML = "";
        messages.forEach((/** @type {StoredMessage} */ msg) => {
          const type = msg.isFromMe ? "assistant" : "user";
          const assistantName =
            localStorage.getItem("assistantName") || "rover";

          const sender = msg.isFromMe ? assistantName : msg.sender || "You";

          const msgDiv = document.createElement("div");
          msgDiv.className = `message ${type}`;

          const timestamp = msg.timestamp ? formatTimestamp(msg.timestamp) : "";

          msgDiv.innerHTML = `
            <div class="message-header">
              <div class="message-sender">${sender}</div>
              <div class="message-timestamp">${timestamp}</div>
            </div>
            <div class="message-content">${renderMarkdown(msg.content)}</div>
          `;

          container.appendChild(msgDiv);
        });

        container.scrollTop = container.scrollHeight;
      }
    });

    // React to tool activity
    effect(() => {
      /** @type {ToolActivity|null} */
      const activity = orchestratorStore.toolActivity;
      const toolEl = root.querySelector(".tool-activity");
      if (toolEl) {
        if (activity) {
          toolEl.classList.add("active");
          toolEl.textContent = `⚙️ Using ${activity.tool}...`;
        } else {
          toolEl.classList.remove("active");
        }
      }
    });

    // React to token usage
    effect(() => {
      /** @type {TokenUsage|null} */
      const usage = orchestratorStore.tokenUsage;
      const usageEl = root.querySelector(".token-usage");
      if (usageEl) {
        if (usage) {
          usageEl.textContent = `Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`;
        } else {
          usageEl.textContent = "";
        }
      }
    });

    // React to activity log
    effect(() => {
      /** @type {ThinkingLogEntry[]} */
      const log = orchestratorStore.activityLog;
      const logEl = root.querySelector(".activity-log");
      if (logEl) {
        if (log.length > 0) {
          logEl.classList.add("active");
          logEl.innerHTML = log
            .map(
              (/** @type {ThinkingLogEntry} */ entry) =>
                `<div>[${entry.level}] ${entry.label || ""}: ${entry.message}</div>`,
            )
            .join("");

          logEl.scrollTop = logEl.scrollHeight;
        } else {
          logEl.classList.remove("active");
        }
      }
    });

    // React to file viewer
    effect(() => {
      /** @type {FileInfo|null} */
      const file = fileViewerStore.file;
      const modal = root.querySelector(".file-viewer-modal");
      if (modal) {
        if (file) {
          modal.classList.add("active");
          const title = modal.querySelector(".modal-title");
          const content = modal.querySelector(".file-content");

          if (title) {
            title.textContent = `File: ${file.name}`;
          }

          if (content) {
            content.textContent = file.content;
          }
        } else {
          modal.classList.remove("active");
        }
      }
    });

    // React to orchestrator state
    effect(() => {
      const statusIndicator = root.querySelector(".status-indicator");
      const statusText = root.querySelector(
        ".chat-header .status-indicator",
      )?.nextSibling;
      const state = orchestratorStore.state;

      console.log("Orchestrator state changed:", state);

      if (statusIndicator) {
        /** @type {HTMLElement} */
        const el = /** @type {HTMLElement} */ (statusIndicator);
        el.style.color =
          state === "thinking" || state === "responding"
            ? "var(--shadow-claw-warning-color, #f59e0b)"
            : state === "error"
              ? "var(--shadow-claw-error-color, #ef4444)"
              : "var(--shadow-claw-success-color, #10b981)";
      }

      if (statusText) {
        statusText.textContent = ` ● ${state.charAt(0).toUpperCase() + state.slice(1)}`;
      }

      if (
        state === "idle" &&
        (this.previousOrchestratorState === "thinking" ||
          this.previousOrchestratorState === "responding")
      ) {
        showSuccess("Response complete", 2500);
      }

      this.previousOrchestratorState = state;
    });

    // React to orchestrator errors
    effect(() => {
      const error = orchestratorStore.error;
      if (error && error !== this.lastErrorToast) {
        showError(error, 6000);
        this.lastErrorToast = error;
      }
    });

    // React to storage status
    effect(() => {
      const status = orchestratorStore.storageStatus;
      if (!status) {
        return;
      }

      const typeEl = root.querySelector('[data-info="storage-type"]');
      const statusBadge = root.querySelector(
        '[data-info="storage-status-badge"]',
      );

      const grantBtn = root.querySelector(
        '[data-action="grant-storage-permission"]',
      );

      if (typeEl) {
        typeEl.textContent =
          status.type === "local"
            ? "Local Directory"
            : "Browser Internal (OPFS)";
      }

      if (statusBadge) {
        /** @type {HTMLElement} */ (statusBadge).style.display =
          status.type === "local" ? "inline-block" : "none";

        if (status.type === "local") {
          statusBadge.textContent =
            status.permission === "granted" ? "CONNECTED" : "NEEDS PERMISSION";

          /** @type {HTMLElement} */ (statusBadge).style.backgroundColor =
            status.permission === "granted"
              ? "var(--shadow-claw-success-color)"
              : "var(--shadow-claw-error-color)";

          /** @type {HTMLElement} */ (statusBadge).style.color = "white";
        }
      }

      if (grantBtn) {
        /** @type {HTMLElement} */ (grantBtn).style.display =
          status.type === "local" && status.permission !== "granted"
            ? "inline-block"
            : "none";
      }
    });
  }

  /**
   * Compact chat handler
   *
   * @param {ShadowClawDatabase} db
   */
  async handleCompactChat(db) {
    if (
      !confirm(
        "This will summarize the conversation to reduce token usage. The summary replaces the current history. Continue?",
      )
    ) {
      return;
    }

    try {
      await orchestratorStore.compactContext(db);
      showInfo("Compacting context...", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to compact chat: ${errorMsg}`, 6000);
    }
  }

  /**
   * Clear chat handler
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async handleClearChat(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Clear UI
    const container = root.querySelector(".messages-container");
    if (container) {
      container.innerHTML = "";
    }

    // Clear storage/database
    if (this.orchestrator) {
      try {
        await this.orchestrator.newSession(db);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn("Failed to clear session:", errorMsg);
      }
    }
  }

  /**
   * Download chat as a zip file
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async downloadChat(db) {
    try {
      const groupId = orchestratorStore.activeGroupId;
      const chatData = await exportChatData(db, groupId);
      if (!chatData) {
        showError("Failed to export chat data", 6000);

        return;
      }

      // Create a zip file
      const zip = new JSZip();
      zip.file("chat-data.json", JSON.stringify(chatData, null, 2));

      // Generate zip blob
      const blob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `chat-${formatDateForFilename()}.zip`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      // Show success message
      showSuccess("Chat backup downloaded", 3000);
    } catch (err) {
      console.error("Failed to download chat:", err);

      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to download chat: ${message}`, 6000);
    }
  }

  /**
   * Restore chat from a zip file
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async restoreChat(db) {
    try {
      // Create file input
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".zip";

      fileInput.addEventListener("change", async (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        const file = target?.files?.[0];
        if (!file) {
          return;
        }

        try {
          // Read zip file
          const zip = await JSZip.loadAsync(file);

          // Get chat-data.json from zip
          const dataFile = zip.file("chat-data.json");
          if (!dataFile) {
            showError("Invalid chat file: missing chat-data.json", 6000);

            return;
          }

          const jsonString = await dataFile.async("string");
          const chatData = JSON.parse(jsonString);

          // Validate data structure
          if (!chatData.messages || !Array.isArray(chatData.messages)) {
            showError("Invalid chat file: missing messages array", 6000);

            return;
          }

          // Import the chat data to database
          const groupId = orchestratorStore.activeGroupId;
          await importChatData(db, groupId, chatData);

          // Clear the store's messages to trigger a re-render, then reload from DB
          orchestratorStore._messages.set([]);
          await orchestratorStore.loadHistory();

          showSuccess("Chat restored successfully", 3500);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("Failed to restore chat:", err);

          showError(`Failed to restore chat: ${errorMsg}`, 6000);
        }
      });

      fileInput.click();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Error in restoreChat:", err);

      showError(`Error restoring chat: ${errorMsg}`, 6000);
    }
  }

  /**
   * Load settings
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async loadSettings(db) {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      // Load provider selector
      const providers = this.orchestrator.getAvailableProviders();
      const providerSelect = root.querySelector(
        '[data-setting="provider-select"]',
      );

      const currentProvider = this.orchestrator.getProvider();
      const currentProviderData = /** @type {LLMProvider | undefined} */ (
        providers.find((p) => p.id === currentProvider)
      );

      if (providerSelect) {
        /** @type {HTMLSelectElement} */
        const select = /** @type {HTMLSelectElement} */ (providerSelect);
        select.innerHTML = providers
          .map(
            (/** @type {LLMProvider} */ p) =>
              `<option value="${p.id}" ${p.id === currentProvider ? "selected" : ""}>${p.name}</option>`,
          )
          .join("");
      }

      // Load and update the model selector
      this.updateModelSelector();

      // Load assistant name
      const nameInput = root.querySelector(
        '[data-setting="assistant-name-input"]',
      );

      if (nameInput) {
        /** @type {HTMLInputElement} */
        const input = /** @type {HTMLInputElement} */ (nameInput);
        input.value = localStorage.getItem("assistantName") || "rover";
      }
      // Load Git settings
      const proxyPref =
        (await getConfig(db, CONFIG_KEYS.GIT_CORS_PROXY)) || "local";

      const localRadio = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-proxy-local"]')
      );

      const publicRadio = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-proxy-public"]')
      );

      if (localRadio && publicRadio) {
        localRadio.checked = proxyPref === "local";
        publicRadio.checked = proxyPref === "public";
      }

      const authorNameInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-author-name-input"]')
      );

      if (authorNameInput)
        authorNameInput.value =
          (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_NAME)) || "ShadowClaw";

      const authorEmailInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-author-email-input"]')
      );

      if (authorEmailInput)
        authorEmailInput.value =
          (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_EMAIL)) ||
          "k9@shadowclaw.local";

      // Git token is sensitive, we should not populate it except maybe as placeholders or indicators if it exists
      const gitTokenInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-token-input"]')
      );

      const encToken = await getConfig(db, CONFIG_KEYS.GIT_TOKEN);
      if (gitTokenInput) {
        gitTokenInput.placeholder = encToken
          ? "•••••••••••• (Saved)"
          : "ghp_xxxxxxxxxxxx";
      }

      this.updateGitWarning();
    } catch (e) {
      console.warn("Could not load settings:", e);
    }

    // Load storage info
    await this.updateStorageInfo(db);
  }

  /**
   * Update storage information in UI
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async updateStorageInfo(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      const estimate = await getStorageEstimate();
      const usageStr = this.formatBytes(estimate.usage);
      const quotaStr = this.formatBytes(estimate.quota);
      const percent =
        estimate.quota > 0 ? (estimate.usage / estimate.quota) * 100 : 0;

      const usageEl = root.querySelector('[data-info="storage-usage"]');
      const quotaEl = root.querySelector('[data-info="storage-quota"]');
      const progressEl = root.querySelector('[data-info="storage-progress"]');
      const typeEl = root.querySelector('[data-info="storage-type"]');
      const persistentBadge = root.querySelector(
        '[data-info="storage-persistent-badge"]',
      );

      if (usageEl) {
        usageEl.textContent = `${usageStr} used`;
      }

      if (quotaEl) {
        quotaEl.textContent = `of ${quotaStr}`;
      }

      if (progressEl) {
        /** @type {HTMLElement} */ (progressEl).style.width = `${percent}%`;
      }

      // Check storage type
      const handle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
      if (handle) {
        if (typeEl) {
          typeEl.textContent = "Local Directory";
        }
      } else {
        if (typeEl) {
          typeEl.textContent = "Browser Internal (OPFS)";
        }
      }

      // Check persistence
      const persistent = await isPersistent();
      if (persistentBadge)
        /** @type {HTMLElement} */ (persistentBadge).style.display = persistent
          ? "inline-block"
          : "none";

      // Update help text based on type
      const helpGeneralEl = root.querySelector(
        '[data-info="storage-help-general"]',
      );

      const helpLocalEl = root.querySelector(
        '[data-info="storage-help-local"]',
      );

      if (helpGeneralEl) {
        if (handle) {
          helpGeneralEl.innerHTML = `
            Persistent storage protects your <b>chat history, tasks, and settings</b> in the browser database.
            Without it, the browser might clear this data if your disk is almost full.
          `;
        } else {
          helpGeneralEl.innerHTML = `
            Persistent storage protects your <b>files, chat history, and settings</b> in the browser.
            Without it, the browser might clear your data if your disk is almost full.
          `;
        }
      }

      if (helpLocalEl) {
        if (handle) {
          helpLocalEl.innerHTML = `
            ShadowClaw is currently <b>connected to a local folder</b>. Your files are safe on your disk, 
            but browser persistence is still recommended for your chat history.
          `;
        } else {
          helpLocalEl.innerHTML = `
            You can use a local folder on your computer for storage. This makes files directly accessible 
            on your disk and independent of browser storage limits.
          `;
        }
      }

      // Storage buttons
      const grantStorageBtn = root.querySelector(
        '[data-action="grant-storage-permission"]',
      );

      if (grantStorageBtn) {
        grantStorageBtn.addEventListener("click", () =>
          orchestratorStore.grantStorageAccess(db),
        );
      }

      const requestPersistentBtn = root.querySelector(
        '[data-action="request-persistent"]',
      );

      if (requestPersistentBtn)
        /** @type {HTMLButtonElement} */ (requestPersistentBtn).disabled =
          persistent;
    } catch (err) {
      console.warn("Failed to update storage info:", err);
    }
  }

  /**
   * Format bytes to human readable string
   *
   * @param {number} bytes
   *
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) {
      return "0 B";
    }

    const k = 1024;
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
  }

  /**
   * Handle persistent storage request
   *
   * @param {ShadowClawDatabase} db
   */
  async handleRequestPersistent(db) {
    try {
      const granted = await requestPersistentStorage();
      if (granted) {
        showSuccess("Persistent storage granted", 3500);
      } else {
        showWarning(
          "Persistent storage was not granted. Browsers may deny this based on site usage.",
          5500,
        );
      }

      await this.updateStorageInfo(db);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Storage request failed: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle changing storage directory
   *
   * @param {ShadowClawDatabase} db
   */
  async handleChangeStorageDir(db) {
    try {
      const success = await selectStorageDirectory(db);
      if (success) {
        showSuccess(
          "Storage location changed. Existing OPFS files were not moved.",
          4500,
        );

        await this.updateStorageInfo(db);
        // Reload files in store if on files page or just to be safe
        await orchestratorStore.loadFiles(db);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to change storage location: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle resetting storage directory
   *
   * @param {ShadowClawDatabase} db
   */
  async handleResetStorageDir(db) {
    if (!confirm("Revert storage to browser-internal (OPFS)?")) {
      return;
    }

    try {
      await resetStorageDirectory(db);

      showSuccess("Reverted to browser-internal storage", 3500);

      await this.updateStorageInfo(db);
      await orchestratorStore.loadFiles(db);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError(`Failed to reset storage location: ${errorMsg}`, 6000);
    }
  }

  /**
   * Handle provider change
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async onProviderChange(db) {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    );

    if (!providerSelect) {
      return;
    }

    /** @type {HTMLSelectElement | null} */
    const select = /** @type {HTMLSelectElement | null} */ (providerSelect);
    if (!select) {
      return;
    }

    const providerId = select.value;
    const currentProvider = this.orchestrator.getProvider();

    if (providerId !== currentProvider) {
      try {
        await this.orchestrator.setProvider(db, providerId);
        this.updateModelSelector();

        const selectedText = select.selectedOptions[0]?.text || providerId;
        showSuccess(`Switched to ${selectedText}`, 3000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showError("Error switching provider: " + errorMsg, 6000);
        // Reset the selector
        /** @type {HTMLSelectElement | null} */
        const selectEl = /** @type {HTMLSelectElement | null} */ (
          root.querySelector('[data-setting="provider-select"]')
        );

        if (selectEl) {
          selectEl.value = currentProvider;
        }
      }
    }
  }

  /**
   * Update model selector based on current provider
   *
   * @returns {void}
   */
  updateModelSelector() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providers = this.orchestrator.getAvailableProviders();
    const currentProvider = this.orchestrator.getProvider();
    const currentProviderData = /** @type {LLMProvider | undefined} */ (
      providers.find((p) => p.id === currentProvider)
    );

    const modelSelect = root.querySelector('[data-setting="model-select"]');
    const currentModel = this.orchestrator.getModel();

    if (modelSelect && currentProviderData && currentProviderData.models) {
      /** @type {HTMLSelectElement} */
      const select = /** @type {HTMLSelectElement} */ (modelSelect);
      select.innerHTML = currentProviderData.models
        .map(
          (/** @type {string} */ model) =>
            `<option value="${model}" ${model === currentModel ? "selected" : ""}>${model}</option>`,
        )
        .join("");
    }

    // Update helper text for API key
    const helperText = root.querySelector('[data-setting="api-key-helper"]');
    const providerSelectSelector = '[data-setting="provider-select"]';
    const providerSelect = root.querySelector(providerSelectSelector);

    if (helperText && providerSelect) {
      /** @type {HTMLSelectElement} */
      const select = /** @type {HTMLSelectElement} */ (providerSelect);
      const providerName = select.selectedOptions[0]?.text || "Provider";
      helperText.textContent = `Enter your ${providerName} API key. It is encrypted and stored locally.`;
    }
  }

  /**
   * Save API key and provider
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async saveApiKey(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const keyInput = root.querySelector('[data-setting="api-key-input"]');
    if (!keyInput) {
      return;
    }

    /** @type {HTMLInputElement} */
    const input = /** @type {HTMLInputElement} */ (keyInput);
    const key = input.value.trim();

    if (!key) {
      showWarning("Please enter an API key", 3000);
      return;
    }

    if (!this.orchestrator) {
      showError("Orchestrator not initialized", 5000);
      return;
    }

    try {
      const providerSelect = root.querySelector(
        '[data-setting="provider-select"]',
      );

      if (!providerSelect) {
        return;
      }

      /** @type {HTMLSelectElement} */
      const select = /** @type {HTMLSelectElement} */ (providerSelect);
      const providerId = select.value;

      await this.orchestrator.setApiKey(db, key);

      /** @type {HTMLInputElement} */
      const inputEl = /** @type {HTMLInputElement} */ (keyInput);
      inputEl.value = "";
      showSuccess("API key and provider saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving API key: " + errorMsg, 6000);
    }
  }

  /**
   * Save model selection
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async saveModel(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modelSelect = root.querySelector('[data-setting="model-select"]');
    if (!modelSelect) {
      return;
    }

    /** @type {HTMLSelectElement} */
    const select = /** @type {HTMLSelectElement} */ (modelSelect);
    const model = select.value;

    if (!this.orchestrator) {
      return;
    }

    try {
      await this.orchestrator.setModel(db, model);

      showSuccess("Model saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving model: " + errorMsg, 6000);
    }
  }

  /**
   * Save assistant name
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async saveAssistantName(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    );

    if (!nameInput) {
      return;
    }

    /** @type {HTMLInputElement} */
    const input = /** @type {HTMLInputElement} */ (nameInput);
    const name = input.value.trim();

    if (!name) {
      showWarning("Please enter a name", 3000);

      return;
    }

    localStorage.setItem("assistantName", name);

    if (this.orchestrator) {
      try {
        await this.orchestrator.setAssistantName(db, name);
      } catch (e) {
        console.warn("Could not update orchestrator:", e);
      }
    }

    showSuccess("Assistant name saved", 3000);
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text
   *
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;

    return div.innerHTML;
  }

  /**
   * Update the Git security warning visibility
   */
  async updateGitWarning() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const warningEl = /** @type {HTMLElement} */ (
      root.querySelector('[data-setting="git-proxy-warning"]')
    );

    if (!warningEl) {
      return;
    }

    const publicRadio = /** @type {HTMLInputElement} */ (
      root.querySelector('[data-setting="git-proxy-public"]')
    );

    const tokenInput = /** @type {HTMLInputElement} */ (
      root.querySelector('[data-setting="git-token-input"]')
    );

    // We also check DB to see if there is already a saved token
    const db = this.db;
    let hasToken = (tokenInput?.value || "").trim().length > 0;

    if (!hasToken && db) {
      const { getConfig } = await import("../db/getConfig.mjs");
      const { CONFIG_KEYS } = await import("../config.mjs");
      const encToken = await getConfig(db, CONFIG_KEYS.GIT_TOKEN);
      if (encToken) {
        hasToken = true;
      }
    }

    if (publicRadio?.checked && hasToken) {
      warningEl.style.display = "block";
    } else {
      warningEl.style.display = "none";
    }
  }

  /**
   * Save Git settings
   *
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async saveGitSettings(db) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      const { setConfig } = await import("../db/setConfig.mjs");
      const { CONFIG_KEYS } = await import("../config.mjs");
      const { encryptValue } = await import("../crypto.mjs");

      // Proxy preference
      const publicRadio = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-proxy-public"]')
      );

      const proxyPref = publicRadio?.checked ? "public" : "local";
      await setConfig(db, CONFIG_KEYS.GIT_CORS_PROXY, proxyPref);

      // Token
      const tokenInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-token-input"]')
      );

      const token = tokenInput?.value.trim();
      if (token) {
        const encrypted = await encryptValue(token);
        if (encrypted) {
          await setConfig(db, CONFIG_KEYS.GIT_TOKEN, encrypted);
          tokenInput.value = "";
          tokenInput.placeholder = "•••••••••••• (Saved)";
        }
      }

      // Author info
      const nameInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-author-name-input"]')
      );
      if (nameInput)
        await setConfig(
          db,
          CONFIG_KEYS.GIT_AUTHOR_NAME,
          nameInput.value.trim() || "ShadowClaw",
        );

      const emailInput = /** @type {HTMLInputElement} */ (
        root.querySelector('[data-setting="git-author-email-input"]')
      );

      if (emailInput)
        await setConfig(
          db,
          CONFIG_KEYS.GIT_AUTHOR_EMAIL,
          emailInput.value.trim() || "k9@shadowclaw.local",
        );

      showSuccess("Git settings saved", 3000);

      this.updateGitWarning();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Git settings: " + errorMsg, 6000);
    }
  }
}

// Register the custom element
customElements.define("shadow-claw", ShadowClaw);

export default ShadowClaw;
