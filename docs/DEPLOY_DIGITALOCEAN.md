# Deploy to DigitalOcean App Platform

This is an addition. The Vercel deployment is unaffected and stays live.

The spec is `.do/app.yaml`. It defines two components in one app:

- `api`, a Python service running `uvicorn main:app`, health checked on `/health`, served under the `/api` path prefix.
- `web`, a static site built from `frontend/` with Vite, serving `dist`.

App Platform trims the `/api` prefix before forwarding, so `/api/health` reaches
FastAPI as `/health`. Both components sit on the same origin, so the frontend
default API base of `/api` resolves correctly with no code change.

## Prerequisites

- `doctl` installed and a DigitalOcean API token.
- The GitHub account behind the token has granted DigitalOcean access to
  `Rickygole/CareLoop`. Do this once in the App Platform console, otherwise
  `apps create` fails on repository access.

## Create the app

```
doctl auth init
doctl apps create --spec .do/app.yaml
```

The command prints the app ID. Keep it.

## Set the secrets

The spec declares every variable by name and commits no values. Fill them in
one of two ways.

Console: Apps, then your app, then Settings, then the `api` or `web` component,
then Environment Variables. Paste each value and save. Saving triggers a rebuild.

CLI: copy `.do/app.yaml` to a local file that is never committed, add a `value:`
line under each key, then:

```
doctl apps update <app-id> --spec /path/to/local-spec.yaml
```

Service (`api`) variables, all runtime: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`,
`BACKBOARD_API_KEY`, `CARELOOP_WEBHOOK_SECRET`, `CARELOOP_CALL_TOKEN`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
`DEMO_PHONE_NUMBER`.

Static site (`web`) variables: `VITE_CALL_TOKEN`, `VITE_TRACE_TOKEN`,
`VITE_ELEVENLABS_AGENT_ID`.

`VITE_CALL_TOKEN` must equal `CARELOOP_CALL_TOKEN` and `VITE_TRACE_TOKEN` must
equal `CARELOOP_WEBHOOK_SECRET`, or the browser will be rejected by the service.

## The one gotcha

The `VITE_` variables are read by Vite at BUILD time and baked into the bundle.
They are not read at runtime. They must be set on the `web` static site
component with `scope: BUILD_TIME`, which is how the spec declares them. Setting
them on the `api` service does nothing for the frontend. Changing one has no
effect until the static site is rebuilt. Getting this wrong ships a frontend
with telephony disabled, which has already happened once on Vercel.

## Get the URL

```
doctl apps get <app-id> --format DefaultIngress,ActiveDeployment.Phase
```

The live URL looks like `https://careloop-xxxxx.ondigitalocean.app`. Check
`https://<url>/api/health` returns `{"status": "ok", ...}`.

## Redeploy

`deploy_on_push` is true, so a push to `main` rebuilds both components. To force
a deploy without a commit:

```
doctl apps create-deployment <app-id>
```

To force a rebuild that ignores the build cache, add `--force-rebuild`. Use this
after changing a `VITE_` variable if the frontend still shows the old value.

To apply a spec change:

```
doctl apps update <app-id> --spec .do/app.yaml
```

Note that this resets any values you set in the console back to the committed
spec, which is empty for every secret. Prefer editing a local uncommitted copy
of the spec that carries the values.

## Logs

```
doctl apps logs <app-id> api --type run --follow
doctl apps logs <app-id> web --type build
```
