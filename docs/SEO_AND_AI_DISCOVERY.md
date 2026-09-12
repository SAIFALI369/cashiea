# SEO & AI discovery

How Cashiea is made findable by Google, Bing and AI answer engines
(ChatGPT/SearchGPT, Claude, Perplexity, Gemini/AI Overviews, Copilot).

The goal: when someone searches "cashiea", or asks an AI "best POS
app for a kirana store in India", the answer resolves to us — with
correct facts, correct pricing and a link.

---

## The core problem this solves

Cashiea is a client-rendered React SPA. Every URL used to return the
same HTML: one generic `<title>` and an empty `<div id="root">`.

Googlebot can execute JavaScript, but **most crawlers cannot**:
GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended,
Applebot-Extended, and every social link unfurler read the raw HTML
response only. They were seeing a blank page — so Cashiea could not
be quoted, summarised or recommended by any AI assistant.

The fix is a **build-time prerender**: every public route ships real
HTML with real text and real structured data.

---

## What runs at build time

`npm run build` is now:

```
tsc && npm run seo:llms && npm run seo:sitemap && vite build && npm run seo:prerender
```

| Step | Script | Output |
|---|---|---|
| `seo:llms` | `scripts/generate-llms.mjs` | `public/llms-full.txt` |
| `seo:sitemap` | `scripts/generate-sitemap.mjs` | `public/sitemap.xml` |
| `seo:prerender` | `scripts/prerender.mjs` | 37 static `.html` files in `dist/` |

The first two run **before** `vite build` because Vite copies
`public/` into `dist/`. The prerenderer runs **after**, because it
rewrites Vite's output.

### Why there is no duplicated content

`scripts/prerender-entry.ts` is bundled with esbuild so the build
scripts import the **real** TypeScript content modules
(`helpArticles.ts`, `blogPosts.ts`, `faqs.ts`, `types.ts`). Add a help
article or change a price in one place and the sitemap, `llms-full.txt`,
the JSON-LD and the static HTML all follow automatically. Nothing to
keep in sync by hand.

---

## 1. `robots.txt`

`public/robots.txt` explicitly **allows** every major AI crawler by
name — `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`,
`Claude-SearchBot`, `PerplexityBot`, `Google-Extended`,
`Applebot-Extended`, `meta-externalagent`, `CCBot` and others.

Naming them matters: several of these bots treat a missing rule as a
reason to skip, and some SaaS boilerplate blocks them by default.

`/app/` (the authenticated product) is disallowed for everyone, and
also carries an `X-Robots-Tag: noindex` response header from
`vercel.json` — private business data must never be indexed.

## 2. `llms.txt` + `llms-full.txt`

- **`/llms.txt`** — hand-written index in the emerging llms.txt
  standard: what Cashiea is, who it's for, features, pricing, and
  links to every key page. Includes a "Notes for AI assistants"
  section pinning the spelling ("Cashiea", not "Cashier") and
  forbidding invented prices.
- **`/llms-full.txt`** — generated: the entire public corpus (all 21
  help articles + 3 blog posts + FAQ + plans) in one 26 KB markdown
  file, so an agent can ingest everything in a single fetch.

Both are served as `text/plain; charset=utf-8` with CORS open.

## 3. Structured data (Schema.org / JSON-LD)

`src/lib/structuredData.ts` builds the nodes; `src/lib/routeSchema.ts`
assembles the right `@graph` per route.

| Route | Graph |
|---|---|
| `/` | Organization, WebSite, SoftwareApplication, WebPage, **FAQPage** |
| `/pricing` | + SoftwareApplication with both Offers, **FAQPage** |
| `/features` | + SoftwareApplication |
| `/help` | CollectionPage + **ItemList** of all articles |
| `/blog` | CollectionPage + **Blog** with all posts |
| `/help/*` | **TechArticle** + BreadcrumbList |
| `/blog/*` | **BlogPosting** + BreadcrumbList |
| `/app/*` | *none* — private |

Every node uses stable `@id`s so the graph cross-references itself,
and absolute URLs throughout.

**Deliberately absent: `aggregateRating` and `review`.** Faking those
is a Google manual-action risk and poisons AI answers with claims we
cannot support. A test enforces this.

The graph is baked into the static HTML *and* maintained at runtime by
`src/components/StructuredData.tsx`, so SPA navigation never leaves
stale markup behind.

## 4. Public access & rendered content

- **Static HTML per route.** Each of the 37 public URLs gets a real
  `<title>`, description, canonical, OG/Twitter tags and a readable
  body snapshot. The homepage went from ~30 indexable words to **720**;
  help and blog pages carry their full article text.
- **No flash for users.** The snapshot lives inside `#root` but is
  visually hidden via a clip-rect rule, and revealed again inside
  `<noscript>`. React's `createRoot()` replaces the container on mount,
  so users see exactly the app they saw before.
- **Vercel:** `cleanUrls: true` serves `/pricing` from `pricing.html`;
  the SPA rewrite now only catches extension-less paths that have no
  static file, so client-side routing still works for every deep link.

> **Vercel Protection:** make sure Deployment Protection (Vercel
> Authentication / Password Protection) is **disabled** for production
> in Project Settings → Deployment Protection. If it is on, every bot
> gets a login wall and none of the above is visible.

## 5. Login & signup pages

`/login` and `/signup` catch most brand-name searches, so they now
carry brand context instead of a bare form:

- A real `<h1>` on every viewport (the old one was inside a
  `hidden lg:flex` desktop panel, so mobile had none).
- `AuthSeoFooter` — one plain sentence describing Cashiea plus
  internal links to the marketing, help and legal pages, giving
  crawlers a path into the rest of the site.
- Richer titles: *"Cashiea Login — Sign in to your shop dashboard"*.

---

## After deploying: what a human still has to do

These need account access and cannot be done from the repo:

1. **Google Search Console** — add the property, verify, submit
   `https://cashiea.vercel.app/sitemap.xml`, then "Request indexing"
   for the homepage.
2. **Bing Webmaster Tools** — same. This also feeds ChatGPT and
   Copilot, which lean on the Bing index.
3. **Custom domain** — a real domain (e.g. `cashiea.com`) is worth far
   more than `*.vercel.app` for brand trust and ranking. When it is
   live, update `SITE_URL` in `src/lib/site.ts` and the `ORIGIN`
   constant in `scripts/generate-sitemap.mjs` — everything else
   follows automatically.
4. **Check Deployment Protection is off** (see above).
5. **Off-site presence** — AI models mostly repeat what third-party
   sites say. Listings on Product Hunt, G2, Capterra, Crunchbase,
   AlternativeTo and a LinkedIn page do more for AI recall than any
   on-site change.

## Validating changes

```bash
npm run build                    # regenerates everything
npx vitest run src/lib/routeSchema.test.ts
npx vite preview                 # then curl a route and read the HTML
curl -s localhost:4173/pricing | grep -o '<title>[^<]*</title>'
```

External validators: Google Rich Results Test, Schema.org validator,
and `site:cashiea.vercel.app` in Google once indexing has begun.
