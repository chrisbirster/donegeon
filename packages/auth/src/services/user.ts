export async function ensureUser(email: string) {
  const res = await fetch("https://api.donegeon.com/api/user", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Deez-Token': process.env.API_AUTH_TOKEN,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`user service ${res.status}`);
  return res.json();
}
