import { emailApiKey } from "./secrets";

export const email = new sst.aws.Email("MyEmail", {
  sender: "verify@donegeon.com",
});

export const emailApi = new sst.aws.Function("EmailApi", {
  handler: "packages/functions/src/email.handler",
  link: [email, emailApiKey],
  url: true,
  environment: {
    EMAIL_API_KEY: emailApiKey.value,
  }
});
