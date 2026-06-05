# Airy Dashboard UI — reusable theme

A drop-in **look & feel** extracted from the AM Hub: soft gradient backdrop, big
rounded white cards, a centered pill nav, navy/green/lime palette, Plus Jakarta
Sans, airy spacing. **Content-agnostic** — reuse the styling for any dashboard,
hub, or tool. The existing AM Hub is untouched; this `template/` folder is standalone.

## Files
| File | What it is |
|------|------------|
| `theme.css` | The whole design system — tokens + every component class. The one essential file. |
| `ui.jsx` | React component kit (Shell, Card, Grid, Button, Modal, Banner, Stat, Spark, …) built on `theme.css`. Needs `lucide-react`. |
| `ExampleApp.jsx` | A sample page wiring the kit together so you can see the look. |
| `README.md` | This file — usage + the **paste-into-a-new-chat prompt** below. |

## Use it in a React/Vite project
1. Copy `theme.css` + `ui.jsx` into your `src/`.
2. `npm i lucide-react`
3. Import the CSS once in your entry file: `import "./theme.css";`
4. Build your pages with `<Shell>`, `<Card>`, `<Grid>` etc. (see `ExampleApp.jsx`).
5. Add the font in `index.html`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
   ```

Plain HTML works too — just use the class names from `theme.css` (`.wrap`, `.card`, `.grid .c4`, `.btn`, `.ptabs`, …).

---

## ⤵ Paste this into a new chat to reuse the theme

> Build the UI with the **"Airy Dashboard" design system** below. Match it exactly; only the content/domain changes.
>
> **Stack:** React + Vite, plain CSS (no Tailwind/UI lib), `lucide-react` for icons, font **Plus Jakarta Sans**.
>
> **Design tokens (CSS `:root`):**
> ```
> --navy:#012939;  --green:hsl(107,58%,33%);  --lime:#A8E300;  --rain:#2b7bb9;
> --text:hsl(198,30%,18%);  --muted:hsl(197,16%,52%);  --border:hsl(200,15%,90%);
> --surface:#fff;  --card-r:24px;  --shadow:0 8px 30px rgba(1,41,57,.06);  --warn:#c0392b;
> ```
> **Page background** (the signature airy feel):
> ```
> background:
>   radial-gradient(1100px 640px at 90% 96%, rgba(168,227,0,.16), transparent 60%),
>   radial-gradient(800px 520px at 2% 2%, rgba(255,255,255,.85), transparent 55%),
>   linear-gradient(150deg,#EFEDE6 0%,#F5F3ED 48%,#F1F3E8 100%);
> ```
>
> **Rules / feel:**
> - **Airy, not dense.** Generous padding (cards ~22px), 16px gaps, lots of whitespace.
> - **Big rounded corners** everywhere: cards 24px, inputs/buttons ~11–12px, pills/chips fully rounded (30px).
> - **White cards** on the gradient, with the soft shadow and a faint 1px light border. Card header = small rounded icon tile (32px, `#F4F5EC` bg) + 16px bold title, optional right-side pill/link.
> - **Navy** for headings and active states; **green** for primary actions and positive; **lime** as a small accent; **rain** blue for info. Muted gray for secondary text.
> - **Top bar:** rounded "brand" chip on the left, a **centered floating pill-nav** (absolute, translate(-50%,-50%)) with the active tab filled navy, round 42px icon buttons + a green circular avatar on the right.
> - **Section sub-tabs** sit **right-aligned** inside the page header as a small rounded segmented control (`.ptabs`/`.ptab`, active = filled navy).
> - **12-column grid** (`.grid` + `.c3…c12`), responsive down to 6 then 1 column.
> - Numbers use tabular figures (`font-variant-numeric:tabular-nums`).
> - Big page title: 38–42px, weight 800, letter-spacing ~-1px, navy.
> - **Buttons:** primary = green filled; secondary = navy filled; ghost = white + border; "add" actions = dashed rounded pill. Hover = `brightness(1.06)`; disabled = 45% opacity.
> - **Toggles** = pill switch, green when on. **Badges/tags** = soft tinted rounded chips. **Progress** = thin rounded bar, green fill.
> - **Modals** = centered, blurred dark backdrop, 24px radius card, X top-right, actions footer with a top border; subtle rise-in animation.
> - **Inline CTA banner** = soft green gradient (`#f3f8ea→#eef5e4`) with a green icon tile, title + muted subtext, primary button, optional dismiss X.
> - **Empty states** are short muted one-liners, never blank.
> - Keep labels clean — **no explanatory helper subtext** under buttons/fields unless essential.
>
> If I provide `theme.css` and `ui.jsx`, use them directly. Otherwise generate an equivalent `theme.css` from the tokens + rules above and a small component kit (Shell, PageHead, Card, Grid, Button, Toggle, Stat/StatGrid, Badge, Tag, Bar, Banner, RowItem, Field, Modal, Empty, Spark), then build the requested screens.

---

## Component cheat-sheet (`ui.jsx`)
`<Shell brand tag tabs icons avatar>` · `<PageHead title subtitle tabs>` ·
`<Grid>` + `<Card span title icon right tint>` · `<Button variant="green|navy|ghost|pill">` ·
`<Toggle on onChange>` · `<Stat value label>` / `<StatGrid>` · `<Badge tone="green|warn|lime">` ·
`<Tag>` · `<Bar pct>` · `<Banner icon title text actionLabel onAction onDismiss>` ·
`<RowItem icon title sub end>` · `<Field label>` · `<Modal title onClose actions>` ·
`<Empty>` · `<Spark points={[…]}>`
