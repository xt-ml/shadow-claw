import { HttpErrorLike } from "../fetch-url";

export class HttpError extends Error implements HttpErrorLike {
  public body: string;
  public headers: string;
  public status: number;
  public statusText: string;

  constructor(status: number, statusText: string, body: string, headers = "") {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.headers = headers;
  }
}
