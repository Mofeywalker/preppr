# preppr

A mobile-first recipe & meal-prep app. Add recipes manually or import them from
YouTube (videos + Shorts) with AI. German + English UI.

- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **SQLite** via Drizzle ORM + better-sqlite3 (single file, no external DB)
- **next-intl** for the `de`/`en` UI, locale-prefixed routing
- **Vercel AI SDK** + **Google Gemini** for recipe extraction, nutrition
  estimates, and image generation
- **yt-dlp** for video metadata + audio fallback when no transcript exists

## Features

- **Manual recipes** — title, description, ingredients, steps, servings, times
- **YouTube import** — paste a URL; the transcript (or audio, if no captions) is
  sent to Gemini, which returns a structured recipe + nutrition in one pass
- **Servings scaler** — change servings on the detail page; ingredient
  quantities rescale live
- **Nutrition** — per-serving calories / protein / carbs / fat / fiber
- **Images** — YouTube thumbnail by default; optional Imagen generation
- **DE + EN** — switch locale from the header

## Getting started (local)

Requires Node 20+ and `yt-dlp` + `ffmpeg` on your PATH (for YouTube import):

```sh
brew install yt-dlp ffmpeg        # macOS
npm install
cp .env.example .env               # then put your key in .env
npm run dev                       # http://localhost:3000
```

### Configure the Gemini integration

1. Open **Google AI Studio** → https://aistudio.google.com/apikey
2. Sign in with a Google account → **Create API key** (starts with `AIza…`)
3. Put it in `.env`:

   ```env
   GEMINI_API_KEY=AIza...
   ```

That single key powers:
- `gemini-2.5-flash` — recipe + nutrition extraction from transcript or audio
- `gemini-2.5-flash-image` — the "Generate image" button on the detail page

Without a key the rest of the app works; the import + image-gen routes return a
503 ("AI not configured"). A free-tier key is enough for local use.

> **Note:** the SDK in use is `@ai-sdk/google` (the Vercel AI SDK's Google
> provider), **not** `@google/generative-ai` or `@google/genai`. Swapping to
> another provider later (OpenAI, Anthropic, …) is a one-line model change in
> `src/lib/ai.ts` plus installing that provider package — the Zod schema and
> call sites stay the same.

### Environment variables

| Variable         | Required | Default      | Purpose                                  |
| ---------------- | -------- | ------------ | ---------------------------------------- |
| `GEMINI_API_KEY` | for AI   | —            | Google Gemini API key                    |
| `DATABASE_PATH`  | no       | `./dev.db`   | SQLite file path (use the volume in Docker) |
| `UPLOAD_DIR`     | no       | `/data/uploads` in Docker or `./public/uploads` | Path to store uploaded/imported images |
| `YT_DLP_PATH`    | no       | `yt-dlp`     | Override the yt-dlp binary path          |

## Run with Docker

```sh
cp .env.example .env           # add GEMINI_API_KEY
docker compose up --build     # http://localhost:3000
```

The SQLite file lives in the `./data` volume (`/data/dev.db` in the container).
The image bundles `ffmpeg` and `yt-dlp` for the YouTube import.

## Database

Schema lives in `src/db/schema.ts`; migrations are generated with Drizzle Kit:

```sh
npm run db:generate           # create a new migration after schema changes
```

Migrations run automatically on app boot (`src/db/client.ts`), so no manual
`migrate` step is needed.

## Scripts

| Script              | What it does                          |
| ------------------- | -------------------------------------- |
| `npm run dev`       | dev server                             |
| `npm run build`     | production build                       |
| `npm run start`     | run the production build               |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | eslint                                 |
| `npm run db:generate` | regenerate Drizzle migrations        |

## Project layout

```
src/
  app/[locale]/        i18n-prefixed pages (list, detail, new, edit, import)
  app/api/             recipes CRUD + import + image route handlers
  components/          UI primitives, tab bar, locale switcher, recipe form
  db/                  Drizzle schema + lazy SQLite client
  i18n/                routing, navigation, request config (next-intl)
  lib/                 recipes data access, ai.ts (Gemini), youtube.ts (yt-dlp)
messages/              de.json, en.json
drizzle/               generated SQL migrations
```
