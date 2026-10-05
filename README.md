# ShopSense

**Your Ring camera already sees your business. ShopSense tells you what it saw.**

ShopSense is a Ring Appstore app for single-camera small shops: corner stores,
cafés, hardware shops, a Malaysian *kedai runcit*. It reuses the cameras the
shop already owns for safety and turns their motion events into plain-language
business advice:

- **Front door:** how many customers came in, the busy hours, and how many
  visitors bought something (from one number typed at closing).
- **Back door:** a delivery log that flags late and missing suppliers, plus a
  supplier on-time record.
- **The link:** insights that need both doors, e.g. *"Segar Fresh Produce's van
  arrives at 12:15 on Saturdays — inside your busiest hour. Ask them to come at
  10am."*

Built for the Amazon **Build, Ship, Shape** Developer Hackathon 2026 (Ring
track), on the **Ring Partner API** and **Amazon Bedrock**.

---

## Try it in 60 seconds

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no configuration it loads the **demo shop**:
a simulated Ring account with two cameras and four weeks of history, replaying
today at 60× speed. Watch customers arrive, the bread van at 07:10 and the
lunch rush, then enter the day's sales.

- **Replay a Saturday** (banner) shows the headline insight happening live.
- **EN / BM** switches the advice to Bahasa Melayu.
- **How it works** (ⓘ) shows each snapshot next to the exact JSON the vision
  step returned.

## Use real Ring data

| Path | How |
| --- | --- |
| Ring Playground token | Setup → paste a token from the [Ring developer console](https://developer.amazon.com/ring/console/playground). It lasts ~30 min. Tag each camera Front door / Back door. |
| Ring account link (OAuth + PKCE) | Set `RING_CLIENT_ID`, `RING_CLIENT_SECRET` (and `RING_REDIRECT_URI` if needed), then Setup → Link account. |
| ring-sandbox emulator | `pip install "ring-sandbox[server]" && ring-sandbox serve --port 8787`, set `RING_API_BASE=http://127.0.0.1:8787`. Our scenario: `contrib/ring-sandbox/shop_day.yaml`. |
| Webhooks | Register `https://<host>/api/ring/webhook` and set `RING_WEBHOOK_SECRET`; signatures are verified (HMAC-SHA256 over the raw body). |

## Turn on Amazon Bedrock

Set any standard AWS credentials (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`,
`AWS_PROFILE`, or a Bedrock API key) and `AWS_REGION`. ShopSense then:

- sends every snapshot (real Ring JPEGs, or simulated snapshots rendered to PNG)
  to a **vision model** through the Converse API, and validates the JSON reply;
- asks a **text model** for two or three sentences of advice, written only from
  numbers ShopSense computed.

Models are env vars: `BEDROCK_VISION_MODEL`, `BEDROCK_TEXT_MODEL` (default
`global.anthropic.claude-opus-5-5`). For real shops, put vision on a cheaper
model; see [docs/CRITIQUE.md](docs/CRITIQUE.md#3-ai-cost-per-shop). Without AWS
credentials the app uses **offline perception** (simulator only) and
**template advice**, and says so on screen.

## Persist data

Leave `DATABASE_URL` empty for the embedded **PGlite** database (real Postgres
in WASM, in-memory). Set it to a Supabase/Postgres URL for persistence. On
Vercel, use the pooler URL: serverless instances don't share memory, so a
deployed demo should use a real database. The schema is applied on boot
(`src/lib/db/schema.ts`).

## Lock a real shop

Set `SHOPSENSE_PASSCODE`, then open the app once as `https://<host>/?key=<passcode>`.
Setup and every route that changes data or calls Bedrock then need that
cookie; the dashboard stays readable. Leave it unset for the public demo.

## Architecture

```
Ring camera ──motion──▶ Event History (poll)  ┐
                        Webhook (push, HMAC)  ┴─▶ events (dedup by Ring id)
                                                   │
                     snapshot ◀── /media/image/download
                         │
                 Bedrock vision (Converse) ──▶ vision_result JSON
                         │
   ┌─────────────────────┼─────────────────────┐
 front brain          back brain            the link
 footfall, busy hrs   delivery visits,      delivery-in-rush,
 visitors who bought  late / missing        late-delivery sales dip
   └─────────────────────┼─────────────────────┘
                 Bedrock text ──▶ 2–3 sentences of advice (EN / BM)
                         │
                   one-screen dashboard
```

| Path | What lives there |
| --- | --- |
| `src/lib/ring/` | Ring client interface; Partner API client (OAuth, PKCE, pagination, snapshots); simulator client |
| `src/lib/vision/` | Bedrock vision prompts + validation; offline perception; provider routing |
| `src/lib/brains/` | Pure functions: `front.ts`, `back.ts`, `link.ts` |
| `src/lib/advice/` | Bedrock advice writer, EN/BM templates, cache |
| `src/lib/poller.ts` | One tick of the core loop (serverless-friendly) |
| `src/lib/sim/` | The demo shop: scenario, snapshot renderer, seeding |
| `src/app/api/` | Route handlers (dashboard, tick, sales, deliveries, cameras, Ring OAuth/webhook, cron) |
| `scripts/poller.ts` | Always-on poller (`npm run poller`) |

**Business rules** (from the spec): staff are excluded by uniform and by opening
hours; a busy hour is in the top 20% of that weekday's history; a delivery is
late when it arrives more than 30 minutes after its window, and missing when the
window passes with no visit; counts are shown with a ± band.

**Privacy:** read-only scope (`ava.v1:read`), no face recognition, front-door
images are never stored, back-door images are kept only for deliveries.

## Tests

```bash
npm test
```

- **Brain tests:** the simulator plants three stories and one red herring; the
  tests check the brains find the stories from raw events and ignore the
  herring.
- **End-to-end test:** seed → poll → vision → dashboard → advice, on a real
  Postgres (PGlite).
- **Client tests:** the Partner client against a fake Ring API, and Bedrock
  reply parsing.

## Docs

- [docs/CRITIQUE.md](docs/CRITIQUE.md): the case against the idea, and how we answer each point
- [docs/FRICTION_LOG.md](docs/FRICTION_LOG.md): Ring API friction log (bonus)
- [docs/SUBMISSION.md](docs/SUBMISSION.md): Devpost text, video script, product feedback

## License

MIT. UI components adapted from open-source libraries; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
