# Donegeon Infra (SST 4)

This directory provisions two things with [SST](https://sst.dev/docs/):

1. AWS SES-backed email API used by the Go backend.
2. Cloudflare Workers static-assets hosting for the marketing SPA (`donegeon.com`) from `web/apps/marketing`.

The project pins SST `4.17.1` in `package.json` and commits `package-lock.json` so CI and deployment use the same infrastructure toolchain.

## What gets created

- `sst.aws.Email` identity (`DonegeonEmail`)
- `sst.Secret` auth key (`EmailApiKey`)
- `sst.aws.Function` URL (`EmailApi`) running on Node.js 24 and sending via SES
- `sst.cloudflare.StaticSiteV2` (`MktSite`) for the marketing SPA

## Prerequisites

1. Node.js 22+ and npm 10+.
2. AWS credentials configured locally.
3. SES sender identity verified in your AWS region.
4. Cloudflare API token and account ID:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_DEFAULT_ACCOUNT_ID`

## Install

```bash
cd infra
npm ci
```

## Environment

Required:

```bash
export CLOUDFLARE_API_TOKEN="<cloudflare-api-token>"
export CLOUDFLARE_DEFAULT_ACCOUNT_ID="<cloudflare-account-id>"
```

Optional:

```bash
export AWS_REGION=us-east-1
export DONEGEON_EMAIL_SENDER=no-reply@donegeon.com
export DONEGEON_EMAIL_FROM=no-reply@donegeon.com
export DONEGEON_EMAIL_API_AUTH_HEADER=Authorization

# Defaults to donegeon.com on production, <stage>.donegeon.com otherwise
export DONEGEON_MARKETING_DOMAIN=donegeon.com
```

## First-time setup

```bash
cd infra
npm ci
npx --no-install sst install
EMAIL_API_KEY="$(openssl rand -hex 32)"
npx --no-install sst secret set EmailApiKey "$EMAIL_API_KEY" --stage production
```

## Validate

Before deployment, the same checks used by CI can be run locally:

```bash
cd infra
npm ci
npx --no-install sst install
npm run check
npm audit --omit=dev --audit-level=high
```

## Deploy

```bash
cd infra
npm ci
npx --no-install sst deploy --stage production
```

The repository wrapper retries a complete SST deploy when Cloudflare returns a rate-limit response; it does not patch SST internals:

```bash
cd infra
node ../scripts/sst-deploy-with-retry.mjs --stage production
```

Capture outputs:
- `emailApiBaseUrl`
- `authHeaderName`
- `marketingDomain`
- `marketingUrl`

Then set Fly secrets in the API app:

```bash
fly secrets set \
  DONEGEON_OTP_MAIL_PROVIDER=sst \
  DONEGEON_TEAM_INVITE_MAIL_PROVIDER=sst \
  DONEGEON_EMAIL_SEND_URL="<emailApiBaseUrl>send" \
  DONEGEON_EMAIL_SEND_AUTH_HEADER="<authHeaderName>" \
  DONEGEON_EMAIL_SEND_AUTH_VALUE="$EMAIL_API_KEY"
```

Deploy/restart Fly:

```bash
fly deploy
```

## Stripe billing env (app backend)

Set these Fly secrets for Stripe checkout + webhook handling:

```bash
fly secrets set \
  DONEGEON_STRIPE_SECRET_KEY="sk_live_..." \
  DONEGEON_STRIPE_WEBHOOK_SECRET="whsec_..." \
  DONEGEON_STRIPE_PRICE_PRO="price_..." \
  DONEGEON_STRIPE_CHECKOUT_SUCCESS_URL="https://app.donegeon.com/team/settings?billing=success" \
  DONEGEON_STRIPE_CHECKOUT_CANCEL_URL="https://app.donegeon.com/team/settings?billing=canceled"
```

Then redeploy app:

```bash
fly deploy
```

## Remove

```bash
cd infra
npm ci
npx --no-install sst remove --stage production
```

## License

The Donegeon-authored source and documentation in this directory are licensed under the GNU Affero General Public License v3.0. Third-party dependencies retain their upstream licenses.
