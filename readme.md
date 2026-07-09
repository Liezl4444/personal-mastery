# GIBS Personal Mastery: Lead from Within — Campaign Experience

A mobile-first microlearning web app supporting a sponsored professional
development course, built for World Mental Health Awareness Month 2026.
Live at **gibs-personal-mastery.netlify.app**.

This document exists so that anyone — Liezl in six months, a new team
member, or another AI assistant — can understand what this app is, how it's
built, and how to safely change it, without having to re-derive any of this
from scratch.

---

## 1. What this app does

A visitor lands on a single-page app and moves through one continuous
journey:

1. **Entry** — a hook screen: campaign branding, testimonials about the
   course facilitator (Dr Frank Magwegwe), a "Find out more" button.
2. **About** — context on the course, the sponsored-seat offer (100 free
   seats), and a short framing paragraph before the reflection begins.
3. **Photo + name + consent** — the visitor adds a photo (stays on their
   device only, never uploaded) and their name.
4. **Three reflection prompts** — open-ended questions about their story,
   vision, and next step.
5. **AI-generated reflection** — the three answers are sent to Claude
   (via the `reflect` function), which writes back a short first-person
   reflection *as the future version of that person*. This is the
   emotional core of the app.
6. **Course taster** — a six-screen "nugget" flow (one idea per screen,
   Instagram-style, not a long scroll) introducing the actual GIBS
   Personal Mastery course: a hook quote, a video from Dr Magwegwe,
   benefits, a self-rating exercise, a reflective pause, and a close.
7. **Application form** — name/contact details plus three required
   commitment checkboxes (completion dates, hours, device access).
8. **Confirmation** — the application is saved and two emails go out
   (see §4).

Every screen was built to be **WCAG-compliant, mobile-first, and
low-bandwidth-conscious** — this is a free, sponsored offering, and a
meaningful share of the audience will be on data-constrained connections.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  index.html                                              │
│  Single-file SPA: all screens, CSS, and JS in one file.  │
│  Screens are <section class="screen"> elements toggled   │
│  via showScreen(id) — no routing, no build step.         │
└─────────────────────────────────────────────────────────┘
              │                              │
              │ POST /.netlify/functions/    │ POST /.netlify/functions/
              │ reflect                      │ signup
              ▼                              ▼
┌───────────────────────────┐   ┌──────────────────────────────────┐
│  netlify/functions/        │   │  netlify/functions/               │
│  reflect.js                │   │  signup.js                        │
│  Calls the Anthropic API   │   │  Validates the application,       │
│  to generate the personal  │   │  writes it to Netlify Blobs,      │
│  reflection response.      │   │  sends 2 emails via SendGrid      │
└───────────────────────────┘   │  (confirmation + admin notice).   │
              │                  └──────────────────────────────────┘
              ▼                              │
     api.anthropic.com                       ├──► Netlify Blobs
                                              │    (store: pm-applications)
                                              └──► api.sendgrid.com
```

**Why one HTML file, not a framework?** This was a deliberate choice for a
two-person team (Liezl + Claude) with no dedicated engineering support —
no build step, no dependency tree to break, easy to hand-edit, and trivial
to deploy (drag-and-drop or git push, either works).

**Why Node's `https` module instead of `fetch()` in the Netlify
Functions?** Netlify's Functions runtime has not reliably had a global
`fetch()` across all Node versions it supports. `reflect.js` was written
this way from the start; `signup.js` originally used `fetch()` for its
SendGrid calls, which is almost certainly why applications were being
processed (and stored) but emails were silently never sending — the
`fetch` call likely threw, was caught, logged, and swallowed. This was
fixed in July 2026 — see §7.

---

## 3. File structure

```
/
├── index.html                       ← the entire app
├── netlify.toml                     ← Netlify build/deploy config
├── assets/
│   ├── personal-mastery-hero.jpg    ← entry-screen hero image
│   ├── personal-mastery-icon.png    ← brand icon (lightbulb/tangle)
│   ├── small-icon-personal-mastery.png  ← icon for the taster topbar badge
│   ├── personal-mastery-about-white.png    ← benefits reveal, "before" state
│   ├── personal-mastery-about-colour.png   ← benefits reveal, "after" state
│   └── personal-mastery-own-your-mastery-image.png  ← taster closing screen
└── netlify/
    └── functions/
        ├── reflect.js                ← generates the AI reflection
        └── signup.js                 ← handles applications: storage + email
```

**Naming convention:** all filenames and folders are lowercase. This is
not a style preference — it's a hard requirement. Netlify's servers are
Linux, which is case-sensitive; a folder named `Functions` instead of
`functions` deploys fine locally on Windows and then fails silently (or
mysteriously) in production. This bit us once already.

---

## 4. Environment variables

Set these in **Netlify Dashboard → Site settings → Environment variables**.
None of them belong in the code or in git.

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | `reflect.js` | Claude API key for generating reflections |
| `SENDGRID_API_KEY` | `signup.js` | SendGrid API key for outbound email |
| `FROM_EMAIL` | `signup.js` | The verified sender address emails go out from |
| `GIBS_ADMIN_EMAIL` | `signup.js` | Where new-application notifications land |

**`FROM_EMAIL` must be a SendGrid-verified sender** — either through full
domain authentication (recommended: authenticate `gibs.co.za`) or, at
minimum, single sender verification for that exact address. SendGrid
silently rejects every send from an unverified address. This is the
single most likely cause if emails stop again after this fix — check
**SendGrid Dashboard → Settings → Sender Authentication** first.

Netlify Blobs does **not** need a manually-configured token or site ID
when called from inside a Netlify Function — `getStore({ name })` alone
picks up the deploy context automatically. (An earlier version of
`signup.js` passed a manual `siteID`/`token` that were never actually
set as env vars, which may also have been silently breaking storage —
fixed alongside the email issue.)

---

## 5. Design system

All tokens live at the top of `index.html`'s `<style>` block:

- **Colours:** navy `#002c77` (primary), teal `#007378` (focus rings,
  accents), gold `#E4A024` (primary CTA, rewards), purple `#5c2f6f`
  (used sparingly), stone greys for surfaces.
- **Type:** Inter for UI text, a serif (Playfair-style) for quotes and
  reflective moments — the serif is deliberately reserved for emotional
  beats, not everyday UI.
- **Components are reused deliberately.** For example, the taster
  screen's "reflect" moment reuses the exact `.laotzu-panel` styling
  built for the main reflection flow, and its self-rating sliders reuse
  the same visual language as the checkbox rows elsewhere. When adding
  new screens, check whether an existing pattern already does the job
  before inventing a new one.

## 6. Accessibility

This was built to WCAG AA as a first-class requirement, not an
afterthought:

- Every screen transition moves focus and announces via a live region.
- All custom controls (sliders, tabs, carousels) use real ARIA roles,
  not just visual approximations.
- Touch targets are ≥44×44px throughout.
- `prefers-reduced-motion` is respected globally — animations and
  transitions are disabled, not just slowed.
- Decorative images use `alt=""`; meaningful images (like the hero quote
  card, which has text baked into the graphic) carry a full text
  alternative in the `alt` attribute.

If you're extending this app, match this bar — it's not optional polish.

---

## 7. Known issues and recent fixes

**Fixed, July 2026 — applications weren't generating emails.**
`signup.js` used `fetch()` for its SendGrid calls; Netlify's Function
runtime doesn't reliably provide it, so the calls likely threw, were
caught, and silently swallowed — every application still saved fine (or
tried to) and the user always saw success, but no email ever sent, and
nothing in the response indicated a problem. Rewritten to use the same
`https`-module pattern already proven in `reflect.js`, with actual
response-status checking and logging so failures are visible in the
Netlify function logs going forward, instead of invisible.

**Still open — no admin visibility into applications.**
Applications are stored in Netlify Blobs (`pm-applications` store, one
JSON record per applicant, keyed by application ID) but there is
currently no way to browse, filter, or export them short of writing a
one-off script against the Blobs API. Liezl has asked for something
Trailblazer-like: a login-gated admin view showing applicant count,
completion status, and a CSV export filterable by date. This is real,
non-trivial scope — a second authenticated surface reading from the same
store — and should be built deliberately, with Danhesree looped in given
it will display applicant PII (name, email, phone) and POPIA sign-off
was still pending as of this writing. Proposed next step: a
password- or token-gated `/admin` page backed by a new
`list-applications` function that reads all Blob keys and returns them
as JSON/CSV.

**Still open — POPIA sign-off.**
Four data touchpoints still need formal legal sign-off: the application
form, the (possible) testimonials/community wall, the Anthropic API
cross-border processing disclosure, and the photo upload. Do not treat
the app as fully compliant until this is confirmed.

---

## 8. Deployment

Git-connected to Netlify — pushing to `main` triggers a deploy
automatically.

```bash
git add .
git commit -m "..."
git push origin main
```

Check the deploy log in the Netlify dashboard after every push,
especially after touching anything under `netlify/functions/` — function
build failures don't always block the site deploy, so it's worth
confirming both the site *and* the functions built cleanly.

To test image/asset paths locally before pushing, serve the folder over
HTTP (not `file://`) — root-relative paths like `/assets/...` resolve
differently under `file://` and will falsely appear broken:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

---

## 9. Key people

- **Liezl Wagenaar** — learning experience designer, sole builder, owns this repo
- **Asogaran Shunmoogam** — IT/technical governance, editorial review
- **Farzana Ally** — Lead Management, academic/content lead, sign-off
- **Danhesree Moodley** — governance and POPIA oversight, CC'd on all project communication
- **Dr Frank Magwegwe** — course facilitator and content owner

---

## 10. If you're an AI assistant picking this up

Read this file first. Then:

- The single most important file is `index.html` — read it before making
  any change, even a small one; a lot of care has gone into consistent
  design tokens and reused patterns, and it's easy to accidentally
  introduce a one-off that breaks that consistency.
- Test any CSS change by actually rendering it (headless browser
  screenshot or equivalent) — this file has previously shipped with a
  stray unmatched `}` that silently broke styling for a large chunk of
  the page. Don't trust that CSS "looks right" from reading it alone.
- This app is for a South African audience — use SA/UK English spelling
  (recognise, honour, organisation) in any new copy.
- Don't add copyrighted, AI-generated stock imagery, or placeholder
  content that looks unfinished — every asset in this app was
  deliberately chosen or created for the brand.
