"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CREATE_PREFIX = "__create__:";

interface TaxonomyComboboxProps {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  placeholder: string;
  emptyLabel: string;
  id?: string;
  disabled?: boolean;
}

export function TaxonomyCombobox({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  id,
  disabled,
}: TaxonomyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const exactMatch = options.find((o) => o === trimmed);
  const ciMatch = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;

  function commit(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (trimmed.length === 0) return;
    if (exactMatch) {
      commit(exactMatch);
    } else if (ciMatch) {
      // Decision 8: case-insensitive match wins over create — avoid accidental dupes
      commit(ciMatch);
    } else {
      commit(trimmed);
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "h-9 w-full inline-flex items-center justify-between gap-2 border border-input bg-background px-3 text-sm transition-colors",
            "hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          )}
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {value.length > 0 ? value : placeholder}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[220px]"
      >
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search or type to add new..."
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>
              {options.length === 0 && trimmed.length === 0
                ? emptyLabel
                : trimmed.length === 0
                  ? "Type to search..."
                  : null}
            </CommandEmpty>
            {options.length > 0 && (
              <CommandGroup heading="Existing">
                {options.map((option) => {
                  const isSelected = option === value;
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => commit(option)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {option}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup heading="Add new">
                <CommandItem
                  // Prefix the value so cmdk's filter never hides this item
                  value={`${CREATE_PREFIX}${trimmed}`}
                  onSelect={() => commit(trimmed)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create &ldquo;{trimmed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
