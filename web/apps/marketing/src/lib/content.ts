import { marked } from "marked";

marked.use({
  gfm: true,
  breaks: true,
});

type ContentKind = "doc" | "post";

type FrontmatterValue = string | number | boolean | string[];

type Frontmatter = Record<string, FrontmatterValue>;

export type ContentEntry = {
  kind: ContentKind;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  order: number;
  publishedAt?: string;
  author?: string;
  featured: boolean;
  video?: string;
  videoLabel?: string;
  videoPoster?: string;
  body: string;
  html: string;
  excerpt: string;
  readingMinutes: number;
};

type VideoAsset =
  | {
      kind: "iframe";
      src: string;
    }
  | {
      kind: "video";
      src: string;
    };

function normalizeLines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function parseFrontmatterValue(key: string, rawValue: string): FrontmatterValue {
  const value = stripQuotes(rawValue);
  if (key === "tags") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (key === "order") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (key === "featured") {
    return value.toLowerCase() === "true";
  }
  return value;
}

function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const normalized = normalizeLines(raw);
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized.trim() };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { data: {}, body: normalized.trim() };
  }

  const frontmatterBlock = normalized.slice(4, closingIndex).trim();
  const body = normalized.slice(closingIndex + 5).trim();
  const data: Frontmatter = {};

  for (const line of frontmatterBlock.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key || !rawValue) continue;
    data[key] = parseFrontmatterValue(key, rawValue);
  }

  return { data, body };
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function slugFromPath(path: string): string {
  return path.split("/").at(-1)?.replace(/\.md$/i, "") || "";
}

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^[#>*-]+\s*/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFromBody(body: string, fallback: string): string {
  if (fallback.trim()) return fallback.trim();
  const paragraphs = body
    .split(/\n{2,}/)
    .map((section) => stripMarkdown(section))
    .filter((section) => section.length > 0);

  return paragraphs[0] || "";
}

function estimateReadingMinutes(body: string): number {
  const wordCount = stripMarkdown(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 220));
}

function createEntry(path: string, raw: string, kind: ContentKind): ContentEntry {
  const slug = slugFromPath(path);
  const { data, body } = parseFrontmatter(raw);
  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : titleFromSlug(slug);
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const category = typeof data.category === "string" && data.category.trim()
    ? data.category.trim()
    : kind === "doc"
      ? "Guides"
      : "Product";
  const tags = Array.isArray(data.tags) ? data.tags : [];
  const order = typeof data.order === "number" ? data.order : 999;
  const publishedAt = typeof data.publishedAt === "string" ? data.publishedAt.trim() : undefined;
  const author = typeof data.author === "string" ? data.author.trim() : undefined;
  const featured = typeof data.featured === "boolean" ? data.featured : false;
  const video = typeof data.video === "string" ? data.video.trim() : undefined;
  const videoLabel = typeof data.videoLabel === "string" ? data.videoLabel.trim() : undefined;
  const videoPoster = typeof data.videoPoster === "string" ? data.videoPoster.trim() : undefined;

  return {
    kind,
    slug,
    title,
    description,
    category,
    tags,
    order,
    publishedAt,
    author,
    featured,
    video,
    videoLabel,
    videoPoster,
    body,
    html: marked.parse(body) as string,
    excerpt: excerptFromBody(body, description),
    readingMinutes: estimateReadingMinutes(body),
  };
}

function sortDocs(a: ContentEntry, b: ContentEntry): number {
  return a.order - b.order || a.title.localeCompare(b.title);
}

function sortPosts(a: ContentEntry, b: ContentEntry): number {
  const left = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const right = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return right - left || a.title.localeCompare(b.title);
}

const rawDocs = import.meta.glob("../../content/docs/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const rawPosts = import.meta.glob("../../content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const docs = Object.entries(rawDocs)
  .map(([path, raw]) => createEntry(path, raw, "doc"))
  .sort(sortDocs);

export const posts = Object.entries(rawPosts)
  .map(([path, raw]) => createEntry(path, raw, "post"))
  .sort(sortPosts);

export function getDocBySlug(slug: string): ContentEntry | undefined {
  return docs.find((entry) => entry.slug === slug);
}

export function getPostBySlug(slug: string): ContentEntry | undefined {
  return posts.find((entry) => entry.slug === slug);
}

export function formatPublishDate(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function resolveVideoAsset(value: string | undefined): VideoAsset | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const youtubeMatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^?&/]+)/i);
  if (youtubeMatch) {
    return {
      kind: "iframe",
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
    };
  }

  const loomMatch = raw.match(/loom\.com\/share\/([^?&/]+)/i);
  if (loomMatch) {
    return {
      kind: "iframe",
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  if (
    raw.includes("youtube.com/embed/") ||
    raw.includes("player.vimeo.com/video/") ||
    raw.includes("loom.com/embed/")
  ) {
    return {
      kind: "iframe",
      src: raw,
    };
  }

  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(raw)) {
    return {
      kind: "video",
      src: raw,
    };
  }

  return {
    kind: "iframe",
    src: raw,
  };
}
