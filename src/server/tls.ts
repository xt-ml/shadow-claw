import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { exit } from "node:process";
import type { ServerConfig } from "./config.js";

export interface TlsCredentials {
  key: Buffer;
  cert: Buffer;
}

/**
 * Resolve the list of Subject Alternative Names (SAN) for certificate generation.
 * Automatically discovers active local network interface IPs, includes loopback addresses,
 * and includes any explicitly configured bind host from CLI/environment.
 */
export function resolveSanList(bindHost?: string): string[] {
  const sanSet = new Set<string>(["DNS:localhost", "IP:127.0.0.1", "IP:::1"]);

  // 1. Add all active local network interface IPs
  try {
    const interfaces = os.networkInterfaces();
    for (const netList of Object.values(interfaces)) {
      if (!netList) continue;
      for (const net of netList) {
        if (net?.address) {
          sanSet.add(`IP:${net.address}`);
        }
      }
    }
  } catch {}

  // 2. Add explicit bindHost if provided and not a catch-all
  if (
    bindHost &&
    bindHost !== "0.0.0.0" &&
    bindHost !== "127.0.0.1" &&
    bindHost !== "localhost" &&
    bindHost !== "::" &&
    bindHost !== "::1"
  ) {
    const isIp = /^(?:::ffff:)?(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/.test(
      bindHost,
    );
    sanSet.add(isIp ? `IP:${bindHost}` : `DNS:${bindHost}`);
  }

  return Array.from(sanSet);
}

/**
 * Ensure TLS certificate and key credentials exist for the HTTPS server.
 *
 * If both `certPath` and `keyPath` are provided in config, they are loaded.
 * If only one is provided, an error is reported and the process exits.
 * If neither is provided, loads `key.pem` and `cert.pem` from `config.sslDir`,
 * or generates a new self-signed certificate using OpenSSL into `config.sslDir`.
 */
export function ensureTlsCredentials(config: ServerConfig): TlsCredentials {
  if (config.certPath && config.keyPath) {
    if (!fs.existsSync(config.certPath)) {
      console.error(`TLS certificate not found: ${config.certPath}`);
      exit(1);
    }
    if (!fs.existsSync(config.keyPath)) {
      console.error(`TLS private key not found: ${config.keyPath}`);
      exit(1);
    }
    return {
      cert: fs.readFileSync(config.certPath),
      key: fs.readFileSync(config.keyPath),
    };
  }

  if (config.certPath && !config.keyPath) {
    console.error(
      "TLS configuration error: --cert was provided without --key.",
    );
    exit(1);
  }

  if (!config.certPath && config.keyPath) {
    console.error(
      "TLS configuration error: --key was provided without --cert.",
    );
    exit(1);
  }

  const sslDir = path.resolve(config.sslDir);
  const certFile = path.join(sslDir, "cert.pem");
  const keyFile = path.join(sslDir, "key.pem");

  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    return {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
    };
  }

  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  const sanList = resolveSanList(config.bindHost);

  try {
    try {
      execFileSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          keyFile,
          "-out",
          certFile,
          "-days",
          "398",
          "-subj",
          "/CN=localhost",
          "-addext",
          `subjectAltName=${sanList.join(",")}`,
          "-addext",
          "extendedKeyUsage=serverAuth",
        ],
        { stdio: "pipe" },
      );
    } catch (extErr: any) {
      if (extErr?.code === "ENOENT") {
        throw extErr;
      }
      // Fallback if older OpenSSL doesn't support -addext
      execFileSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          keyFile,
          "-out",
          certFile,
          "-days",
          "398",
          "-subj",
          "/CN=localhost",
        ],
        { stdio: "pipe" },
      );
    }
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      console.error(
        "Error: OpenSSL must be installed on your system to auto-generate a development TLS certificate. Please install openssl or supply --cert and --key.",
      );
    } else {
      console.error(
        `Error generating TLS certificate with OpenSSL: ${err?.message || String(err)}`,
      );
    }
    exit(1);
  }

  console.warn(
    `[server] Generated self-signed TLS certificate in ${sslDir} (suitable for local/dev use only).`,
  );

  return {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  };
}
