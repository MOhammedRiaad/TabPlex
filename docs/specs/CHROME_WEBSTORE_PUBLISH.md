# Spec: Publish each release to the Chrome Web Store automatically

|             |                                                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**  | Blocked: needs the Chrome listing to exist (ROADMAP #11) · then ready · v1.1 (ROADMAP #22)                                                                                                                                                   |
| **Created** | 2026-10-05                                                                                                                                                                                                                                   |
| **Size**    | S (½ day)                                                                                                                                                                                                                                    |
| **Mirrors** | `scripts/publish-edge.mjs` and `.github/workflows/edge-publish.yml` (Edge)                                                                                                                                                                   |
| **API**     | Chrome Web Store API **v2** (`chromewebstore.googleapis.com`). Re-read Google's [Using the API](https://developer.chrome.com/docs/webstore/using-api) before implementing: endpoint names and states below were taken from it on 2026-10-05. |

## 1. Goal

When the Release workflow creates `release/tabplex-vX.Y.Z.zip`, upload it to the existing Chrome Web Store item and
submit it for review, like the Edge step. A manual workflow re-submits an existing release when that step failed.

## 2. One-time setup (owner, documented in MAINTENANCE_GUIDE)

1. First version uploaded and published **by hand** in the Developer Dashboard (the API only updates an item).
2. Google Cloud project → enable the **Chrome Web Store API**.
3. Credentials, preferred: a **service account** added in the Developer Dashboard (Publisher → Settings), JSON key
   stored as the secret `CWS_SERVICE_ACCOUNT_JSON`. Alternative: OAuth client + refresh token
   (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`), scope `https://www.googleapis.com/auth/chromewebstore`.
4. Secrets `CWS_PUBLISHER_ID` (Dashboard → Publisher → Settings) and `CWS_ITEM_ID` (the extension id).

## 3. Script `scripts/publish-chrome.mjs` (Node built-ins only, like the Edge script)

```
token     ← access token (service account: sign a JWT with RS256 via node:crypto, exchange at
            https://oauth2.googleapis.com/token; or refresh-token grant)
upload    ← POST https://chromewebstore.googleapis.com/upload/v2/publishers/{pub}/items/{item}:upload
            body = zip bytes, Content-Type application/zip, Authorization: Bearer {token}
poll      ← GET  https://chromewebstore.googleapis.com/v2/publishers/{pub}/items/{item}:fetchStatus
            until the upload is no longer in progress (state UPLOAD_IN_PROGRESS) — 5 s interval, 60 tries
publish   ← POST https://chromewebstore.googleapis.com/v2/publishers/{pub}/items/{item}:publish
```

- Exports like the Edge script (`publishToChrome`, `findReleaseZip` shared from a small `scripts/release-zip.mjs`,
  `explainFailure`), injectable `fetchImpl` and `intervalMs` for tests.
- `explainFailure`: an item already **pending review** → "The package is uploaded; publish it from the dashboard
  after review, or run Actions → Publish to stores"; `401/403` → credentials/scope hint.
- No staged rollout in v1 (`setPublishedDeployPercentage` needs > 10,000 weekly users).

## 4. Workflows

- `release.yml`: after the Edge step, `Publish to Chrome Web Store` with `if: env.CWS_ITEM_ID != ''`, run
  `npm run publish:chrome`. It must not stop the Edge step (separate step; both run with `if: always() &&
steps.release.outcome == 'success'` or equivalent so one store's failure doesn't skip the other).
- Rename `edge-publish.yml` to `store-publish.yml` ("Publish to stores") with inputs `tag` and
  `store: edge | chrome | both` (default both).

## 5. Docs

MAINTENANCE_GUIDE release steps, `release` skill, `CHROMEWEBSTORE.md` (remove "Store upload stays manual"),
ROADMAP #22.

## 6. Tests

`publish-chrome.test.mjs` with a fake API (same style as `publish-edge.test.mjs`): token request shape (service
account JWT header/claims, signature verifies with the test key), upload → poll → publish order and headers, upload
rejected, still in progress after N tries, `explainFailure` cases.
