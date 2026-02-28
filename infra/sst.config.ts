/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const cloudflareAccountId = (process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID || "").trim();
    const cloudflareApiToken = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
    return {
      name: "donegeon-infra",
      home: "aws",
      removal: input?.stage === "production" ? "retain" : "remove",
      providers: {
        aws: {
          region: (process.env.AWS_REGION ?? "us-east-1") as any,
        },
        cloudflare: {
          apiToken: cloudflareApiToken,
        },
      },
    };
  },
  async run() {
    const authHeaderName = (process.env.DONEGEON_EMAIL_API_AUTH_HEADER || "Authorization").trim();
    const sender = (process.env.DONEGEON_EMAIL_SENDER || "no-reply@donegeon.com").trim();
    const from = (process.env.DONEGEON_EMAIL_FROM || sender).trim();

    const emailApiKey = new sst.Secret("EmailApiKey");
    const marketingDomain = resolveMarketingDomain();
    requireCloudflareConfig(marketingDomain);

    const email = new sst.aws.Email("DonegeonEmail", {
      sender,
    });

    const emailApi = new sst.aws.Function("EmailApi", {
      handler: "functions/email.handler",
      runtime: "nodejs20.x",
      timeout: "15 seconds",
      memory: "256 MB",
      url: true,
      link: [email, emailApiKey],
      environment: {
        EMAIL_SEND_AUTH_HEADER: authHeaderName,
        EMAIL_FROM: from,
      },
    });

    const marketingSite = new sst.cloudflare.StaticSite("MktSite", {
      path: "../web",
      build: {
        command: "bun run build --filter=@donegeon/marketing",
        output: "apps/marketing/dist",
      },
      domain: marketingDomain,
      errorPage: "index.html",
    });

    return {
      region: process.env.AWS_REGION ?? "us-east-1",
      sender,
      from,
      authHeaderName,
      emailApiBaseUrl: emailApi.url,
      marketingDomain,
      marketingUrl: marketingSite.url,
    };
  },
});

function resolveMarketingDomain() {
  const configured = (process.env.DONEGEON_MARKETING_DOMAIN || "").trim();
  if (configured !== "") {
    return configured;
  }
  if ($app.stage === "production") {
    return "donegeon.com";
  }
  return `${$app.stage}.donegeon.com`;
}

function requireCloudflareConfig(domain: string) {
  const accountId = (process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID || "").trim();
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
  if (accountId !== "" && apiToken !== "") {
    return;
  }
  throw new Error(
    `Cloudflare config missing for marketing deploy (${domain}). Set CLOUDFLARE_DEFAULT_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.`,
  );
}
