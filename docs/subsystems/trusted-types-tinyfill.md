# Trusted Types API Tinyfill

This project includes a minimal **Trusted Types API tinyfill** to provide broad browser compatibility while maintaining security best practices.

## What is the Trusted Types API?

The [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) is a W3C web standard that helps prevent DOM-based cross-site scripting (XSS) vulnerabilities by requiring developers to explicitly create trusted content through policy-controlled factories.

## Why a Tinyfill?

While modern browsers increasingly support the Trusted Types API natively, older browsers and some environments don't. The **tinyfill** (tiny polyfill) provides:

- **Native detection**: If the browser already supports `trustedTypes`, the tinyfill is a no-op
- **Fallback implementation**: For browsers without native support, a minimal API surface is provided
- **Zero enforcement**: The tinyfill does NOT validate or enforce security policies—it's purely structural

## How It Works

### Automatic Initialization

The tinyfill is automatically initialized in [`src/theme-init.ts`](../../src/theme-init.ts) at application startup:

```typescript
import { initializeTrustedTypesTinyfill } from "./security/trusted-types-tinyfill.js";

initializeTrustedTypesTinyfill();
```

This is called before any other Trusted Types operations, ensuring `globalThis.trustedTypes` is always available.

### Usage

Once initialized, code can uniformly use the Trusted Types API:

```typescript
// Works in all browsers (native or tinyfilled)
const policy = globalThis.trustedTypes!.createPolicy("my-app", {
  createHTML: (input) => sanitize(input), // e.g., using DOMPurify
});
```
