export type NewsKind = "patchnote" | "blog";

export type NewsPost = {
  slug: string;
  kind: NewsKind;
  title: string;
  date: string;
  dateLabel: string;
  summary: string;
  /** HTML dérivé du Markdown (source : apps/web/content/news/). */
  body: string;
};

type NewsFrontmatter = {
  kind?: string;
  title?: string;
  date?: string;
  dateLabel?: string;
  summary?: string;
};

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
] as const;

/**
 * Source unique des actualités joueurs : `apps/web/content/news/*.md`
 * (frontmatter YAML + corps Markdown).
 */
const rawModules = import.meta.glob("../../content/news/*.md", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInline(text: string) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  // Soft line break (trailing two spaces in Markdown)
  html = html.replace(/ {2}\n/g, "<br />\n");
  return html;
}

/** Sous-ensemble Markdown suffisant pour les patch notes. */
export function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      parts.push("<hr />");
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      parts.push(`<h${level}>${formatInline(heading[2]!.trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push(`<li>${formatInline((lines[i] ?? "").replace(/^[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      parts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,3})\s+/.test(lines[i] ?? "") &&
      !/^[-*]\s+/.test(lines[i] ?? "") &&
      !/^---+$/.test((lines[i] ?? "").trim())
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    parts.push(`<p>${formatInline(para.join("\n"))}</p>`);
  }

  return parts.join("\n");
}

function parseFrontmatter(raw: string): { meta: NewsFrontmatter; body: string } {
  const trimmed = raw.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---\n") && !trimmed.startsWith("---\r\n")) {
    return { meta: {}, body: trimmed };
  }

  const end = trimmed.indexOf("\n---", 4);
  if (end === -1) return { meta: {}, body: trimmed };

  const block = trimmed.slice(4, end).trim();
  let body = trimmed.slice(end + 4).replace(/^\r?\n/, "");
  // Skip optional closing newline after ---
  if (body.startsWith("\n")) body = body.slice(1);

  const meta: NewsFrontmatter = {};
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const key = match[1] as keyof NewsFrontmatter;
    let value = match[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body };
}

function slugFromPath(path: string) {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/i, "");
}

function dateLabelFromIso(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const day = Number(match[3]);
  const month = Number(match[2]) - 1;
  const year = match[1];
  const monthName = MONTHS_FR[month];
  if (!monthName) return date;
  return `${day} ${monthName} ${year}`;
}

function normalizeKind(value: string | undefined): NewsKind {
  return value === "blog" ? "blog" : "patchnote";
}

function loadNewsPosts(): NewsPost[] {
  const posts: NewsPost[] = [];

  for (const [path, raw] of Object.entries(rawModules)) {
    if (typeof raw !== "string") continue;
    const slug = slugFromPath(path);
    const { meta, body } = parseFrontmatter(raw);
    const date = meta.date?.trim() || slug;
    const title = meta.title?.trim() || slug;
    const summary = meta.summary?.trim() || "";
    const dateLabel = meta.dateLabel?.trim() || dateLabelFromIso(date);

    posts.push({
      slug,
      kind: normalizeKind(meta.kind),
      title,
      date,
      dateLabel,
      summary,
      body: markdownToHtml(body.trim())
    });
  }

  return posts.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.slug.localeCompare(a.slug);
  });
}

export const newsPosts: NewsPost[] = loadNewsPosts();

export function getNewsPost(slug: string) {
  return newsPosts.find((post) => post.slug === slug) ?? null;
}

export function newsKindLabel(kind: NewsKind) {
  return kind === "patchnote" ? "Patch note" : "Article";
}
