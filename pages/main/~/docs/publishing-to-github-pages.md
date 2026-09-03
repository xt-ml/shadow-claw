---
title: "Publishing to GitHub Pages"
created: "1970-01-01T00:00:00Z"
updated: "1970-01-01T00:00:00Z"
slug: "publishing-to-github-pages"
---

## Publishing to GitHub Pages

ShadowClaw can drive a fully automated static-site publishing pipeline directly from the browser, with the only server-side requirement being a GitHub Actions workflow that runs the Node.js build.

---

## Deployment strategies

### Strategy A — Full fork

Clone the entire ShadowClaw repository, add your pages to `pages/main/`, push to a new repo you own, and let CI build and deploy it.

### Strategy B — Pages-only repo (Git clone & inject in CI)

Your repo contains your content, an optional root-level `shadow-claw.config.json` (or `site-config.json`), and a GitHub Actions workflow. Content lives under `pages/`; the workflow checks out ShadowClaw as a build toolchain in CI and builds into `dist/public`.

### Strategy C — NPM Package & CLI (`npx shadow-claw`)

Run or deploy using the `shadow-claw` npm package directly:

- Locally: `npx shadow-claw dev` (or `shadow-claw run`) to preview with dev server.
- In CI: `npx shadow-claw build --prod` builds `dist/public` without needing to clone ShadowClaw or copy files.
- In `package.json`: add `"shadow-claw": "^1.22.4"` as a devDependency and run `npm run build`.

**Strategy B and Strategy C are both fully supported for content-only repositories and knowledge hubs.**

---

## Strategy B — Step-by-step

### 1. Create a new GitHub repository

Create an empty repo at `github.com/<you>/<your-site>`. Enable **Settings → Pages → Source: GitHub Actions**.

### 2. Add the workflow

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Build and Deploy via ShadowClaw

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      shadowclaw_version:
        description: "ShadowClaw npm version (e.g. latest, 1.23.3)"
        required: false
        default: "latest"

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "24"

      - name: Build static site via ShadowClaw CLI
        env:
          PAGES_ORIGIN: "https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/"
          PAGES_BASE_PATH: "/${{ github.event.repository.name }}/"
        run: |
          VERSION="${{ github.event.inputs.shadowclaw_version || 'latest' }}"
          npx --yes "shadow-claw@$VERSION" build --prod

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Version Pinning

ShadowClaw builds via `npx --yes shadow-claw@latest build --prod`. To pin to a specific npm release (e.g. `1.23.3`), specify the version in `.github/workflows/deploy-pages.yml` or supply `shadowclaw_version` when triggering the GitHub Actions workflow manually.

For a **custom apex domain** (e.g. `example.com`), override:

```yaml
PAGES_ORIGIN: "https://example.com/"
PAGES_BASE_PATH: "/"
```

### 3. Add your content

```text
pages/
  main/
    index.html        ← home page
    ~/content/
      about.md        ← any other pages
  routes.json         ← pretty-path config (optional)

shadow-claw.config.json  ← branding, default tool settings, and build configuration (optional)
```

Site configurations can also specify tool defaults under `settings`:

```json
{
  "settings": {
    "defaultToolsProfile": "__builtin_default",
    "enabledTools": ["javascript", "read_file", "write_file"]
  }
}
```

The `pages/` directory is optional. If it is absent, the build succeeds and
ShadowClaw publishes its built-in `index.html` and `MEMORY.md` Pages content.
Pretty paths are skipped unless a `routes.json` file is present.

Minimal `pages/routes.json`:

```json
{
  "routes": {
    "/pages/main/index.html": { "prettyPath": "/main" },
    "/pages/main/~/content/about.md": { "prettyPath": "/main/about" },
    "/pages/main/MEMORY.md": { "prettyPath": "/main/memory" }
  }
}
```

> **Reserved path prefixes** — the following first-path-segments are owned by
> ShadowClaw's own router and **must not** be used as pretty path prefixes:
> `/`, `/chat`, `/files`, `/tasks`, `/pages`, `/settings`, `/tools`, `/channels`.
> `/` (root) is also reserved as the default pinned page and is unreachable as
> a pretty path. Use a safe namespace like `/main/`, `/articles/`, `/docs/`, or
> any custom prefix that doesn't collide with the list above.

#### Default Pinned Page (`/`)

When visitors navigate to the root URL (`/`) of your published site, ShadowClaw displays the **default pinned page**.

**How ShadowClaw selects the default page for `/`:**

1. Both the static site prerenderer (`prerender-dsd-shell`) and runtime page store (`orchestratorStore`) gather all page files in `pages/main/`. If `pages/main/` is absent, both use the built-in default `index.html` and `MEMORY.md` pages.
2. `MEMORY.md` is always moved to the bottom of the list.
3. All remaining pages are sorted by `pages.sortOrder` from `shadow-claw.config.json` (or `site-config.json`) (`"desc"` by default, natural numeric, or `"asc"`).
4. The first file in this sorted list (`pages[0]`) becomes the default page rendered at `/`.

**How to ensure your intended home page is rendered at `/`:**
Name your landing page file so it sorts first in reverse-alphabetical order relative to other files in `pages/main/`:

- `index.md` or `index.html` will sort ahead of `about.md`, `contact.md`, or `faq.md`.
- If you have files starting with letters after `i` (e.g. `welcome.md`), `welcome.md` will sort ahead of `index.md`. Ensure your preferred landing page filename sorts highest in reverse-alphabetical order.

### 4. Push — CI does the rest

Every push to `main` triggers a build (~3–5 min on a cold runner, faster with the npm cache warm) and deploys to `https://<you>.github.io/<your-site>/`.

---

## In-browser automation (no LLM, no server)

ShadowClaw can publish to your content repo entirely from the browser using a `type: "tools"` task chain. The chain is deterministic — it makes **zero LLM calls**.

### Prerequisites

- Clone your content repo into the workspace: ask the agent to `git_clone https://github.com/<you>/<your-site>`, or do it manually.
- Configure a GitHub Personal Access Token in **Settings → Git → PAT** (needs `repo` scope for private repos, `public_repo` for public ones).

### Minimal publish chain

```json
{
  "type": "tools",
  "tools": [
    {
      "name": "write_file",
      "input": {
        "path": "repos/your-site/pages/main/post.md",
        "content": "---\ntitle: My Post\n---\n\n# Hello World\n\nContent here."
      }
    },
    {
      "name": "git_add",
      "input": {
        "repo": "your-site",
        "files": ["pages/main/post.md"]
      }
    },
    {
      "name": "git_commit",
      "input": {
        "repo": "your-site",
        "message": "publish: new post"
      }
    },
    {
      "name": "git_push",
      "input": {
        "repo": "your-site"
      }
    }
  ]
}
```

### Fetch-transform-publish chain (fully automated data pipeline)

This chain fetches an external data source, transforms it to markdown via the JavaScript sandbox, writes it as a page, and pushes — no human in the loop:

```json
{
  "type": "tools",
  "tools": [
    {
      "name": "fetch_url",
      "input": {
        "url": "https://api.github.com/repos/xt-ml/shadow-claw/releases/latest"
      }
    },
    {
      "name": "javascript",
      "input": {
        "code": "const match = $PIPE_DATA.match(/--- BEGIN EXTERNAL CONTENT[\\s\\S]*?---\\n([\\s\\S]*?)\\n--- END EXTERNAL CONTENT ---/); const raw = match ? match[1] : $PIPE_DATA; const rel = JSON.parse(raw); const date = rel.published_at?.slice(0, 10) ?? 'unknown'; return `---\\ntitle: ShadowClaw ${rel.tag_name}\\ndate: ${date}\\n---\\n\\n# ${rel.name}\\n\\nPublished: ${date}\\n\\n${rel.body ?? ''}`;",
        "data": { "$pipe": "prev" }
      }
    },
    {
      "name": "write_file",
      "input": {
        "path": "repos/your-site/pages/main/release-notes.md",
        "content": { "$pipe": "prev" }
      }
    },
    {
      "name": "git_add",
      "input": {
        "repo": "your-site",
        "files": ["pages/main/release-notes.md"]
      }
    },
    {
      "name": "git_commit",
      "input": {
        "repo": "your-site",
        "message": "shadow-claw[bot]: sync release notes"
      }
    },
    {
      "name": "git_push",
      "input": {
        "repo": "your-site"
      }
    }
  ]
}
```

---

## Strategy C — NPM Package & CLI Workflow

If you prefer building directly with `npx shadowclaw` without cloning the ShadowClaw repository in CI, use this minimal workflow:

```yaml
name: Build and Deploy via ShadowClaw CLI

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout content repo
        uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Build production bundle
        env:
          NODE_ENV: production
          PAGES_ORIGIN: "https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/"
          PAGES_BASE_PATH: "/${{ github.event.repository.name }}/"
        run: npx shadow-claw build --prod

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

> **Tip:** Wrap this in a scheduled task (Tasks sidebar → New Task → type `tools`, set a cron interval) to run the pipeline automatically, e.g. every 24 hours. No LLM calls are made at execution time.

---

## Template repository

A ready-to-fork starter template is available in the [`shadow-claw-template`](https://github.com/xt-ml/shadow-claw-template) repository. It contains the workflow, sample `pages/main/index.html`, `pages/main/~/content/about.md`, root-level `shadow-claw.config.json`, and `pages/routes.json`.
