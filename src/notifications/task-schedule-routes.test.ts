import { jest } from "@jest/globals";

import {
  openTaskScheduleStore,
  closeTaskScheduleStore,
} from "./task-schedule-store.js";

import { registerTaskScheduleRoutes } from "./task-schedule-routes.js";

// Mini Express-like mock
function createMockApp() {
  const routes: any = { get: {}, post: {}, delete: {}, patch: {} };

  const app: any = {
    get: (path, handler) => {
      routes.get[path] = handler;
    },
    post: (path, handler) => {
      routes.post[path] = handler;
    },
    delete: (path, handler) => {
      routes.delete[path] = handler;
    },
    patch: (path, handler) => {
      routes.patch[path] = handler;
    },
    _routes: routes,
  };

  return app;
}

function mockReq(body = {}, params = {}, query = {}) {
  return { body, params, query };
}

function mockRes() {
  const res: any = {
    _status: 200,
    _json: null,
    status(code) {
      res._status = code;

      return res;
    },
    json(data) {
      res._json = data;

      return res;
    },
    sendStatus(code) {
      res._status = code;

      return res;
    },
  };

  return res;
}

describe("task-schedule-routes", () => {
  let app;

  beforeEach(() => {
    openTaskScheduleStore(":memory:");
    app = createMockApp();
    registerTaskScheduleRoutes(app);
  });

  afterEach(() => {
    closeTaskScheduleStore();
  });

  const TASK: any = {
    id: "t1",
    groupId: "br:main",
    schedule: "*/5 * * * *",
    prompt: "Check status",
    isScript: false,
    enabled: true,
    lastRun: null,
    createdAt: Date.now(),
  };

  describe("POST /schedule/tasks", () => {
    it("creates a task and returns 201", () => {
      const req = mockReq(TASK);
      const res = mockRes();
      app._routes.post["/schedule/tasks"](req, res);
      expect(res._status).toBe(201);
    });

    it("returns 400 for missing fields", () => {
      const req = mockReq({ id: "t1" });
      const res = mockRes();
      app._routes.post["/schedule/tasks"](req, res);
      expect(res._status).toBe(400);
    });
  });

  describe("GET /schedule/tasks", () => {
    it("returns all tasks", () => {
      const postReq = mockReq(TASK);
      const postRes = mockRes();
      app._routes.post["/schedule/tasks"](postReq, postRes);

      const req = mockReq({} as any, {}, {});
      const res = mockRes();
      app._routes.get["/schedule/tasks"](req, res);
      expect(res._json).toHaveLength(1);

      expect(res._json[0].id).toBe("t1");
    });

    it("filters by groupId query param", () => {
      app._routes.post["/schedule/tasks"](mockReq(TASK), mockRes());
      app._routes.post["/schedule/tasks"](
        mockReq({ ...TASK, id: "t2", groupId: "br:other" }),
        mockRes(),
      );

      const res = mockRes();
      app._routes.get["/schedule/tasks"](
        mockReq({} as any, {}, { groupId: "br:main" }),
        res,
      );
      expect(res._json).toHaveLength(1);
    });
  });

  describe("GET /schedule/tasks/:id", () => {
    it("returns a task by ID", () => {
      app._routes.post["/schedule/tasks"](mockReq(TASK), mockRes());

      const res = mockRes();
      app._routes.get["/schedule/tasks/:id"](
        mockReq({} as any, { id: "t1" }),
        res,
      );

      expect(res._json.id).toBe("t1");
    });

    it("returns 404 for non-existent task", () => {
      const res = mockRes();
      app._routes.get["/schedule/tasks/:id"](
        mockReq({} as any, { id: "nope" }),
        res,
      );
      expect(res._status).toBe(404);
    });
  });

  describe("DELETE /schedule/tasks/:id", () => {
    it("deletes a task", () => {
      app._routes.post["/schedule/tasks"](mockReq(TASK), mockRes());

      const res = mockRes();
      app._routes.delete["/schedule/tasks/:id"](
        mockReq({} as any, { id: "t1" }),
        res,
      );
      expect(res._status).toBe(200);

      const listRes = mockRes();
      app._routes.get["/schedule/tasks"](mockReq({} as any, {}, {}), listRes);
      expect(listRes._json).toHaveLength(0);
    });
  });

  describe("PATCH /schedule/tasks/:id/enable", () => {
    it("enables a disabled task", () => {
      app._routes.post["/schedule/tasks"](
        mockReq({ ...TASK, enabled: false }),
        mockRes(),
      );

      const res = mockRes();
      app._routes.patch["/schedule/tasks/:id/enable"](
        mockReq({} as any, { id: "t1" }),
        res,
      );
      expect(res._status).toBe(200);

      const getRes = mockRes();
      app._routes.get["/schedule/tasks/:id"](
        mockReq({} as any, { id: "t1" }),
        getRes,
      );

      expect(getRes._json.enabled).toBe(1);
    });

    it("returns 404 for non-existent task", () => {
      const res = mockRes();
      app._routes.patch["/schedule/tasks/:id/enable"](
        mockReq({} as any, { id: "nope" }),
        res,
      );
      expect(res._status).toBe(404);
    });
  });

  describe("PATCH /schedule/tasks/:id/disable", () => {
    it("disables an enabled task", () => {
      app._routes.post["/schedule/tasks"](mockReq(TASK), mockRes());

      const res = mockRes();
      app._routes.patch["/schedule/tasks/:id/disable"](
        mockReq({} as any, { id: "t1" }),
        res,
      );
      expect(res._status).toBe(200);

      const getRes = mockRes();
      app._routes.get["/schedule/tasks/:id"](
        mockReq({} as any, { id: "t1" }),
        getRes,
      );

      expect(getRes._json.enabled).toBe(0);
    });

    it("returns 404 for non-existent task", () => {
      const res = mockRes();
      app._routes.patch["/schedule/tasks/:id/disable"](
        mockReq({} as any, { id: "nope" }),
        res,
      );
      expect(res._status).toBe(404);
    });
  });
});
