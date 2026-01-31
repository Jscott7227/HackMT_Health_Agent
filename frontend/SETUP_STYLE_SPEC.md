# Setup Page Style Spec

Use this as the reference when updating other HTML pages to match the style and feel of [`frontend/html/setup.html`](frontend/html/setup.html).

---

## Overall style and feel

- **Calm, nature-inspired, wellness-focused.** Forest green and earthy clay tones, soft gradients, light motion (floating orbs, subtle grain).
- **Card-on-background.** Main content lives in a single white card (max-width 520px) over a full-viewport animated background. No heavy chrome; focus on the card.
- **Typography:** Serif for headlines (Crimson Pro), sans-serif for body and UI (DM Sans). Step labels are small-caps style (uppercase, letter-spacing). Copy is centered in the flow; microcopy and disclaimers are small and muted.
- **Interactions:** Buttons and cards have hover lift and soft transitions. Primary actions use a sage green gradient; secondary actions are outlined. Selected state uses sage border and light shadow.
- **No topbar on setup.** Setup is a full-screen onboarding flow with no navigation bar. Other pages can add the topbar but should keep the same background and container treatment for consistency.

---

## Page structure (HTML)

1. **`<body data-page="...">`** — Set a `data-page` value for page-specific JS/CSS if needed.
2. **`#benji-root`** — Optional; keep if other scripts expect it.
3. **Background (required for this look):**
   ```html
   <div class="background-layers">
       <div class="grain"></div>
       <div class="gradient-orb orb-1"></div>
       <div class="gradient-orb orb-2"></div>
       <div class="gradient-orb orb-3"></div>
   </div>
   ```
4. **Main content shell:** A wrapper that centers content. On setup this is `.onboarding-shell` > `.onboarding-card`. For other pages, use `.container` (max-width 900px, padded) or the same shell pattern so the card/section sits over the background.

---

## Background

- **Defined in:** [`frontend/css/styles.css`](frontend/css/styles.css) — “Animated Background Layers” (around lines 1021–1112).
- **`.background-layers`** — `position: fixed`, full viewport, `z-index: -1` (or `0` when used with `.container` at `z-index: 1`). Non-interactive (`pointer-events: none`).
- **`.grain`** — Full-screen SVG noise, very low opacity (~0.03), slow animated shift for texture.
- **`.gradient-orb`** — Large blurred circles with `border-radius: 50%`, `filter: blur(80px)`, soft opacity (~0.6). Three orbs:
  - **orb-1:** Sage/forest green, top-right.
  - **orb-2:** Lighter green, bottom-left.
  - **orb-3:** Mint, center.
- **Animation:** `float` keyframes (gentle translate + scale) with staggered delays; `grain-shift` for the grain. “Breathing” feel, not fast or distracting.

---

## Layout and card

- **Onboarding shell:** `.onboarding-shell` — flex column, min-height 100vh, centered, padded (`var(--space-lg)` / `var(--space-md)`).
- **Card:** `.onboarding-card` — width 100%, max-width 520px, white background, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-lg)`, thin border `var(--border-color)`. Entry animation: `fadeInUp`.
- **Other pages:** Use `.container` for a single column (max-width 900px, padded). If you want a “card” look, reuse the same card styles (white, radius, shadow, border) so it feels like setup.

---

## CSS variables (theme)

From `:root` in [`frontend/css/styles.css`](frontend/css/styles.css):

| Purpose | Variable | Example use |
|--------|----------|-------------|
| Display font | `--font-display` | Headlines (Crimson Pro) |
| Body font | `--font-body` | Body, buttons, inputs (DM Sans) |
| Primary green | `--sage`, `--sage-dark`, `--sage-light` | CTAs, progress, selected states, links |
| Background | `--bg-primary` (e.g. `--cream`) | Page background tint |
| Surfaces | `--clay-50`, `--clay-100`, `--clay-200` | Card backgrounds, option cards, inputs |
| Text | `--text-primary` (`--clay-800`), `--text-secondary`, `--text-muted` | Headlines, body, microcopy |
| Border | `--border-color` | Card and input borders |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Cards and buttons |
| Spacing | `--space-xs` … `--space-2xl` | Padding and gaps |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` | Buttons, inputs, cards |
| Transitions | `--transition-fast`, `--transition-base`, `--transition-breathing` | Hover and animations |

---

## Typography (classes and usage)

| Class | Font | Size (approx) | Color | Use |
|-------|------|----------------|-------|-----|
| `.ob-headline` | Crimson Pro | 2rem | `--clay-800` | Main screen title; center-aligned |
| `.ob-step-label` | DM Sans | 0.8125rem | `--sage` | “Step X” / section label; uppercase, letter-spacing |
| `.ob-subtext` | DM Sans | 0.9375rem | `--text-secondary` | Short description under headline |
| `.ob-microcopy` | DM Sans | 0.8125rem | `--text-muted` | Hint text, “You can change this later” |
| `.ob-disclaimer` | DM Sans | 0.75rem | `--text-muted` | Legal/privacy or “optional” notes |

Headlines are centered, line-height ~1.25. Subtext and microcopy are centered with comfortable line-height (~1.5–1.6).

---

## Progress indicator (setup-specific but reusable)

- **Strip:** `.ob-progress-strip` — full width, 4px height, `--clay-100` background.
- **Fill:** `.ob-progress-fill` — gradient `linear-gradient(90deg, var(--sage-light), var(--sage))`, width updated by JS, smooth transition.

Use the same strip/fill pattern on other multi-step flows for consistency.

---

## Buttons

- **Primary CTA (`.ob-cta`):** Full width, padded. Background: `linear-gradient(135deg, var(--sage-light), var(--sage))`, white text, `--radius-lg`, sage shadow. Hover: slight lift (`translateY(-2px)`), stronger shadow. Disabled: `--clay-200` background, no shadow.
- **Secondary (`.ob-cta-secondary`):** Full width, transparent, border `1.5px solid var(--sage)`, text `--sage-dark`. Hover: `--forest-50` background.
- **Skip / text link (e.g. `.ob-skip-link`):** No background, sage color, underline. Hover: `--sage-dark`.

Use `.ob-cta` for the main action and `.ob-cta-secondary` for “Edit” or “Back” on other pages where you want the same feel.

---

## Option cards (single- or multi-select)

- **List:** `.ob-option-list` or `.ob-multiselect-list` — flex column, small gap.
- **Card:** `.ob-option-card` / `.ob-multi-card` — full width, flex row, icon + label + check. Background `--clay-50`, rounded `--radius-md`, 2px transparent border. Hover: `--clay-100`, light border, slight `translateX(3px)`. Selected: white background, `--sage` border, light green shadow. Optional `.ob-option-helper` under label for small muted hint text.
- **Checkmark:** Circular border, selected state fills with sage and shows check. Same idea for multi-select (`.ob-multi-check`).

Reuse these classes (or the same patterns) for any single/multi-select list on other pages.

---

## Scales (1–5 or similar)

- **Wrapper:** `.ob-labeled-scale` — margin below.
- **Question:** `.ob-scale-question` — 0.9375rem, primary color.
- **Track:** `.ob-scale-track` — flex row of pips.
- **Pip:** `.ob-scale-pip` — flex, contains `.ob-pip-dot` (circle) and `.ob-pip-label` (small text below). Selected: dot filled sage, label sage-dark. Hover: dot border sage-light, slight lift.

Use the same scale pattern for any 1–5 or N-point scale on other pages.

---

## Form inputs (numeric, text)

- **Row:** `.ob-metric-row`, `.ob-imperial-row` — flex, gap.
- **Input:** `.ob-metric-input` — flex:1, padded, rounded, `--clay-50` background, border. Focus: white background. Placeholder: `--clay-300`. Number inputs: spin buttons removed.
- **Unit toggle:** `.ob-unit-toggle` with `.ob-unit-btn` — pill-style; active: white, sage-tinted border or fill.
- **Label:** `.ob-imperial-label` — small, next to inputs (e.g. “ft”, “in”, “lb”).

Use the same input and unit-toggle styles on profile, settings, or any form page.

---

## Sliders

- **Wrap:** `.ob-slider-wrap` — padding, optional labels above/below.
- **Input:** `input.ob-slider` — full width, custom thumb (large, rounded, sage). Track uses clay/sage tones.
- **Current value:** `.ob-slider-current` — centered text below slider.

Use the same class names for range inputs elsewhere.

---

## Collapsible section

- **Container:** `.ob-collapsible` — optional `.open` for expanded.
- **Trigger:** `.ob-collapsible-trigger` — text + arrow (e.g. “Add a short reflection ›”), sage color, hover darker.
- **Body:** `.ob-collapsible-body` — `max-height: 0` when closed, expanded (e.g. 200px) when open; transition for smooth open/close.
- **Input inside:** e.g. `.ob-reflection-input` — full width, rounded, clay-50 background, placeholder muted.

Reuse this pattern for any “optional extra” block on other pages.

---

## Font loading (head)

Setup uses Google Fonts in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
```

Then [`../css/styles.css`](frontend/css/styles.css). Use the same link block on every page that should match this style so fonts and weights are consistent.

---

## Checklist for updating another HTML page to match setup

- [ ] Add `data-page="..."` on `<body>`.
- [ ] Include the same Google Fonts preconnect + stylesheet in `<head>` and `../css/styles.css`.
- [ ] Add `.background-layers` with `.grain` and `.gradient-orb.orb-1`, `.orb-2`, `.orb-3`.
- [ ] Wrap main content in a centered layout (e.g. `.container` or `.onboarding-shell` + card-like wrapper).
- [ ] Use `--font-display` (Crimson Pro) for page/section titles and `--font-body` (DM Sans) for body and UI.
- [ ] Use theme variables for colors (sage, clay, text-primary/secondary/muted) instead of hard-coded hex.
- [ ] Use spacing/radius/transition variables (`--space-*`, `--radius-*`, `--transition-*`).
- [ ] Primary buttons: same style as `.ob-cta` (sage gradient, white text, hover lift). Secondary: outline style like `.ob-cta-secondary`.
- [ ] Any single/multi-select list: reuse `.ob-option-list` / `.ob-option-card` (or equivalent) and selected state.
- [ ] Forms: reuse `.ob-metric-input`, `.ob-unit-toggle`, `.ob-scale-*` patterns where applicable.
- [ ] Optional: progress strip at top if the page is a multi-step flow.
- [ ] If the page has a topbar, keep it; ensure `.background-layers` stays behind content (z-index) and `.container` or card stays consistent with this spec.

---

*This spec is derived from [`frontend/html/setup.html`](frontend/html/setup.html) and [`frontend/css/styles.css`](frontend/css/styles.css). Update the spec if the setup theme changes.*
