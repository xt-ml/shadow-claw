import express from "express";
import { registerDocsRoutes } from "./docs.js";

describe("registerDocsRoutes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    registerDocsRoutes(app);
  });

  describe("GET /api/openapi.json", () => {
    it("should return 200 and the OpenAPI 3.1 JSON specification", async () => {
      let status: number | undefined;
      let contentType: string | undefined;
      let body: any;

      const req = {
        method: "GET",
        url: "/api/openapi.json",
        headers: {},
      } as any;

      const res = {
        status(s: number) {
          status = s;
          return this;
        },
        setHeader(name: string, val: string) {
          if (name.toLowerCase() === "content-type") {
            contentType = val;
          }
          return this;
        },
        json(data: any) {
          status = status || 200;
          contentType = "application/json";
          body = data;
          return this;
        },
        send(data: any) {
          status = status || 200;
          body = data;
          return this;
        },
      } as any;

      const routerStack =
        app._router?.stack || (app as any).router?.stack || [];
      const layer = routerStack.find(
        (l: any) =>
          l.route?.path === "/api/openapi.json" && l.route?.methods?.get,
      );

      expect(layer).toBeDefined();
      await layer.route.stack[0].handle(req, res, () => {});

      expect(status).toBe(200);
      expect(contentType).toBe("application/json");
      expect(body).toBeDefined();
      expect(body.openapi).toBe("3.1.0");
      expect(body.info.title).toBe("ShadowClaw API");
      expect(body.paths).toBeDefined();
    });
  });

  describe("GET /api/docs and GET /docs", () => {
    it("should render the Scalar documentation HTML page on /api/docs", async () => {
      let status = 200;
      let contentType = "";
      let html = "";

      const req = {
        method: "GET",
        url: "/api/docs",
        headers: {},
      } as any;

      const res = {
        status(s: number) {
          status = s;
          return this;
        },
        type(t: string) {
          contentType = t;
          return this;
        },
        setHeader(name: string, val: string) {
          if (name.toLowerCase() === "content-type") {
            contentType = val;
          }
          return this;
        },
        send(content: string) {
          html = content;
          return this;
        },
      } as any;

      const routerStack =
        app._router?.stack || (app as any).router?.stack || [];
      const layer = routerStack.find(
        (l: any) => l.route?.path === "/api/docs" && l.route?.methods?.get,
      );

      expect(layer).toBeDefined();
      await layer.route.stack[0].handle(req, res, () => {});

      expect(status).toBe(200);
      expect(contentType).toContain("html");
      expect(html).toContain("Scalar");
      expect(html).toContain("/api/openapi.json");
    });

    it("should redirect or serve the docs page on /docs", async () => {
      let redirectUrl = "";
      let status = 200;

      const req = {
        method: "GET",
        url: "/docs",
        headers: {},
      } as any;

      const res = {
        redirect(codeOrUrl: any, url?: string) {
          if (typeof codeOrUrl === "number") {
            status = codeOrUrl;
            redirectUrl = url || "";
          } else {
            redirectUrl = codeOrUrl;
          }
          return this;
        },
      } as any;

      const routerStack =
        app._router?.stack || (app as any).router?.stack || [];
      const layer = routerStack.find(
        (l: any) => l.route?.path === "/docs" && l.route?.methods?.get,
      );

      expect(layer).toBeDefined();
      await layer.route.stack[0].handle(req, res, () => {});

      expect(status).toBe(200);
      expect(redirectUrl).toBe("/api/docs");
    });
  });
});
