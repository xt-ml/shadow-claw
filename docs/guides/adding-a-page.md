# Guide: Adding a UI Page

> Step-by-step: create a new Web Component page/section.

## Component Pattern

Every page is a self-contained Web Component extending `ShadowClawElement`:

```text
src/components/shadow-claw-my-page/
├── shadow-claw-my-page.ts     ← Component logic
├── shadow-claw-my-page.html   ← Shadow DOM template
├── shadow-claw-my-page.css    ← Shadow DOM styles
└── shadow-claw-my-page.test.ts
```

## Step 1 — Write a failing test

Create `src/components/shadow-claw-my-page/shadow-claw-my-page.test.ts`:

```ts
import { ShadowClawMyPage } from "./shadow-claw-my-page.js";

describe("shadow-claw-my-page", () => {
  let el: ShadowClawMyPage;

  beforeEach(async () => {
    customElements.define("shadow-claw-my-page", ShadowClawMyPage);
    el = document.createElement("shadow-claw-my-page") as ShadowClawMyPage;
    document.body.appendChild(el);
    await el.onTemplateReady;
    await el.onStylesReady;
  });

  afterEach(() => {
    document.body.removeChild(el);
  });

  it("renders a heading", () => {
    const h1 = el.shadowRoot?.querySelector("h1");
    expect(h1?.textContent).toContain("My Page");
  });
});
```

```bash
npm test -- --testPathPattern shadow-claw-my-page
```

## Step 2 — Create the HTML template

Create `src/components/shadow-claw-my-page/shadow-claw-my-page.html`:

```html
<template>
  <shadow-claw-page-header>
    <span slot="title">My Page</span>
  </shadow-claw-page-header>

  <main id="my-page-main">
    <h1>My Page</h1>
    <p id="my-page-content">Content goes here.</p>
  </main>
</template>
```

> Use `<template>` wrapper — `ShadowClawElement` will extract its `.content.children`.

## Step 3 — Create the CSS

Create `src/components/shadow-claw-my-page/shadow-claw-my-page.css`:

```css
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

main {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}
```

## Step 4 — Create the component class

Create `src/components/shadow-claw-my-page/shadow-claw-my-page.ts`:

```ts
import { effect } from "../../effect.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import ShadowClawElement from "../shadow-claw-element.js";
import "../shadow-claw-page-header/shadow-claw-page-header.js";

const elementName = "shadow-claw-my-page";

export class ShadowClawMyPage extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawMyPage.componentPath}/${elementName}.css`;
  static template = `${ShadowClawMyPage.componentPath}/${elementName}.html`;

  private cleanups: Array<() => void> = [];

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);
    this.setupEffects();
  }

  disconnectedCallback() {
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
  }

  private setupEffects() {
    // Re-run whenever signals change
    const dispose = effect(() => {
      const state = orchestratorStore.state;
      this.render(state);
    });

    this.cleanups.push(dispose);
  }

  private render(state: string) {
    const root = this.shadowRoot;
    if (!root) return;

    const content = root.getElementById("my-page-content");
    if (content) {
      content.textContent = `Current state: ${state}`;
    }
  }
}

customElements.define(elementName, ShadowClawMyPage);
```

## Step 5 — Register the component

Import the new component from `src/index.ts` (or from the parent page component if it's a sub-section):

```ts
// In src/index.ts or src/components/shadow-claw/shadow-claw.ts:
import "./components/shadow-claw-my-page/shadow-claw-my-page.js";
```

## Step 6 — Add navigation

In `src/components/shadow-claw/shadow-claw.html`, add a nav entry:

```html
<nav>
  <!-- Existing nav items... -->
  <button id="nav-my-page" data-page="my-page" aria-label="My Page">
    <!-- SVG icon or emoji -->
  </button>
</nav>
```

In `src/components/shadow-claw/shadow-claw.ts`, handle the navigation:

```ts
case "my-page":
  this.showPage("shadow-claw-my-page");
  break;
```

And add the element to the page container in the HTML:

```html
<shadow-claw-my-page id="page-my-page" hidden></shadow-claw-my-page>
```

## Step 7 — Run the tests and type-check

```bash
npm test -- --testPathPattern shadow-claw-my-page
npm run tsc
```

## Tips

- **Always `await` both `onStylesReady` and `onTemplateReady`** before querying the shadow DOM
- **Clean up `effect()` disposers** in `disconnectedCallback()` to prevent memory leaks
- **Use unique IDs** for interactive elements (prefixed with the component name) for Playwright E2E tests
- **`<shadow-claw-page-header>`** is the reusable mobile-first header — use it for consistent navigation
- **Don't manipulate the light DOM** — all rendering happens inside the shadow root
- **Rollup copies** `.css` and `.html` files to `dist/public/` automatically via the `copy` plugin
