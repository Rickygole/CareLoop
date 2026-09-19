# CareLoop frontend

Two client-side screens on Vite plus React plus Tailwind. No framework
runtime, no charting library, no animation library. The build output is a
static bundle that runs unchanged on Vercel and on GitHub Pages.

    /#/dashboard     patient portal
    /#/admin-demo    judge console

Routing is hash based on purpose. A hash route needs no server rewrite, so
the same `dist/` works at a domain root on Vercel and under `/<repo>/` on
GitHub Pages. Typing `/dashboard` by hand still works: a short script in
index.html rewrites a known path to its hash form before React loads.

## Run it

    npm install
    npm run dev

The backend is expected at http://localhost:8000. Start it from the repo
root with:

    .venv/bin/python -m uvicorn main:app --reload --port 8000

## Environment

Copy `.env.example` to `.env` to change any of these.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000` | Base URL of the CareLoop API. The only value that has to change to repoint the whole frontend. |
| `VITE_TRACE_TOKEN` | empty | Shared secret appended to the trace WebSocket when the backend sets `CARELOOP_WEBHOOK_SECRET`. |
| `VITE_TRACE_TRANSPORT` | `auto` | `auto` tries the WebSocket first. `poll` skips it and polls `/trace/events` only, which is what a Vercel-hosted backend needs. |

Vite inlines these at build time, so a change needs a rebuild and redeploy.

## The trace transport

WebSocket first. If the socket fails or closes, the panel starts polling
`GET /trace/events?since=N` every 500ms immediately, so events keep arriving
while it retries the socket every 2s, up to 5 times. After that it stays on
polling. While degraded, the log shows `[connection lost, reconnecting]`
inline with the attempt count.

Polling is a first class path, not dead code: set `VITE_TRACE_TRANSPORT=poll`
and the whole console runs on it. A judge cannot tell which transport is
live except from the label in the panel header.

## The fairness chart

`src/components/FairnessChart.jsx` reads `src/data/eval_results.json`, which
is a committed file. It is never fetched and the model is never called from
the chart.

While that file has `"placeholder": true` the chart renders an explicit
"awaiting eval run" state with empty bars. The only thing that should ever
write real numbers into it is `eval/export_chart.py`, at the end of a real
scoring run.

## Design system

Tokens live in `src/index.css` under `@theme`. Type scale, spacing, and
color are defined there and nowhere else. Two rules worth keeping:

- Severity is never carried by hue alone. Every tier badge has a text label
  and its own glyph, so it survives grayscale and colorblindness.
- Motion answers "where did this come from". Entrances are 200ms ease-out,
  the medication list staggers 60ms per card, and everything collapses under
  `prefers-reduced-motion`.

## Build

    npm run build
    npm run preview

### Vercel

Import the repo root. `vercel.json` builds `frontend/` and serves
`frontend/dist`. Set `VITE_API_BASE` to the public backend URL in project
settings, and set `VITE_TRACE_TRANSPORT=poll` if that backend cannot hold a
WebSocket open.

### GitHub Pages

Build locally and publish `frontend/dist`. The bundle uses relative asset
paths, so it works from a project subpath without configuration. Copy
`dist/index.html` to `dist/404.html` if you want hand-typed deep links to
resolve.
