import { Resource } from "sst";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { cors } from 'hono/cors';

const client = new SESv2Client();
const app = new Hono()
const AUTH_KEY = process.env.EMAIL_API_KEY

app.use('/*', cors({
  // @ts-ignore
  origin: ["auth.donegeon.com"],
  credentials: true,
  allowMethods: ['POST'],
  allowHeaders: ['Content-Type'],
}));

app.post("/", async (c) => {

  const authHeader = c.req.header('x-donegeon-auth')
  if (authHeader !== AUTH_KEY)
    return c.json({ error: 'unauthorised' }, 401);

  const { email } = await c.req.json<{ email?: string; }>();

  if (!email)
    return c.json({ error: 'email required' }, 400);
  await client.send(
    new SendEmailCommand({
      // @ts-ignore
      FromEmailAddress: Resource.MyEmail.sender,
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: "Your Dungeon Awaits",
          },
          Body: {
            Text: { Data: "Thank you for signing up for the waitlist." },
          },
        },
      },
    }))
  return c.json({ status: "ok" }, 200)
})


export const handler = handle(app);
