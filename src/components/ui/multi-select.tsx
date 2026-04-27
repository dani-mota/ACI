"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 inline-flex items-center justify-between gap-2 border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted/40 transition-colors min-w-[140px]",
            className,
          )}
        >
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
            {triggerLabel}
          </span>
          <span className="flex items-center gap-1">
            {selected.length > 0 && (
              <span
                onClick={clear}
                className="text-muted-foreground hover:text-foreground"
                role="button"
                aria-label="Clear selection"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-[220px]">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">No options</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 rounded">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(option.value)}
                    />
                    <span className="text-foreground">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
