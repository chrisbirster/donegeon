# Donegeon Infra (SST)

This directory provisions two things with [SST](https://sst.dev/docs/):

1. AWS SES-backed email API used by the Go backend.
2. Cloudflare-hosted marketing static site (`donegeon.com`) from `web/apps/marketing`.

## What gets created

- `sst.aws.Email` identity (`DonegeonEmail`)
- `sst.Secret` auth key (`EmailApiKey`)
- `sst.aws.Function` URL (`EmailApi`) that sends via SES
- `sst.cloudflare.StaticSite` (`DonegeonMarketingSite`) for the marketing SPA

## Prerequisites

1. AWS credentials configured locally.
2. SES sender identity verified in your AWS region.
3. Cloudflare API token and account ID:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_DEFAULT_ACCOUNT_ID`
4. `bun` installed (used to build the marketing app during deploy).

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
npm install
npx sst install
npx sst secret set EmailApiKey "<strong-random-token>" --stage production
```

## Deploy

```bash
cd infra
npx sst deploy --stage production
```

If Cloudflare throttles KV asset uploads during the marketing deploy, use the repo wrapper instead of raw `sst deploy`:

```bash
cd infra
bun ../scripts/sst-deploy-with-retry.mjs --stage production
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
  DONEGEON_EMAIL_SEND_AUTH_VALUE="<same value you set in EmailApiKey>"
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
npx sst remove --stage production
```
