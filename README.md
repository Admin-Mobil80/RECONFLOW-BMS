# ReconFlow — BMS

Internal business management system for ReconFlow: a Vite + React + TypeScript
SPA. Not a public site.

Part of the [WingTheIdea](https://github.com/Admin-Mobil80) group.

Served at **https://bms.reconflow.wingtheidea.com**.

## Stack

- Vite 7, React 19, TypeScript, React Router (client-side routing)
- Builds to `dist/`, hosted from a folder of the shared private bucket
  `wingtheidea-webapps-231427841372` behind CloudFront (OAC)

## Local development

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # tsc --noEmit
npm run build      # -> dist/
```

## Access

**There is no authentication yet.** The CloudFront distribution is publicly
reachable, so do not put anything sensitive in this app until auth is in place.

## Deploying

Push to `main`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — infrastructure
comes from the `reconflow-bms` CDK stack in
[RECONFLOW-BACKEND](https://github.com/Admin-Mobil80/RECONFLOW-BACKEND), never
from the console.
