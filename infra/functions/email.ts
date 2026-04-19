import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { Resource } from "sst";

const ses = new SESv2Client({});
const linked = Resource as unknown as Record<string, { value?: string; sender?: string } | undefined>;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

type SendPayload = {
  to?: string;
  subject?: string;
  text?: string;
  otpCode?: string;
  expiresAt?: string;
};

function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getHeader(headers: Record<string, string | undefined>, headerName: string): string {
  const expectedKey = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === expectedKey) {
      return trim(value);
    }
  }
  return "";
}

function stripBearerPrefix(value: string): string {
  const trimmed = trim(value);
  return /^bearer\s+/i.test(trimmed) ? trimmed.replace(/^bearer\s+/i, "").trim() : trimmed;
}

function decodeBase64Candidate(value: string): Buffer | null {
  const trimmed = trim(value);
  if (trimmed === "" || !/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    return null;
  }

  const padding = trimmed.length % 4;
  if (padding === 1) {
    return null;
  }

  const normalized = trimmed + "=".repeat((4 - padding) % 4);
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 0) {
    return null;
  }

  const canonical = decoded.toString("base64").replace(/=+$/g, "");
  if (canonical !== normalized.replace(/=+$/g, "")) {
    return null;
  }

  return decoded;
}

function authValuesMatch(actualValue: string, expectedValue: string): boolean {
  const expected = trim(expectedValue);
  if (expected === "") {
    return true;
  }

  const expectedVariants = Array.from(new Set([expected, stripBearerPrefix(expected)])).filter(Boolean);
  const actualVariants = Array.from(new Set([trim(actualValue), stripBearerPrefix(actualValue)])).filter(Boolean);

  for (const actual of actualVariants) {
    for (const candidate of expectedVariants) {
      if (actual === candidate) {
        return true;
      }

      const actualDecoded = decodeBase64Candidate(actual);
      const expectedDecoded = decodeBase64Candidate(candidate);
      if (actualDecoded && expectedDecoded && actualDecoded.equals(expectedDecoded)) {
        return true;
      }
    }
  }

  return false;
}

function bodyText(payload: SendPayload): string {
  const text = trim(payload.text);
  if (text !== "") {
    return text;
  }
  const code = trim(payload.otpCode);
  if (code === "") {
    return "";
  }
  const expiresAt = trim(payload.expiresAt);
  if (expiresAt === "") {
    return `Your Donegeon one-time code is ${code}.`;
  }
  return `Your Donegeon one-time code is ${code}. It expires at ${expiresAt}.`;
}

function normalizedPath(event: APIGatewayProxyEventV2): string {
  const rawPath = trim(event.rawPath);
  if (rawPath !== "") {
    return rawPath;
  }
  return trim(event.requestContext?.http?.path) || "/";
}

function resolveFromAddress(): string {
  const explicit = trim(process.env.EMAIL_FROM);
  if (explicit !== "") {
    return explicit;
  }
  const identity = trim(linked.DonegeonEmail?.sender);
  if (identity.includes("@")) {
    return identity;
  }
  return identity === "" ? "no-reply@donegeon.com" : `no-reply@${identity}`;
}

function authorizationError(event: APIGatewayProxyEventV2): string {
  const expectedValue = trim(linked.EmailApiKey?.value);
  if (expectedValue === "") {
    return "";
  }
  const headerName = trim(process.env.EMAIL_SEND_AUTH_HEADER) || "Authorization";
  const actualValue = getHeader(event.headers ?? {}, headerName);
  if (authValuesMatch(actualValue, expectedValue)) {
    return "";
  }
  return `missing or invalid ${headerName} header`;
}

async function handleSend(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const authErr = authorizationError(event);
  if (authErr !== "") {
    return json(401, { error: authErr });
  }

  let payload: SendPayload = {};
  try {
    payload = event.body ? (JSON.parse(event.body) as SendPayload) : {};
  } catch {
    return json(400, { error: "invalid json" });
  }

  const to = trim(payload.to);
  if (!isLikelyEmail(to)) {
    return json(400, { error: "invalid or missing 'to' email address" });
  }

  const from = resolveFromAddress();
  if (!isLikelyEmail(from)) {
    return json(500, { error: "configured EMAIL_FROM is not a valid email address" });
  }

  const subject = trim(payload.subject) || "Your Donegeon login code";
  const text = bodyText(payload);
  if (text === "") {
    return json(400, { error: "missing email body; provide 'text' or 'otpCode'" });
  }

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
          ToAddresses: [to],
        },
        Content: {
          Simple: {
            Subject: {
              Data: subject,
              Charset: "UTF-8",
            },
            Body: {
              Text: {
                Data: text,
                Charset: "UTF-8",
              },
            },
          },
        },
      }),
    );
  } catch (error) {
    const details = trim(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    return json(502, {
      error: "email send failed",
      details,
    });
  }

  return json(200, { ok: true });
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const path = normalizedPath(event);
  const method = trim(event.requestContext?.http?.method).toUpperCase();

  if (path === "/healthz" && method === "GET") {
    return json(200, { ok: true });
  }

  if (path !== "/send") {
    return json(404, { error: "not found" });
  }
  if (method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  return handleSend(event);
}
