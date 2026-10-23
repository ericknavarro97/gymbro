import { extendTailwindMerge } from "tailwind-merge";

const merge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["xs", "sm", "md", "lg", "xl", "2xl"],
    },
    classGroups: {
      "font-family": ["font-display", "font-sans"],
      shadow: ["shadow-card"],
      "max-w": ["max-w-app"],
    },
  },
});

/**
 * className joiner + Tailwind conflict resolution (tailwind-merge): falsy
 * parts are dropped and later utilities win, so `cx("px-4", "px-2")` → "px-2".
 * Use it for every component that accepts `className`.
 */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return merge(parts.filter(Boolean).join(" "));
}
