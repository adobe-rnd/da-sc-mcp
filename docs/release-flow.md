# Release Flow

How releases work for `da-sc-mcp`: which GitHub Actions workflow runs, when, what gets deployed to Cloudflare, and what each semantic-release step does.

## Workflow at a glance

A single workflow that fans out three jobs depending on the branch:

| Job | When it runs | What it does |
|---|---|---|
| `test` | Every push | Lint + vitest |
| `test-deploy` | Push to any non-`main` branch | Deploy to the `ci` Cloudflare env, then run semantic-release in dry-run mode |
| `release` | Push to `main` | Run semantic-release: analyze commits → bump version → write CHANGELOG → tag → deploy to `ci` (prepareCmd) → deploy to `production` (publishCmd) → create GitHub Release |

Secrets used:
- `GITHUB_TOKEN` — auto-provided by GitHub Actions.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — repo secrets, needed by `wrangler deploy`. Must be configured before the first push.

## Flow 1 — push to a feature/PR branch

```
[git push feature/foo]
        │
        ▼
┌──────────────────────────────────────────────┐
│ main.yaml  (trigger: push)                   │
│                                              │
│   ┌──────────┐                               │
│   │   test   │  lint + vitest                │
│   └────┬─────┘                               │
│        │ needs: test                         │
│        ▼                                     │
│   ┌──────────────────────────────────────┐   │
│   │ test-deploy   (if: ref != main)      │   │
│   │   1. npm run deploy:ci               │   │
│   │      └─ prepare-deploy.js writes     │   │
│   │         wrangler-versioned.toml with │   │
│   │         current package.json version │   │
│   │      └─ wrangler deploy -e ci        │   │
│   │   2. semantic-release-dry            │   │
│   │      (no commits, tags, or releases) │   │
│   └──────────────────────────────────────┘   │
│                                              │
│   ┌──────────┐                               │
│   │ release  │  SKIPPED (ref != main)        │
│   └──────────┘                               │
└──────────────────────────────────────────────┘
        │
        ▼
   Worker is live in the `ci` Cloudflare env
   under the name `da-sc-mcp-ci`.
   No GitHub Release, no production deploy.
```

The dry-run prints what *would* be released if this branch were merged to `main` (next version, changelog draft). It never commits or tags.

## Flow 2 — merge to `main` with a releasable commit

A commit is releasable if its [Conventional Commits](https://www.conventionalcommits.org/) type is `feat:`, `fix:`, `perf:`, or carries a `BREAKING CHANGE:` footer.

```
[PR merged → push to main]
        │
        ▼
┌────────────────────────────────────────────────┐
│ main.yaml  (trigger: push)                     │
│                                                │
│   ┌──────────┐                                 │
│   │   test   │                                 │
│   └────┬─────┘                                 │
│        │ needs: test                           │
│        ▼                                       │
│   ┌──────────────┐                             │
│   │ test-deploy  │  SKIPPED (ref == main)      │
│   └──────────────┘                             │
│                                                │
│   ┌────────────────────────────────────────┐   │
│   │ release   (if: ref == main)            │   │
│   │                                        │   │
│   │  semantic-release:                     │   │
│   │   1. analyze commits                   │   │
│   │   2. bump package.json version         │   │
│   │   3. write CHANGELOG.md                │   │
│   │   4. prepareCmd:                       │   │
│   │       npm run deploy:ci  ───────┐      │   │
│   │       (smoke deploy with new    │      │   │
│   │        version into CI env)     │      │   │
│   │   5. commit + push package.json,│      │   │
│   │       CHANGELOG.md              │      │   │
│   │   6. tag vX.Y.Z                 │      │   │
│   │   7. publishCmd:                │      │   │
│   │       npm run deploy:production │      │   │
│   │       (deploys to `da-sc-mcp`)  │      │   │
│   │   8. create GitHub Release      │      │   │
│   └─────────────────────────────────│──────┘   │
└─────────────────────────────────────│──────────┘
                                      │
                                      ▼
                  Worker `da-sc-mcp` is live in
                  Cloudflare production at vX.Y.Z.
                  GitHub Release vX.Y.Z is published.
```

> **Note on the `v` prefix.** The git tag and GitHub Release are `vX.Y.Z` (e.g. `v1.2.3`); `package.json` and `wrangler.toml`'s `VERSION` env use bare SemVer (`1.2.3`).

## Flow 3 — merge to `main` with non-releasable commits only

`chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:` commits do **not** trigger a release.

```
[push to main with only chore/docs/test]
        │
        ▼
   main.yaml runs → test ✓ → release runs
        │
        ▼
   semantic-release: "no relevant changes, skipping release"
        │
        ▼
   no version bump, no tag, no GitHub Release, no production deploy.
```

The `ci` env deploy in `prepareCmd` is also skipped because semantic-release short-circuits before `prepare` when there's no release to make.

## Commit conventions that drive releases

| Commit prefix | Release impact |
|---|---|
| `feat: …` | minor version bump (`X.Y.0` → `X.(Y+1).0`) |
| `fix: …` | patch version bump (`X.Y.Z` → `X.Y.(Z+1)`) |
| `perf: …` | patch version bump |
| Revert commits (`git revert` style: `Revert "…"`) | patch version bump |
| `feat!: …` or footer `BREAKING CHANGE: …` | major version bump (`X.Y.Z` → `(X+1).0.0`) |
| `chore:`, `docs:`, `test:`, `refactor:`, `style:`, `ci:` | no release |

The first release ever cut by semantic-release starts at `1.0.0` regardless of the current `package.json` version.

## How version reaches the worker at runtime

`wrangler.toml` carries `VERSION = "@@VERSION@@..."` placeholders, never the real version. `prepare-deploy.js` is run by both `deploy:ci` and `deploy:production`; it reads `package.json`'s `version` field and writes `wrangler-versioned.toml` with the placeholder replaced. Wrangler is then invoked with `-c wrangler-versioned.toml`, so the deployed worker's `env.VERSION` reflects the released version.

For non-release branches, the version baked into the `ci` deploy is whatever `package.json` currently says. On `main`, semantic-release bumps `package.json` *before* `prepareCmd` runs, so the `ci` smoke deploy and the production deploy both use the new version.

## Required setup before the first release

1. **`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`** repo secrets — required by `wrangler deploy`. Token should have `Workers Scripts:Edit` permission.
2. **Branch protection** — `main` should require the `test` check to pass before merge. If you enable required reviews, `secrets.GITHUB_TOKEN` cannot push the release commit; provision a bot token with bypass rights and substitute it in the `release` job.

## Files involved

- [`.github/workflows/main.yaml`](../.github/workflows/main.yaml) — CI + deploy + release
- [`.releaserc.cjs`](../.releaserc.cjs) — semantic-release plugin configuration
- [`prepare-deploy.js`](../prepare-deploy.js) — writes `wrangler-versioned.toml` from `package.json` version
- [`wrangler.toml`](../wrangler.toml) — declares the `ci` and `production` envs with `@@VERSION@@` placeholders
- [`package.json`](../package.json) — `deploy:ci`, `deploy:production`, `semantic-release`, `semantic-release-dry` scripts
