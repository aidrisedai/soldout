# SoldOut

Fill every seat of a paid program through the communities families already trust.
The organizer sets a goal; SoldOut drafts the strategy, and once it's approved, talks to every
parent who messages **JOIN** on WhatsApp, answering only from the organizer's own content,
choosing text, video or a PDF brief per answer, flagging what only the organizer can answer,
and sending the enrollment link when the parent is ready.

First customer: EdAI's Founder program (`content/edai-answer-pack.md`).

## How it works

```
/intake (goal + content) → strategy draft (diagnosis, policies + tests, who-next) → organizer approves
   → parents message "JOIN <KEYWORD>" on WhatsApp (Mobilerun cloud phone)
   → agent (Claude via Naive model proxy): fit questions → answers from content → video / PDF / text
   → unknowns, refunds, installments → organizer (dashboard reply)
   → apply link → paid → scoreboard
```

| Piece | Where |
|---|---|
| Agent + strategy + PDF brief writer | Claude Opus via **Naive** model proxy (`src/lib/llm.ts`) |
| WhatsApp | Real WhatsApp app on a **Mobilerun** cloud phone, driven by `scripts/poll.ts` (`src/lib/waPhone.ts`) |
| Videos / branded media | **Dot** (ChatGPT on the phone, connected to the organizer's Drive), via Mobilerun Agent tasks (`src/lib/dot.ts`) |
| Org research for who-next | **Monid** (CLI), organizations only |
| Data | SQLite via Prisma |

Rules the product follows: contact only people who messaged JOIN; never scrape numbers; personalize only from
what the parent says; never invent facts, stats, quotes or testimonials; refunds/installments go to the organizer;
Stripe links must be test-mode; the organizer approves the strategy before anyone is contacted.

## Deploy on Railway

1. railway.com → **New Project → Deploy from GitHub repo** → `aidrisedai/soldout`.
2. Service → **Settings → Volumes → Add volume**, mount path **`/app/data`** (database, PDFs, media cache).
3. Service → **Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/app/data/soldout.db` |
| `DASHBOARD_PASSWORD` | any password (protects dashboard, intake, simulate, APIs) |
| `NAIVE_API_KEY` | Naive key (`sk_live_…`) |
| `MOBILERUN_API_KEY` | Mobilerun key (`dr_sk_…`) |
| `MOBILERUN_DEVICE_ID` | optional; first ready cloud phone otherwise |
| `ORGANIZER_PHONE` | organizer's WhatsApp number, e.g. `+15153570454` |
| `STRIPE_PAYMENT_LINK` | optional, **test-mode** link only |
| `DOT_MAY_SHARE` | `1` only if the organizer allows Dot to make the Drive files it sends link-shareable (needed to send videos) |

4. **Settings → Networking → Generate Domain**. Open it: the landing page is public; everything else asks for the password.

`railway.json` builds with Railpack and starts `node scripts/start.mjs`, which syncs the DB schema and runs the
web app **and** the WhatsApp worker in one service. Only run **one** worker per phone (stop any local `npm run worker`).

## Run locally

```bash
npm install
cp .env.example .env   # fill in keys
npm run setup          # create DB + seed the EdAI event (optional; npm run reset for a blank slate)
npm run dev            # http://localhost:3000
npm run worker         # second terminal: WhatsApp on the Mobilerun phone
```

## Demo flow (start to finish)

1. `/` → **Start a campaign** → **Fill with EdAI example** → **Create event** (keyword `JOIN FOUNDER`).
2. `/dashboard` → the strategy drafts itself (~30 s) → **Approve**.
3. From a phone, WhatsApp `JOIN FOUNDER` to the SoldOut number → answer the fit questions.
4. Ask "Can you send me something I can share with my husband?" → the PDF brief arrives as a file.
5. Ask "Do you offer refunds?" → flagged → reply from the dashboard.
6. "We're ready to sign up" → apply link → **Mark paid** → scoreboard updates.

`/simulate` runs the same conversation without a phone.
