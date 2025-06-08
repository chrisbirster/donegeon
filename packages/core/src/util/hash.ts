export async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback to Node 
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}
