# Grid Bridge (Vercel-ready)

Endpoints:
- `GET /api/ping` — health
- `POST /api/grid` — Ask Grid (reads `User Question`, writes `Grid Reply`, sets `Status=Replied`)
- `POST /api/recap` — LSS weekly recap (reads fields, writes `Recap`, sets `Status=Replied`)
- `POST /api/recap-social` — social variants from `Recap` (+ optional `Hashtags`, `CTA`)
  - Writes: `X Post` (<=280), `IG Caption`, `YT Description`, `Facebook Post`, `TikTok Caption`

## Env Vars
`OPENAI_API_KEY`, `NOTION_SECRET`, `OPENAI_MODEL` (e.g., gpt-5 or gpt-4o-mini), `LEAN_MODE` (true/false).

## Lean Mode
If `LEAN_MODE=true`:
- `/api/grid`: ~120 words, lower tokens/temperature
- `/api/recap`: 2 tight paragraphs (~120–160 words total)
- `/api/recap-social`: concise platform copy (X capped at 280)