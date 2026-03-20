import { useEffect, useRef, useState } from "react";

/**
 * Hook for ARIA-compliant radiogroup keyboard navigation.
 *
 * Provides:
 * - Arrow key navigation (Up/Down/Left/Right) with wrapping
 * - Enter/Space to select the focused option
 * - Roving tabindex management (only focused item is tabbable)
 * - Focus tracking state
 *
 * Usage:
 *   const { groupRef, focusedIndex, setFocusedIndex, getItemProps } = useRadiogroupKeys({
 *     itemCount: options.length,
 *     onSelect: (index) => handleSelect(options[index]),
 *     disabled: !!selected,
 *   });
 *
 *   <div ref={groupRef} role="radiogroup">
 *     {options.map((opt, i) => (
 *       <button {...getItemProps(i)} role="radio" aria-checked={...}>
 *         {opt}
 *       </button>
 *     ))}
 *   </div>
 */
export function useRadiogroupKeys({
  itemCount,
  onSelect,
  disabled = false,
}: {
  itemCount: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!groupRef.current) return;
      const buttons = groupRef.current.querySelectorAll<HTMLElement>('[role="radio"]');
      if (!buttons.length) return;

      // Fix: PRO-15 — skip keyboard shortcuts when text input is focused
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = (focusedIndex + 1) % itemCount;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = (focusedIndex - 1 + itemCount) % itemCount;
        setFocusedIndex(next);
        buttons[next]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(focusedIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, focusedIndex, itemCount, onSelect]);

  const getItemProps = (index: number) => ({
    tabIndex: index === focusedIndex ? 0 : -1,
    onFocus: () => setFocusedIndex(index),
  });

  return { groupRef, focusedIndex, setFocusedIndex, getItemProps };
}
