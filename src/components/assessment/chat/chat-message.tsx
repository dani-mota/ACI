"use client";

import type { ChatMessage as ChatMessageType } from "@/stores/chat-assessment-store";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAgent = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full gap-3 px-4 py-3",
        isAgent ? "justify-start" : "justify-end",
      )}
    >
      {isAgent && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-white">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAgent
            ? "bg-slate-100 text-slate-900"
            : "bg-slate-800 text-white",
          message.isStreaming && "animate-pulse",
        )}
      >
        {isAgent ? (
          <div
            className="prose prose-sm prose-slate max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1"
            dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(message.content) }}
          />
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
        {message.isStreaming && !message.content && (
          <div className="flex gap-1 py-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        )}
      </div>
      {!isAgent && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
          You
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight inline markdown renderer for agent messages.
 * Supports: **bold**, *italic*, `code`, line breaks, bulleted/numbered lists.
 * Does NOT execute scripts or allow HTML — input is escaped first.
 */
function renderSimpleMarkdown(text: string): string {
  if (!text) return "";

  // Escape HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

  // Inline code: `code`
  html = html.replace(/`(.+?)`/g, '<code class="rounded bg-slate-200 px-1 text-xs">$1</code>');

  // Line breaks → paragraphs
  html = html
    .split(/\n{2,}/)
    .map((para) => {
      // Check if this paragraph is a list
      const lines = para.split("\n");
      const isBulletList = lines.every((l) => /^\s*[-*]\s/.test(l) || !l.trim());
      const isNumberList = lines.every((l) => /^\s*\d+[.)]\s/.test(l) || !l.trim());

      if (isBulletList) {
        const items = lines
          .filter((l) => l.trim())
          .map((l) => `<li>${l.replace(/^\s*[-*]\s/, "")}</li>`)
          .join("");
        return `<ul class="list-disc pl-4">${items}</ul>`;
      }
      if (isNumberList) {
        const items = lines
          .filter((l) => l.trim())
          .map((l) => `<li>${l.replace(/^\s*\d+[.)]\s/, "")}</li>`)
          .join("");
        return `<ol class="list-decimal pl-4">${items}</ol>`;
      }

      return `<p>${para.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  return html;
}
