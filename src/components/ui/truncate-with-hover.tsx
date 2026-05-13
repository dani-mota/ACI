"use client";

import { useEffect, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

interface TruncateWithHoverProps {
  /** The text to display. */
  text: string;
  /** Classes applied to the trigger span (alongside `truncate`). */
  className?: string;
  /** Classes applied to the HoverCardContent when overflowing. */
  contentClassName?: string;
}

/**
 * PRO-193: renders `text` inside a `truncate`d span and surfaces the
 * full value in a HoverCard ONLY when the rendered text actually
 * overflows its container. Short text that already fits gets no
 * hover popup — avoids redundant affordance for values the user can
 * already read.
 *
 * Implementation note: the HoverCard wrapper is always rendered (so
 * the ref + ResizeObserver chain stays attached to a stable DOM
 * node). Suppression for short text is via the controlled `open`
 * prop — when `overflowing` is false, the card can never open even
 * if Radix would otherwise fire it.
 *
 * Re-measures on resize via ResizeObserver so collapsing a sidebar
 * or resizing the window flips the affordance correctly. Initial
 * measurement is deferred to the next animation frame so layout has
 * resolved before we check `scrollWidth > clientWidth`.
 */
export function TruncateWithHover({
  text,
  className,
  contentClassName,
}: TruncateWithHoverProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setOverflowing(el.scrollWidth > el.clientWidth);
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [text]);

  return (
    <HoverCard
      open={overflowing && open}
      onOpenChange={setOpen}
      openDelay={150}
      closeDelay={200}
    >
      <HoverCardTrigger asChild>
        <span
          ref={ref}
          className={cn(
            "truncate",
            overflowing && "cursor-default",
            className,
          )}
        >
          {text}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className={cn("w-auto p-2 text-xs", contentClassName)}>
        {text}
      </HoverCardContent>
    </HoverCard>
  );
}
