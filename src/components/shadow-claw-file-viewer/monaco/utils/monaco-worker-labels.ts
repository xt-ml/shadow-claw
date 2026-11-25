/**
 * Maps a Monaco worker label (language id) to a worker bundle file name in
 * `assets/monaco/workers/`. Pure so it can be unit tested without Monaco.
 */
const SAFE_WORKER_FILE = /^[a-z0-9-]+\.worker\.js$/;

export const MONACO_DEFAULT_WORKER = "editor.worker.js";

export const MONACO_WORKER_FILES: Record<string, string> = {
  css: "css.worker.js",
  handlebars: "html.worker.js",
  html: "html.worker.js",
  json: "json.worker.js",
  less: "css.worker.js",
  razor: "html.worker.js",
  scss: "css.worker.js",
};

export function registerMonacoWorker(label: string, file: string): void {
  if (!SAFE_WORKER_FILE.test(file)) {
    throw new Error(`Unsafe Monaco worker file name: ${file}`);
  }

  MONACO_WORKER_FILES[label] = file;
}

export function resolveMonacoWorkerFile(label: string): string {
  return MONACO_WORKER_FILES[label] || MONACO_DEFAULT_WORKER;
}
