import Link from 'next/link';
import type { Block } from '@companio/types';
import { Prose } from './misc';

/** A blog post's body: paragraphs, headings and bullet lists, with **bold** and [links](/path). */
export function PostBody({ body }: { body: Block[] }) {
  return (
    <Prose>
      {body.map((b, i) =>
        typeof b === 'string' ? (
          <p key={i}>
            <Inline text={b} />
          </p>
        ) : 'h' in b ? (
          <h2 key={i}>{b.h}</h2>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.ul.map((li) => (
              <li key={li}>
                <Inline text={li} />
              </li>
            ))}
          </ul>
        ),
      )}
    </Prose>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <Link key={i} href={link[2]} className="font-semibold text-ink underline">
              {link[1]}
            </Link>
          );
        return part;
      })}
    </>
  );
}

/** Editing format: blank line between paragraphs, "## " for a heading, "- " for bullet points. */
export function blocksToText(body: Block[]) {
  return body.map((b) => (typeof b === 'string' ? b : 'h' in b ? `## ${b.h}` : b.ul.map((x) => `- ${x}`).join('\n'))).join('\n\n');
}

export function textToBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length === 1 && lines[0].startsWith('## ')) out.push({ h: lines[0].slice(3).trim() });
    else if (lines.every((l) => /^[-•*] /.test(l))) out.push({ ul: lines.map((l) => l.slice(2).trim()) });
    else {
      // a heading or list mixed into a paragraph block: split it up
      let para: string[] = [];
      let list: string[] = [];
      const flush = () => {
        if (para.length) out.push(para.join(' '));
        if (list.length) out.push({ ul: list });
        para = [];
        list = [];
      };
      for (const l of lines) {
        if (l.startsWith('## ')) {
          flush();
          out.push({ h: l.slice(3).trim() });
        } else if (/^[-•*] /.test(l)) {
          if (para.length) {
            out.push(para.join(' '));
            para = [];
          }
          list.push(l.slice(2).trim());
        } else {
          if (list.length) {
            out.push({ ul: list });
            list = [];
          }
          para.push(l);
        }
      }
      flush();
    }
  }
  return out;
}
