import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { slugifyBlogValue } from "./blog-seo-shared.ts";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

// Give every H2/H3 a stable id (matching extractMarkdownHeadings below) so
// the public page's table-of-contents anchors actually resolve.
md.renderer.rules.heading_open = (tokens, index, options, _env, self) => {
  const inline = tokens[index + 1];
  const id = inline?.type === "inline" ? slugifyBlogValue(inline.content) : "";
  if (id) tokens[index].attrSet("id", id);
  return self.renderToken(tokens, index, options);
};

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br", "code", "img"],
  allowedAttributes: { a: ["href"], img: ["src", "alt"], h2: ["id"], h3: ["id"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || "";
      const external = /^https?:\/\//.test(href);
      return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } })
  }
};

/** Renders stored Markdown to sanitized, safe-to-inject HTML for public display. */
export function markdownToSafeHtml(markdown: string) {
  return sanitizeHtml(md.render(markdown), sanitizeOptions);
}

export type MarkdownHeading = { level: 2 | 3; text: string; id: string };

/** Lightweight heading extraction for a table-of-contents sidebar, independent of full HTML rendering. */
export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  return markdown
    .split("\n")
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const text = match[2].trim();
      return { level: match[1].length as 2 | 3, text, id: slugifyBlogValue(text) };
    })
    .filter((heading) => heading.text && heading.id);
}
