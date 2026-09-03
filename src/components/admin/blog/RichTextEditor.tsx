"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import {
  Bold,
  Eraser,
  Eye,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Redo2,
  Undo2
} from "lucide-react";
import { calculateBlogMetrics } from "@/lib/blog-seo-shared";

function markdownStorage(editor: Editor) {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown;
}

function ToolbarButton({ active, disabled, label, onClick, children }: { active?: boolean; disabled?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-white/10 text-slate-300 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

function LinkPanel({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState(editor.getAttributes("link").href || "");

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    onClose();
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200/20 bg-slate-950/80 p-2">
      <label className="sr-only" htmlFor="blog-editor-link-url">Bağlantı adresi</label>
      <input
        id="blog-editor-link-url"
        autoFocus
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); apply(); }
          if (event.key === "Escape") onClose();
        }}
        placeholder="/hizmetler/... veya https://..."
        className="min-h-9 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-300"
      />
      <button type="button" onClick={apply} className="min-h-9 rounded-lg bg-cyan-300 px-3 text-xs font-black text-[var(--admin-text-primary)]">Uygula</button>
      {editor.isActive("link") ? <button type="button" onClick={remove} className="min-h-9 rounded-lg border border-rose-300/30 px-3 text-xs font-black text-rose-200">Kaldır</button> : null}
      <button type="button" onClick={onClose} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-300">Vazgeç</button>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (markdown: string) => void; placeholder?: string }) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        strike: false,
        underline: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }
      }),
      Placeholder.configure({ placeholder: placeholder || "İçeriği yazmaya başlayın…" }),
      Markdown.configure({ html: false, linkify: true, breaks: false, transformPastedText: true, transformCopiedText: true })
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "blog-rich-editor min-h-[420px] max-w-none rounded-b-2xl px-4 py-4 text-[15px] leading-7 text-white outline-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Blog içeriği"
      }
    },
    onUpdate: ({ editor: current }) => onChange(markdownStorage(current).getMarkdown())
  });

  useEffect(() => {
    if (!editor) return;
    const current = markdownStorage(editor).getMarkdown();
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="min-h-[460px] rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">Editör yükleniyor…</div>;
  }

  const metrics = calculateBlogMetrics(value);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-slate-950/90 p-2">
        <ToolbarButton label="Kalın" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolbarButton>
        <ToolbarButton label="İtalik" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Alt başlık (H2)" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton label="Alt başlık (H3)" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Madde işaretli liste" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></ToolbarButton>
        <ToolbarButton label="Numaralı liste" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton label="Alıntı" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16} /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Bağlantı ekle veya düzenle" active={editor.isActive("link")} onClick={() => setLinkPanelOpen((open) => !open)}><Link2 size={16} /></ToolbarButton>
        <ToolbarButton label="Bağlantıyı kaldır" disabled={!editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off size={16} /></ToolbarButton>
        <ToolbarButton label="Biçimi temizle" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser size={16} /></ToolbarButton>
        <span className="mx-1 h-6 w-px bg-white/10" />
        <ToolbarButton label="Geri al" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={16} /></ToolbarButton>
        <ToolbarButton label="Yinele" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={16} /></ToolbarButton>
        <span className="ml-auto flex gap-1">
          <ToolbarButton label="Düzenle" active={mode === "edit"} onClick={() => setMode("edit")}><Pencil size={16} /></ToolbarButton>
          <ToolbarButton label="Önizle" active={mode === "preview"} onClick={() => setMode("preview")}><Eye size={16} /></ToolbarButton>
        </span>
      </div>
      {linkPanelOpen ? <div className="border-b border-white/10 bg-slate-950/60 p-2"><LinkPanel editor={editor} onClose={() => setLinkPanelOpen(false)} /></div> : null}
      {mode === "edit" ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="blog-rich-editor min-h-[420px] max-w-none rounded-b-2xl px-4 py-4 text-[15px] leading-7 text-white" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-slate-950/90 px-4 py-2 text-xs font-bold text-slate-400">
        <span>{metrics.word_count} kelime</span>
        <span>·</span>
        <span>{metrics.reading_time} dk tahmini okuma</span>
      </div>
    </div>
  );
}
