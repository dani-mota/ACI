"use client";

/**
 * PRO-135: Thin Radix Slider wrapper styled with existing ACI tokens.
 *
 * No new design tokens. Default range is the 1-10 authoring scale used by
 * RoleDemandProfile sliders, but consumers can override via `min`/`max`/`step`.
 */

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentProps<typeof SliderPrimitive.Root> {
  className?: string;
}

function Slider({ className, value, defaultValue, ...props }: SliderProps) {
  // Multi-handle sliders are supported by Radix. ACI's PRO-135 use case is
  // single-handle, but we render one Thumb per value so the primitive stays
  // general — same approach shadcn/ui uses.
  const values = (value ?? defaultValue ?? [props.min ?? 0]) as number[];

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-aci-gold"
        />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          className={cn(
            "block h-4 w-4 rounded-full border border-aci-gold bg-background shadow-sm",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aci-gold/40",
            "hover:border-aci-gold hover:bg-aci-gold/10",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
