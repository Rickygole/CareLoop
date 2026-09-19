# Deploying CareLoop

Two pieces, two hosts, for one technical reason.

## Why the split

The judge console needs a live event stream. Vercel serverless functions
cannot hold a WebSocket open, and GitHub Pages serves static files only and
cannot run Python at all. So:

| Piece | Host |
|---|---|
| Frontend bundle | Vercel (primary), GitHub Pages (mirror) |
| FastAPI backend, including WS /trace | DigitalOcean App Platform |

DigitalOcean is also a listed prize at this event, which Vercel is not.

If you would rather run everything on Vercel, that works, but `/trace` must
stop being a WebSocket. The frontend already falls back to polling
`GET /trace/events?since=N`, so the panel looks identical to a judge. You
lose the DigitalOcean prize opt-in and nothing else.

## Backend, DigitalOcean App Platform

    doctl apps create --spec .do/app.yaml

Then set these as SECRET envs in the dashboard. Never commit them.

    GEMINI_API_KEY
    ELEVENLABS_API_KEY
    BACKBOARD_API_KEY
    CARELOOP_WEBHOOK_SECRET

`CARELOOP_WEBHOOK_SECRET` gates both the agent webhook and the trace
socket. Leave it unset locally and both are open; set it in production and
both require it. The trace stream carries patient-shaped data on a public
URL, so it must be set before judging.

Verify:

    curl https://YOUR-APP.ondigitalocean.app/health

Expect `{"status":"ok","patients_loaded":4,"gemini_configured":true}`.
If `gemini_configured` is false, Tier 1 is dark and every non-emergency
will come back MODERATE with source `fallback_error`.

## Frontend

Set `VITE_API_BASE` to the backend URL at build time, then deploy the
static bundle. See frontend/README.md.

## Deploy early, then stop moving the URL

The voice agent config holds a hardcoded webhook URL. Every URL change
means re-editing the agent and re-testing a live call. Get one stable URL
early and do not touch it again.

## Deadline caution

No commits after 09:00 Sunday. If GitHub Pages deploys via a GitHub Action,
the bot writes commits to a gh-pages branch, and a post-deadline bot commit
is an argument you do not want to have with a judge. Either deploy Pages
from /docs on main, or finish the final Pages deploy before 08:30 and
disable the workflow.
