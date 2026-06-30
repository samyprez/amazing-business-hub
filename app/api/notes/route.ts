// app/api/notes/route.ts
// Fetches a Google Doc via the public export URL (no API key needed).
// The document must be shared "Anyone with the link can view".
// Requirements: GOOGLE_DOC_ID env var only.

import { NextResponse } from 'next/server';

export async function GET() {
  const docId = process.env.GOOGLE_DOC_ID;

  if (!docId) {
    return NextResponse.json({
      configured: false,
      title: '',
      html: '',
      error: 'GOOGLE_DOC_ID is not set in environment variables.',
    });
  }

  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=html`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rawHtml = await res.text();

    // Extract title from <title> tag
    const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Shared Notes';

    // Extract body content
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : rawHtml;

    // Strip Google's inline styles/classes but keep structure
    const cleanHtml = bodyHtml
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\sclass="[^"]*"/g, '')
      .replace(/\sstyle="[^"]*"/g, '')
      .replace(/\sid="[^"]*"/g, '')
      .replace(/<span>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return NextResponse.json({ configured: true, title, html: cleanHtml });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      title: '',
      html: '',
      error: err instanceof Error ? err.message : 'Could not fetch document.',
    }, { status: 200 });
  }
}
