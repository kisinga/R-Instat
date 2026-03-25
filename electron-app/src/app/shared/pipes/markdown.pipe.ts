/**
 * Lightweight markdown-to-HTML pipe.
 *
 * Supports a subset of markdown: bold, inline code, fenced code blocks,
 * bullet lists, numbered lists, and headers (##). No external dependency.
 */

import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    const html = markdownToHtml(value);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    // Fenced code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre class="bg-base-200 rounded p-2 text-xs font-mono overflow-x-auto my-2"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList(result, inList);
        inList = null;
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      closeList(result, inList);
      inList = null;
      const level = headerMatch[1].length;
      const text = inlineFormat(headerMatch[2]);
      const cls = level === 1 ? 'text-base font-bold mt-3 mb-1' : level === 2 ? 'text-sm font-semibold mt-2 mb-1' : 'text-sm font-medium mt-1 mb-0.5';
      result.push(`<p class="${cls}">${text}</p>`);
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inList !== 'ul') {
        closeList(result, inList);
        result.push('<ul class="list-disc list-inside space-y-0.5 my-1">');
        inList = 'ul';
      }
      result.push(`<li>${inlineFormat(bulletMatch[1])}</li>`);
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)$/);
    if (numMatch) {
      if (inList !== 'ol') {
        closeList(result, inList);
        result.push('<ol class="list-decimal list-inside space-y-0.5 my-1">');
        inList = 'ol';
      }
      result.push(`<li>${inlineFormat(numMatch[2])}</li>`);
      continue;
    }

    // Regular paragraph (or empty line)
    closeList(result, inList);
    inList = null;

    if (line.trim() === '') {
      result.push('<br/>');
    } else {
      result.push(`<p class="my-0.5">${inlineFormat(line)}</p>`);
    }
  }

  // Close any unclosed blocks
  if (inCodeBlock) {
    result.push(`<pre class="bg-base-200 rounded p-2 text-xs font-mono overflow-x-auto my-2"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  closeList(result, inList);

  return result.join('\n');
}

function closeList(result: string[], inList: 'ul' | 'ol' | null): void {
  if (inList === 'ul') result.push('</ul>');
  if (inList === 'ol') result.push('</ol>');
}

function inlineFormat(text: string): string {
  let result = escapeHtml(text);
  // Bold: **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code class="bg-base-200 rounded px-1 py-0.5 text-xs font-mono">$1</code>');
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
