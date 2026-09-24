import { HttpError } from "./HttpError.js";

describe("HttpError", () => {
  it("initializes with status, statusText, and body", () => {
    const err = new HttpError(404, "Not Found", "page missing");
    expect(err.name).toBe("HttpError");
    expect(err.message).toBe("HTTP 404 Not Found");
    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.body).toBe("page missing");
    expect(err.headers).toBe("");
  });

  it("supports optional headers argument", () => {
    const headers = "content-type: text/plain\nx-custom: 1";
    const err = new HttpError(500, "Internal Server Error", "crash", headers);
    expect(err.status).toBe(500);
    expect(err.headers).toBe(headers);
  });
});
