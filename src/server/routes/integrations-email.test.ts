import { jest } from "@jest/globals";

describe("integrations-email routes", () => {
  let routes: Map<string, any>;
  let mockConnect: jest.Mock<any>;
  let mockMailboxOpen: jest.Mock<any>;
  let mockFetchOne: jest.Mock<any>;
  let mockDownload: jest.Mock<any>;
  let mockMessageFlagsAdd: jest.Mock<any>;
  let mockMessageFlagsRemove: jest.Mock<any>;
  let mockMessageDelete: jest.Mock<any>;
  let mockSearch: jest.Mock<any>;
  let mockLogout: jest.Mock<any>;
  let mockSendMail: jest.Mock<any>;
  let mockCreateTransport: jest.Mock<any>;
  let clientUsable: boolean;

  function createResponse() {
    const res: any = {
      statusCode: 200,
      body: undefined,
      headers: {},
      status: jest.fn().mockImplementation((code: any) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((payload: any) => {
        res.body = payload;
        return res;
      }),
    };
    return res;
  }

  beforeEach(async () => {
    jest.resetModules();
    routes = new Map();
    clientUsable = true;

    mockConnect = jest.fn().mockResolvedValue(undefined as never);
    mockMailboxOpen = jest.fn().mockResolvedValue(undefined as never);
    mockFetchOne = jest.fn().mockResolvedValue(undefined as never);
    mockDownload = jest.fn().mockResolvedValue(undefined as never);
    mockMessageFlagsAdd = jest.fn().mockResolvedValue(undefined as never);
    mockMessageFlagsRemove = jest.fn().mockResolvedValue(undefined as never);
    mockMessageDelete = jest.fn().mockResolvedValue(undefined as never);
    mockSearch = jest.fn().mockResolvedValue([] as never);
    mockLogout = jest.fn().mockResolvedValue(undefined as never);

    mockSendMail = jest.fn().mockResolvedValue({
      messageId: "<msg-123@domain.com>",
      accepted: ["recipient@domain.com"],
      rejected: [],
      response: "250 OK",
    } as never);

    mockCreateTransport = jest.fn().mockReturnValue({
      sendMail: mockSendMail,
    });

    class MockImapFlow {
      get usable() {
        return clientUsable;
      }
      connect = mockConnect;
      mailboxOpen = mockMailboxOpen;
      fetchOne = mockFetchOne;
      download = mockDownload;
      messageFlagsAdd = mockMessageFlagsAdd;
      messageFlagsRemove = mockMessageFlagsRemove;
      messageDelete = mockMessageDelete;
      search = mockSearch;
      logout = mockLogout;
      constructor(_opts: any) {}
    }

    jest.unstable_mockModule("imapflow", () => ({
      ImapFlow: MockImapFlow,
    }));

    jest.unstable_mockModule("nodemailer", () => ({
      createTransport: mockCreateTransport,
    }));

    const { registerIntegrationEmailRoutes } =
      await import("./integrations-email.js");

    const app = {
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
    };

    registerIntegrationEmailRoutes(app as any, { verbose: false });
  });

  describe("POST /integrations/email/download-attachments", () => {
    const route = "POST /integrations/email/download-attachments";

    it("returns 400 on missing credentials or messageUid", async () => {
      const handler = routes.get(route);
      const res1 = createResponse();
      await handler({ body: {} }, res1);
      expect(res1.status).toHaveBeenCalledWith(400);

      const res2 = createResponse();
      await handler(
        {
          body: { host: "imap.example.com", username: "user", password: "pwd" },
        },
        res2,
      );
      expect(res2.status).toHaveBeenCalledWith(400);
      expect(res2.body.error).toContain("Missing required field: messageUid.");
    });

    it("downloads specified attachment parts successfully", async () => {
      const handler = routes.get(route);
      mockFetchOne.mockResolvedValue({
        uid: 101,
        bodyStructure: {
          part: "1",
          disposition: "attachment",
          dispositionParameters: { filename: "test.pdf" },
          type: "application",
          subtype: "pdf",
          size: 1024,
        },
      });

      const chunkStream = (async function* () {
        yield Buffer.from("hello attachment data");
      })();
      mockDownload.mockResolvedValue({ content: chunkStream });

      const req = {
        body: {
          host: "imap.example.com",
          username: "user@example.com",
          password: "password123",
          messageUid: 101,
          attachmentParts: ["1"],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockMailboxOpen).toHaveBeenCalledWith("INBOX");
      expect(mockDownload).toHaveBeenCalledWith(101, "1", { uid: true });
      expect(mockLogout).toHaveBeenCalled();
      expect(res.body.count).toBe(1);
      expect(res.body.attachments[0].filename).toBe("test.pdf");
      expect(res.body.attachments[0].contentBase64).toBe(
        Buffer.from("hello attachment data").toString("base64"),
      );
    });

    it("handles OAuth download authentication failure with Gmail custom message", async () => {
      const handler = routes.get(route);
      mockConnect.mockRejectedValue({
        authenticationFailed: true,
      });

      const req = {
        body: {
          authType: "oauth",
          host: "imap.gmail.com",
          username: "user@gmail.com",
          accessToken: "expired-token",
          messageUid: 5,
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body.error).toContain(
        "The Google OAuth token was rejected or expired",
      );
    });
  });

  describe("POST /integrations/email/modify", () => {
    const route = "POST /integrations/email/modify";

    it("returns 400 for invalid action", async () => {
      const handler = routes.get(route);
      const res = createResponse();
      await handler({ body: { action: "unsupported" } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toContain("Missing or invalid action");
    });

    it("returns 400 for missing messageUids", async () => {
      const handler = routes.get(route);
      const res = createResponse();
      await handler(
        {
          body: {
            action: "mark_as_read",
            host: "imap.example.com",
            username: "u",
            password: "p",
            messageUids: [],
          },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error).toContain("Missing required field: messageUids");
    });

    it("executes mark_as_read action", async () => {
      const handler = routes.get(route);
      const req = {
        body: {
          action: "mark_as_read",
          host: "imap.example.com",
          username: "u",
          password: "p",
          messageUids: [10, 20],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockMessageFlagsAdd).toHaveBeenCalledWith([10, 20], ["\\Seen"], {
        uid: true,
      });
      expect(res.body.action).toBe("mark_as_read");
      expect(res.body.count).toBe(2);
    });

    it("executes mark_as_unread action", async () => {
      const handler = routes.get(route);
      const req = {
        body: {
          action: "mark_as_unread",
          host: "imap.example.com",
          username: "u",
          password: "p",
          messageUids: [15],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockMessageFlagsRemove).toHaveBeenCalledWith([15], ["\\Seen"], {
        uid: true,
      });
      expect(res.body.action).toBe("mark_as_unread");
    });

    it("executes delete_messages action", async () => {
      const handler = routes.get(route);
      const req = {
        body: {
          action: "delete_messages",
          host: "imap.example.com",
          username: "u",
          password: "p",
          messageUids: [99],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockMessageDelete).toHaveBeenCalledWith([99], { uid: true });
      expect(res.body.action).toBe("delete_messages");
    });

    it("handles connection failure with 502 status", async () => {
      const handler = routes.get(route);
      mockConnect.mockRejectedValue(new Error("Connection reset by peer"));

      const req = {
        body: {
          action: "delete_messages",
          host: "imap.example.com",
          username: "u",
          password: "p",
          messageUids: [99],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body.error).toContain(
        "Failed to modify mailbox messages: Connection reset by peer",
      );
    });
  });

  describe("POST /integrations/email/read", () => {
    const route = "POST /integrations/email/read";

    it("returns 400 for missing credentials", async () => {
      const handler = routes.get(route);
      const res = createResponse();
      await handler({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("reads mailbox messages and collects attachments", async () => {
      const handler = routes.get(route);
      mockSearch.mockResolvedValue([101, 102]);
      mockFetchOne.mockImplementation(async (uid: number) => ({
        uid,
        envelope: {
          subject: `Subject for ${uid}`,
          date: new Date(1700000000000),
          from: [{ name: "Sender", address: "sender@example.com" }],
          to: [{ name: "Receiver", address: "receiver@example.com" }],
        },
        flags: new Set(["\\Seen"]),
        bodyStructure: {
          childNodes: [
            {
              part: "1.1",
              disposition: "attachment",
              parameters: { name: "doc.docx" },
              type: "application",
              subtype:
                "vnd.openxmlformats-officedocument.wordprocessingml.document",
            },
          ],
        },
      }));

      const req = {
        body: {
          host: "imap.example.com",
          username: "u",
          password: "p",
          unreadOnly: false,
          limit: 10,
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockSearch).toHaveBeenCalledWith({ all: true }, { uid: true });
      expect(res.body.count).toBe(2);
      expect(res.body.messages[0].subject).toBe("Subject for 102");
      expect(res.body.messages[0].attachments[0].filename).toBe("doc.docx");
    });

    it("handles basic auth password failure on gmail", async () => {
      const handler = routes.get(route);
      mockConnect.mockRejectedValue({
        responseText: "Invalid credentials (Failure)",
      });

      const req = {
        body: {
          host: "imap.gmail.com",
          username: "user@gmail.com",
          password: "myNormalPassword",
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body.error).toContain(
        "Gmail rejected the username/password. Use a Google App Password",
      );
    });
  });

  describe("POST /integrations/email/send", () => {
    const route = "POST /integrations/email/send";

    it("returns 400 when required fields are missing", async () => {
      const handler = routes.get(route);
      const res1 = createResponse();
      await handler({ body: {} }, res1);
      expect(res1.status).toHaveBeenCalledWith(400);

      const res2 = createResponse();
      await handler(
        {
          body: { smtpHost: "smtp.example.com", username: "u", password: "p" },
        },
        res2,
      );
      expect(res2.status).toHaveBeenCalledWith(400);
      expect(res2.body.error).toContain("Missing required field: to.");

      const res3 = createResponse();
      await handler(
        {
          body: {
            smtpHost: "smtp.example.com",
            username: "u",
            password: "p",
            to: ["a@b.com"],
          },
        },
        res3,
      );
      expect(res3.status).toHaveBeenCalledWith(400);
      expect(res3.body.error).toContain("Missing required field: subject.");

      const res4 = createResponse();
      await handler(
        {
          body: {
            smtpHost: "smtp.example.com",
            username: "u",
            password: "p",
            to: ["a@b.com"],
            subject: "Hello",
          },
        },
        res4,
      );
      expect(res4.status).toHaveBeenCalledWith(400);
      expect(res4.body.error).toContain("Provide text or html content.");
    });

    it("sends email successfully with basic authentication and attachments", async () => {
      const handler = routes.get(route);
      const req = {
        body: {
          smtpHost: "smtp.example.com",
          smtpPort: 587,
          username: "sender@example.com",
          password: "secretpassword",
          to: ["recipient@example.com"],
          cc: ["cc@example.com"],
          bcc: ["bcc@example.com"],
          subject: "Test Subject",
          text: "Plain text content",
          html: "<p>HTML content</p>",
          attachments: [
            {
              filename: "notes.txt",
              contentType: "text/plain",
              contentBase64: Buffer.from("Hello note").toString("base64"),
            },
          ],
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
          user: "sender@example.com",
          pass: "secretpassword",
        },
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "sender@example.com",
          to: ["recipient@example.com"],
          cc: ["cc@example.com"],
          bcc: ["bcc@example.com"],
          subject: "Test Subject",
          text: "Plain text content",
          html: "<p>HTML content</p>",
          attachments: [
            expect.objectContaining({
              filename: "notes.txt",
              contentType: "text/plain",
              content: Buffer.from("Hello note"),
            }),
          ],
        }),
      );
      expect(res.body.messageId).toBe("<msg-123@domain.com>");
    });

    it("sends email with OAuth2 authentication", async () => {
      const handler = routes.get(route);
      const req = {
        body: {
          authType: "oauth",
          smtpHost: "smtp.gmail.com",
          username: "sender@gmail.com",
          accessToken: "oauth-access-token",
          to: ["recipient@example.com"],
          subject: "OAuth Email",
          text: "Hello via OAuth",
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            type: "OAuth2",
            user: "sender@gmail.com",
            accessToken: "oauth-access-token",
          },
        }),
      );
      expect(res.body.messageId).toBe("<msg-123@domain.com>");
    });

    it("handles SMTP failure with 502 status", async () => {
      const handler = routes.get(route);
      mockSendMail.mockRejectedValue(new Error("550 Mailbox unavailable"));

      const req = {
        body: {
          smtpHost: "smtp.example.com",
          username: "sender@example.com",
          password: "secretpassword",
          to: ["bad@example.com"],
          subject: "Test",
          text: "Fail test",
        },
      };
      const res = createResponse();
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.body.error).toContain(
        "Failed to send message: 550 Mailbox unavailable",
      );
    });
  });
});
