import type { HttpErrorLike } from "../fetch-file.js";

export class HttpError extends Error implements HttpErrorLike {
  public body: string;
  public status: number;
  public statusText: string;

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}
