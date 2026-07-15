# Automatic Update Pipeline

## Overview

Users who install the Chrome Web Store build receive updates through Chrome's built-in update service. Publishing a project release triggers a workflow that rebuilds the same source, runs all verification commands, uploads the package to Chrome Web Store, and submits it for review.

The extension UI does not display the source repository address, release address, or update download address. No repository URL is embedded for update delivery.

An unpacked extension cannot replace its own installed code under Chrome's extension security model. Therefore, true unattended updates are available only to users of the Chrome Web Store build. Normal Windows and macOS users cannot silently install or update a CRX from an external host.

## One-time maintainer setup

Configure the following encrypted secrets in the `chrome-web-store` environment:

| Secret | Purpose |
| --- | --- |
| `CWS_CLIENT_ID` | Google OAuth client ID |
| `CWS_CLIENT_SECRET` | Google OAuth client secret |
| `CWS_REFRESH_TOKEN` | Refresh token with Chrome Web Store publishing scope |
| `CWS_PUBLISHER_ID` | Chrome Web Store publisher ID |
| `CWS_EXTENSION_ID` | Existing Chrome Web Store item ID |

Before adding the secrets, enable Chrome Web Store API in Google Cloud and complete the initial item creation, listing, privacy declarations, and visibility configuration in the Chrome Web Store dashboard.

## Release flow

1. Increment the version in `manifest.config.ts` and `package.json`.
2. Publish a matching `vX.Y.Z` release.
3. The workflow runs typecheck, unit tests, lint, and build.
4. The workflow packages the contents of `dist` at the ZIP root.
5. Chrome Web Store API V2 uploads the package and submits it for review.
6. After approval, Chrome distributes the update to installed users automatically.

If the required secrets are not configured, the workflow reports that store publishing was skipped without exposing secret values or failing the source release.

## Local preflight

```powershell
npm run build
npm run publish:cws:dry-run
```

The dry run validates the version and package file without sending a network request.
