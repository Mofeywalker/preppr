<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="public/logo-light.svg">
  <img src="public/logo-light.svg" alt="preppr" width="180">
</picture>

A modern, mobile-first recipe & meal-prep application with AI-powered YouTube import.

---

### Highlights

- 📱 **Mobile-First Experience** — Optimized for kitchen use and quick glancing on mobile screens.
- 📺 **YouTube & Shorts Import** — Paste any recipe link; Gemini extracts ingredients, steps, and nutrition in one pass.
- ⚖️ **Dynamic Servings Scaler** — Adjust servings on the fly with automatic ingredient recalculation.
- 🥗 **Nutritional Estimates** — Per-serving calories, protein, carbs, fats, and fiber.
- 🌍 **Internationalization** — Native English and German (`en` / `de`) UI and localized routing.
- ⚡ **Zero-Config Database** — Embedded SQLite via Drizzle ORM (single file, no external DB required).

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) + TypeScript |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Database** | SQLite via [Drizzle ORM](https://orm.drizzle.team/) + `better-sqlite3` |
| **AI / LLM** | [Vercel AI SDK](https://sdk.vercel.ai/) + OpenRouter (`gpt-5.6-luna`, `gemini-flash-3.1-images`) |
| **Media Processing** | `yt-dlp` + `ffmpeg` (automatic video transcript & audio fallback) |
| **Auth** | [Better Auth](https://www.better-auth.com/) (Email/Password + optional OIDC SSO) |
| **i18n** | [next-intl](https://next-intl-docs.vercel.app/) |

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **yt-dlp** & **ffmpeg** on your PATH (required for YouTube audio extraction):

```sh
brew install yt-dlp ffmpeg   # macOS
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

To enable AI recipe extraction and image generation:

1. Create an API key on [OpenRouter](https://openrouter.ai/).
2. Add your key to `.env`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

> [!NOTE]
> Without an API key, the core recipe app works normally. Only YouTube AI import and AI image generation require the key.

---

## Environment Variables

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `OPENROUTER_API_KEY` | For AI | — | OpenRouter API key |
| `DATABASE_PATH` | No | `./dev.db` | SQLite database file location |
| `UPLOAD_DIR` | No | `./public/uploads` | Directory for uploaded/generated images |
| `YT_DLP_PATH` | No | `yt-dlp` | Custom path to the `yt-dlp` binary |
| `APP_LOCALE` | No | `de` | Instance language (`de` or `en`) used for UI and recipe imports |
| `BETTER_AUTH_SECRET` | Prod | *auto-dev* | Secret for cookie signing and session hashing |
| `BETTER_AUTH_URL` | No | `http://localhost:3000` | Canonical app URL |
| `AUTH_DISABLE_REGISTER` | No | `false` | Disable public user registrations |
| `OIDC_CLIENT_ID` | For SSO | — | OpenID Connect Client ID |
| `OIDC_CLIENT_SECRET` | For SSO | — | OpenID Connect Client Secret |
| `OIDC_DISCOVERY_URL` | For SSO | — | OpenID Connect discovery endpoint |

---

## Docker Deployment

Run the complete app with a single command:

```sh
cp .env.example .env       # set your OPENROUTER_API_KEY
docker compose up --build # runs at http://localhost:3000
```

The database is persisted in `./data/dev.db`, and `ffmpeg` + `yt-dlp` are pre-bundled inside the Docker container.

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

---

## Project Structure

```
src/
├── app/
│   ├── [locale]/      # i18n pages (recipes, import, auth)
│   ├── api/           # API routes (recipes CRUD, import, auth)
│   ├── icon.svg       # Native SVG favicon
│   └── apple-icon.tsx # Apple touch icon generator
├── components/        # UI components, navbar, tab bar, logo
├── db/                # Drizzle schema & SQLite client
├── i18n/              # Locale routing and navigation
└── lib/               # Recipes store, AI extraction, YouTube parser
messages/              # de.json & en.json translation bundles
public/                # Static assets, SVG logos & icons
```
