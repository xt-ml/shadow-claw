import {
  isLoopbackHost,
  isPrivateIp,
  isLocalOrPrivateHost,
  isRemoteEnvironment,
} from "./network.js";

describe("network utilities", () => {
  describe("isLoopbackHost", () => {
    it("recognizes localhost and IPv4 loopback variants", () => {
      expect(isLoopbackHost("localhost")).toBe(true);
      expect(isLoopbackHost("127.0.0.1")).toBe(true);
      expect(isLoopbackHost("127.1.2.3")).toBe(true);
    });

    it("recognizes IPv6 loopback variants", () => {
      expect(isLoopbackHost("::1")).toBe(true);
      expect(isLoopbackHost("[::1]")).toBe(true);
    });

    it("rejects non-loopback addresses", () => {
      expect(isLoopbackHost("example.com")).toBe(false);
      expect(isLoopbackHost("192.168.1.1")).toBe(false);
      expect(isLoopbackHost("10.0.0.1")).toBe(false);
    });
  });

  describe("isPrivateIp", () => {
    it("recognizes 10.x.x.x addresses", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("10.255.255.255")).toBe(true);
    });

    it("recognizes 172.16.x.x to 172.31.x.x addresses", () => {
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("172.15.0.1")).toBe(false);
      expect(isPrivateIp("172.32.0.1")).toBe(false);
    });

    it("recognizes 192.168.x.x addresses", () => {
      expect(isPrivateIp("192.168.0.1")).toBe(true);
      expect(isPrivateIp("192.168.1.100")).toBe(true);
    });

    it("recognizes link-local 169.254.x.x addresses", () => {
      expect(isPrivateIp("169.254.169.254")).toBe(true);
    });
  });

  describe("isLocalOrPrivateHost", () => {
    it("recognizes loopback, private IPs, and local domains", () => {
      expect(isLocalOrPrivateHost("localhost")).toBe(true);
      expect(isLocalOrPrivateHost("127.0.0.1")).toBe(true);
      expect(isLocalOrPrivateHost("192.168.1.5")).toBe(true);
      expect(isLocalOrPrivateHost("myhost.local")).toBe(true);
      expect(isLocalOrPrivateHost("server.lan")).toBe(true);
      expect(isLocalOrPrivateHost("singlelabelhost")).toBe(true);
    });

    it("rejects public remote hostnames", () => {
      expect(isLocalOrPrivateHost("api.github.com")).toBe(false);
      expect(isLocalOrPrivateHost("huggingface.co")).toBe(false);
      expect(isLocalOrPrivateHost("8.8.8.8")).toBe(false);
    });
  });

  describe("isRemoteEnvironment", () => {
    it("returns false for loopback and private hosts", () => {
      expect(isRemoteEnvironment("localhost")).toBe(false);
      expect(isRemoteEnvironment("127.0.0.1")).toBe(false);
      expect(isRemoteEnvironment("192.168.1.1")).toBe(false);
      expect(isRemoteEnvironment("mybox.local")).toBe(false);
    });

    it("returns true for public domain hostnames", () => {
      expect(isRemoteEnvironment("shadowclaw.ai")).toBe(true);
      expect(isRemoteEnvironment("xt-ml.github.io")).toBe(true);
    });
  });
});
