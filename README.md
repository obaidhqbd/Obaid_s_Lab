# Obaid's Laboratory

Production-oriented static portfolio/blog/projects system for GitHub Pages.

## Structure

- `site/` frontend shell
- `content/projects/<slug>/` project content
- `content/blogs/<slug>/` blog content
- `assets/` photos and shared assets
- `scripts/build.mjs` build + indexing + SEO generation
- `.github/workflows/deploy.yml` validation/build/deploy
- `api/chat.js` optional secure OpenRouter runtime proxy

## Local

Requires Node.js 20+.

```bash
npm install
npm run build
npm run serve
```

Build output is `dist/`.

## Content format

Each content folder can contain `content.md` and optional `cover.*`.
Front matter is optional. The build script falls back to the first heading, first paragraph, folder name, date, and available image.

Example:

```md
---
title: My project
description: One-line summary.
category: Web
tags: html, css, javascript
featured: true
pinned: true
date: 2026-09-05
live: https://example.com
github: https://github.com/example/repo
---

# My project

Long-form content here.
```

You do not need to create HTML pages manually.

## GitHub Pages

The workflow builds on every push to `main` and deploys `dist/` to GitHub Pages.

For a repository Pages URL such as `https://obaidhqbd.github.io/REPO/`, the build automatically sets the correct base path from the GitHub Actions environment.

## OpenRouter

Never put an OpenRouter key in frontend files.

The included `api/chat.js` is a Vercel-compatible serverless endpoint. Deploy it separately, add `OPENROUTER_API_KEY` as a server-side environment variable, then set:

```js
window.LAB_CONFIG = {
  aiEndpoint: "https://YOUR-PROXY-DOMAIN/api/chat"
};
```

in `site/config.js`.

The AI assistant is optional and safely falls back to local search when no endpoint exists.
