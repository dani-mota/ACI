#!/bin/bash
# Lint stage components for hardcoded color values that should use design tokens.
# Run: bash scripts/lint-stage-tokens.sh
#
# Design tokens are defined in .stage-root (globals.css).
# All assessment stage components should use var(--s-*) instead of raw hex/rgba.
#
# Allowed exceptions:
#   - rgba(255,255,255,...) for white-based opacity overlays (no token equivalent)
#   - Canvas-based components (orb, living-background) that can't use CSS vars
#   - Fallback values inside var() declarations: var(--s-blue, #2563EB) is fine

SEARCH_DIR="src/components/assessment"
EXCLUDE_DIRS="orb|background"

echo "=== Stage Token Lint ==="
echo "Scanning $SEARCH_DIR for hardcoded colors..."
echo ""

# Find hardcoded hex colors (6-char) not inside var() fallbacks
VIOLATIONS=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E '"#[0-9a-fA-F]{6}"' "$SEARCH_DIR" \
  | grep -vE "$EXCLUDE_DIRS" \
  | grep -vE 'var\(--s-' \
  | grep -vE '#ffffff|#fff')

if [ -n "$VIOLATIONS" ]; then
  echo "HARDCODED HEX VALUES (should use var(--s-*) tokens):"
  echo "$VIOLATIONS"
  echo ""
else
  echo "No hardcoded hex violations found."
fi

# Find rgba values using token colors (blue=37,99,235  green=5,150,105  gold=201,168,76  red=220,38,38)
TOKEN_RGBA=$(grep -rn --include="*.tsx" --include="*.ts" \
  -E 'rgba\((37,\s*99,\s*235|5,\s*150,\s*105|201,\s*168,\s*76|220,\s*38,\s*38|184,\s*196,\s*214)' "$SEARCH_DIR" \
  | grep -vE "$EXCLUDE_DIRS" \
  | grep -vE 'var\(--s-')

if [ -n "$TOKEN_RGBA" ]; then
  echo "RGBA VALUES USING TOKEN COLORS (consider var(--s-*) with color-mix):"
  echo "$TOKEN_RGBA"
  echo ""
else
  echo "No token-equivalent rgba violations found."
fi

if [ -z "$VIOLATIONS" ] && [ -z "$TOKEN_RGBA" ]; then
  echo "All stage components are using design tokens correctly."
  exit 0
else
  echo "---"
  echo "Fix: Replace hardcoded values with var(--s-*) tokens."
  echo "For opacity variants: use color-mix(in srgb, var(--s-token) N%, transparent)"
  exit 1
fi
