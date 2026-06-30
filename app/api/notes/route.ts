// app/api/notes/route.ts
// Fetches a Google Doc via the Docs REST API (API key auth, no OAuth).
// Requirements:
//   GOOGLE_DOCS_API_KEY  — API key from Google Cloud Console (Docs API enabled)
//   GOOGLE_DOC_ID        — the document ID from the Google Docs URL
// The document must be shared "Anyone with the link can view".

import { NextResponse } from 'next/server';

type TextStyle = { bold?: boolean; italic?: boolean; underline?: boolean };
type TextRun = { content?: string; textStyle?: TextStyle };
type ParagraphElement = { textRun?: TextRun };
type Bullet = { listId?: string; nestingLevel?: number };
type ParagraphStyle = { namedStyleType?: string; alignment?: string };
type Paragraph = { elements?: ParagraphElement[]; paragraphStyle?: ParagraphStyle; bullet?: Bullet };
type StructuralElement = { paragraph?: Paragraph };
type DocBody = { content?: StructuralElement[] };
type GoogleDoc = { title?: string; body?: DocBody; revisionId?: string };

function parseDoc(doc: GoogleDoc): { title: string; html: string } {
  const title = doc.title ?? 'Untitled';
  const blocks = doc.body?.content ?? [];
  const htmlParts: string[] = [];

  for (const block of blocks) {
    const para = block.paragraph;
    if (!para) continue;

    const style = para.paragraphStyle?.namedStyleType ?? 'NORMAL_TEXT';
    const isBullet = !!para.bullet;
    const nestLevel = para.bullet?.nestingLevel ?? 0;

    // Build inline HTML from text runs
    const inline = (para.elements ?? [])
      .map((el) => {
        const run = el.textRun;
        if (!run || !run.content) return '';
        let text = run.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Trim trailing newline from last run in paragraph (Google adds one)
        text = text.replace(/\n$/, '');
        if (!text) return '';
        const ts = run.textStyle ?? {};
        if (ts.bold)      text = `<strong>${text}</strong>`;
        if (ts.italic)    text = `<em>${text}</em>`;
        if (ts.underline) text = `<u>${text}</u>`;
        return text;
      })
      .join('');

    if (!inline.trim()) continue;

    const indent = nestLevel > 0 ? ` style="margin-left:${nestLevel * 20}px"` : '';

    if (isBullet) {
      htmlParts.push(`<li${indent}>${inline}</li>`);
    } else if (style === 'HEADING_1') {
      htmlParts.push(`<h1>${inline}</h1>`);
    } else if (style === 'HEADING_2') {
      htmlParts.push(`<h2>${inline}</h2>`);
    } else if (style === 'HEADING_3') {
      htmlParts.push(`<h3>${inline}</h3>`);
    } else {
      htmlParts.push(`<p>${inline}</p>`);
    }
  }

  return { title, html: htmlParts.join('\n') };
}

export async function GET() {
  const key   = process.env.GOOGLE_DOCS_API_KEY;
  const docId = process.env.GOOGLE_DOC_ID;

  if (!key || !docId) {
    return NextResponse.json({
      configured: false,
      title: '',
      html: '',
      error: 'GOOGLE_DOCS_API_KEY and GOOGLE_DOC_ID are not set in environment variables.',
    });
  }

  try {
    const res = await fetch(
      `https://docs.googleapis.com/v1/documents/${docId}?key=${key}`,
      { next: { revalidate: 60 } } // cache 60 s
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
    }
    const doc = await res.json() as GoogleDoc;
    const { title, html } = parseDoc(doc);
    return NextResponse.json({ configured: true, title, html });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      title: '',
      html: '',
      error: err instanceof Error ? err.message : 'Could not fetch document.',
    }, { status: 200 }); // 200 so the client shows the error gracefully
  }
}
