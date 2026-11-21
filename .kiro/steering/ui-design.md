---
inclusion: fileMatch
fileMatchPattern: ["src/**/*.tsx", "src/**/*.css", "src/design-system/**", "src/shell/**", "scripts/ui/**"]
---

# Shikshit UI: the house style for every screen

Shikshit is a classic, premium school system. It should feel like a well-bound register: calm, exact and trustworthy.
Never copy another product's layout, colours, icons, wording, name or logo. The functional research in the docs repo
(`docs/pie360-audit`) says **what** a screen must do; it is never a visual reference.

## Use what exists, in this order
1. `src/design-system`: `Button` (variants primary, secondary, ghost, danger, destructive; sizes sm, md, lg),
   `Input` (label, hint, error, `leading` icon, `revealable`), `Card`, `PageHeader` (eyebrow, title, description,
   actions), `Sheet` and `ConfirmDialog` (Radix Dialog), `Logo`, `LogoMark`, `cx` (merges Tailwind classes).
2. `src/crud/CrudPage` + a descriptor for any list/add/edit screen. Do not hand-build a table for a master.
3. `src/crud/SearchPicker` (via `remote.search`) for any choice from a list that can grow past 200 (students,
   guardians, users).
4. Only then a new component, added to `src/design-system` with a test.

Libraries already installed (exact versions): `lucide-react` (icons), `@radix-ui/react-dialog`,
`@radix-ui/react-tooltip`, `cmdk` (command palette), `sonner` (toasts), `class-variance-authority`,
`tailwind-merge`, `@fontsource-variable/inter`, `@fontsource-variable/source-serif-4`. Ask before adding another UI
library; never add Bootstrap, MUI, Ant, Chakra or a second icon set.

## Tokens, never raw values
- Colours come from `@shikshit/shared` through `src/styles/tokens.css` (generated: `npm run tokens:gen`). Use the
  Tailwind names: `bg-canvas`, `bg-surface`, `bg-subtle`, `text-fg`, `text-fg-muted`, `text-fg-subtle`, `border-line`,
  `border-line-subtle`, `bg-accent`, `text-accent-fg`, `bg-accent-subtle`, status `text-success|warning|danger|info`
  with `-bg` and `-line`, brand `bg-brand-ink`, `bg-brand-gold`, `bg-brand-gold-soft`. No hex codes in components.
- Gold is decoration: rules, markers, the logo arc. It is below 4.5:1 on white, so never use it for text on light
  backgrounds. On ink it is fine.
- Shadows: `shadow-soft` (controls), `shadow-card` (cards), `shadow-float` (sheets, dialogs, palette).
- Type: `font-display` (Source Serif 4) for page titles, card titles and brand lines; Inter for everything else.
  Page title `font-display text-3xl font-semibold tracking-tight`. Eyebrows: `text-xs font-semibold uppercase
  tracking-[0.14em] text-accent-fg` with a short gold rule. Body text is 16 px; never smaller than 12 px.
- Radius: `rounded-md` for controls, `rounded-lg` for cards, `rounded-xl` for the palette. Spacing on the 4 px scale.

## Layout and states
- Pages start with `PageHeader`. Main content is in `Card`s on the warm canvas; leave generous white space.
- Every data view has loading, empty (icon + one sentence + the next action), error (message + Try again) and
  "not permitted" states. Never a blank screen.
- Forms open in a `Sheet`; anything destructive asks in a `ConfirmDialog` and uses `variant="destructive"`.
- Success is a `toast.success(...)` from sonner; keep an `sr-only` `role="status"` live region for screen readers.
- Status values render as pills (CrudPage does this for a `status` column).
- Responsive: phone 390 px, tablet 768 px, desktop 1440 px. The sidebar collapses below 1024 px.

## Accessibility (WCAG 2.2 AA, required)
- Every control has a visible label or an `aria-label`; icon-only buttons need `aria-label` and a `Hint` tooltip.
- Icons next to text are `aria-hidden="true"`.
- Focus is always visible (`focus-visible:` ring); dialogs trap focus (Radix does).
- Touch targets at least 40 px on web, 48 px on mobile.
- Respect `prefers-reduced-motion` (handled globally in `shell.css`); motion stays under 250 ms.

## Words
Plain, warm and short. Sentence case. Say what happens ("Student added."), never "Success!". No exclamation marks.

## Before you say a UI change is done
Run the `ui-review` skill: `tsc`, eslint (0 warnings), vitest, `npm run ui:review` (screenshots + axe), and look at
the screenshots yourself.
