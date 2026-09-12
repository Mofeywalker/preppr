<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="public/logo-light.svg">
  <img src="public/logo-light.svg" alt="preppr" width="180">
</picture>

A modern, mobile-first recipe & meal-prep application with AI-powered YouTube and web import, Tandoor migration, and full PWA support.

---

### Highlights

- 📱 **Mobile-First Kitchen Experience** — Clean, touch-optimized UI designed for effortless reading and cooking in the kitchen.
- 📺 **YouTube & Shorts AI Import** — Paste any cooking video link; AI extracts structured ingredients, step-by-step instructions, and macro nutrition in one pass.
- 🌐 **Universal Web & Recipe Scraping** — Import from virtually any food blog or cooking site via Schema.org JSON-LD parsing with AI fallback and automated metric conversions (e.g. cups/oz to g/ml, °F to °C).
- 📲 **Progressive Web App (PWA) & Share Target** — Installable on iOS, Android, and desktop with offline support. Preppr registers as a native OS Share Target—share recipe links directly from YouTube or browser apps with one tap.
- 📦 **Tandoor & Full Archive Migration** — Live sync and batch import from any Tandoor instance via API token, or migrate via Tandoor ZIP/JSON. Export and restore complete Preppr backups including photos.
- ⚖️ **Dynamic Servings Scaler** — Adjust portions on the fly with instant, proportional ingredient recalculations.
- 🥗 **Nutritional Macro Tracking** — Per-serving calories, protein, carbs, fats, and fiber with on-demand AI macro estimation.
- 🖨️ **DIN A4 Printable Recipe Cards** — Formatted printable recipe cards with customizable classic or compact layouts, optimized for kitchen binders and clean PDF export.
- 🎨 **Light & Dark Themes** — Modern dark and light modes with system preference auto-detection and seamless manual toggle.
- 👥 **Multi-User & Recipe Sharing** — Built-in authentication with email/password and optional OpenID Connect (OIDC) SSO. Control public/private recipe visibility and fork shared recipes.
- 🌍 **Internationalization** — Configurable instance language (`de` or `en`) with native localized routing.
- ⚡ **Zero-Config Database** — Embedded SQLite via Drizzle ORM (single file, automatic schema migrations on boot).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) + TypeScript |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Database** | SQLite via [Drizzle ORM](https://orm.drizzle.team/) + `better-sqlite3` |
| **AI / LLM** | [Vercel AI SDK](https://sdk.vercel.ai/) + OpenRouter (`gpt-5.6-luna`, `google/gemini-3.1-flash-image`) |
| **Media Processing** | `yt-dlp` + `ffmpeg` (automatic video transcript & audio fallback) |
| **Recipe Scraping** | [Cheerio](https://cheerio.js.org/) + Schema.org/Recipe JSON-LD parser |
| **PWA & Mobile** | Service Worker, Web App Manifest, Web Share Target API, Android TWA Digital Asset Links |
| **Auth** | [Better Auth](https://www.better-auth.com/) (Email/Password + optional OIDC SSO) |
| **i18n** | [next-intl](https://next-intl-docs.vercel.app/) |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **yt-dlp** & **ffmpeg** on your PATH (required for YouTube audio extraction):

```sh
brew install yt-dlp ffmpeg   # macOS
sudo apt install ffmpeg && pip install yt-dlp  # Ubuntu / Debian
```

### Installation

1. **Clone & install dependencies:**
   ```sh
   git clone https://github.com/your-username/preppr.git
   cd preppr
   npm install
   ```

2. **Configure environment:**
   ```sh
   cp .env.example .env
   ```

3. **Start the local development server:**
   ```sh
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## OpenRouter AI Configuration

To enable AI recipe extraction, nutrition estimation, and AI image generation/refinement:

1. Create an API key on [OpenRouter](https://openrouter.ai/).
2. Add your key to `.env`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   # Optional: customize the image generation model (default: "google/gemini-3.1-flash-image")
   # OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image
   ```

> [!NOTE]
> Without an API key, core recipe management, manual creation, local JSON-LD web imports, scaling, and printing work normally. Only YouTube AI import, AI web fallback, AI macro calculation, and AI food photo generation/enhancement require the key.

---

## Environment Variables

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `OPENROUTER_API_KEY` | For AI | — | OpenRouter API key |
| `OPENROUTER_IMAGE_MODEL` | No | `google/gemini-3.1-flash-image` | Model used for AI photo generation and thumbnail enhancement |
| `DATABASE_PATH` | No | `./dev.db` | SQLite database file location |
| `UPLOAD_DIR` | No | `./public/uploads` | Directory for uploaded/generated images |
| `YT_DLP_PATH` | No | `yt-dlp` | Custom path to the `yt-dlp` binary |
| `APP_LOCALE` | No | `de` | Instance language (`de` or `en`) used for UI and recipe imports |
| `BETTER_AUTH_SECRET` | Prod | *auto-dev* | Secret for cookie signing and session hashing |
| `BETTER_AUTH_URL` | No | `http://localhost:3000` | Canonical app URL |
| `AUTH_DISABLE_REGISTER` | No | `false` | Disable public email/password user registrations |
| `AUTH_DISABLE_EMAIL_LOGIN` | No | `false` | Disable email/password login entirely (SSO only, requires OIDC) |
| `OIDC_CLIENT_ID` | For SSO | — | OpenID Connect Client ID |
| `OIDC_CLIENT_SECRET` | For SSO | — | OpenID Connect Client Secret |
| `OIDC_DISCOVERY_URL` | For SSO | — | OpenID Connect discovery endpoint |
| `OIDC_PROVIDER_NAME` | No | `SSO` | Display name for OIDC login button |
| `OIDC_SCOPES` | No | `openid profile email` | Requested OAuth scopes |

---

## Docker Deployment

Run the complete app with a single command:

```sh
cp .env.example .env       # set your OPENROUTER_API_KEY
docker compose up --build # runs at http://localhost:3000
```

Persistent volumes are mapped to `./data`:
- Database is stored at `./data/dev.db`
- Uploaded and AI-generated photos are stored at `./data/uploads`
- `ffmpeg` and `yt-dlp` are pre-bundled inside the container image.

---

## Database Management

Schema definitions reside in `src/db/schema.ts`. Migrations run automatically on app boot.

```sh
npm run db:generate   # Generate a new Drizzle migration after schema changes
```

---

## Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start local development server |
| `npm run build` | Build production bundle |
| `npm run start` | Run production server |
| `npm run typecheck` | Run TypeScript validation (`tsc --noEmit`) |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run icons:generate` | Regenerate PWA icons, maskables, and Apple touch icon |

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/             # Localized routes (recipes, import, print, auth)
│   ├── api/                  # API endpoints (recipes CRUD, batch, import, export, auth, uploads)
│   ├── manifest.ts           # PWA Web App Manifest configuration
│   ├── icon.svg              # Native SVG favicon
│   └── apple-icon.tsx        # Apple touch icon generator
├── components/               # UI components, printable recipe card, theme toggle, navbar
├── db/                       # Drizzle schema, migrations runner & SQLite client
├── i18n/                     # Locale routing, request config, and navigation
└── lib/                      # Recipe store, AI pipelines, JSON-LD scraper, Tandoor & ZIP archive handlers
drizzle/                      # Generated SQL migrations
messages/                     # de.json & en.json translation bundles
public/                       # Static assets, PWA icons, Service Worker (sw.js), offline page
scripts/                      # Build & asset scripts (PWA icon generator)
```
