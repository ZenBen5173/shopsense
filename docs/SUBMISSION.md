# Submission kit: Build, Ship, Shape 2026, Ring track

Deadline: **23 Oct 2026, 12:00 PM PT**. Submit at https://amazonappdev2026.devpost.com/.
Mini challenges to tick: **AWS Builder** and **Open Source**. Attach the friction log.

---

## Checklist

- [x] Public GitHub repo with the MIT LICENSE visible: https://github.com/ZenBen5173/shopsense
- [x] Deployed URL, free to test, no login: https://shopsense-khaki.vercel.app (switch to the Neon database before judging, see README)
- [ ] Video **under 3 minutes**, public on YouTube or Vimeo, in English
- [ ] One recording with AWS credentials set, so the screen says "Written by Claude on Amazon Bedrock"
- [ ] One live Ring Playground token pasted on camera (Setup → Ring Playground token)
- [x] Ring availability in Malaysia checked: not officially sold. Script says "any shop with one Ring camera, shown here in Kuala Lumpur" (CRITIQUE §1)
- [ ] Product feedback answer pasted (below), naming the AWS services used
- [x] Open Source: PR https://github.com/josepha-mayo/ring-sandbox/pull/15 · repo https://github.com/ZenBen5173/shopsense · GitHub user ZenBen5173
- [ ] Friction log (`docs/FRICTION_LOG.md`), re-checked with a live token
- [ ] State what existed before the contest window (nothing; built during the window)

---

## Devpost text (draft)

**Tagline:** Your Ring camera already sees your business. ShopSense tells you what it saw.

**Inspiration.** Footfall analytics exists, but it is sold to retail chains,
with new sensors and a contract. The single shop on the corner (a grocery, a
café, a hardware store) gets nothing, even though it often already has a Ring
camera for safety. Every other Ring idea protects the home. We wanted Ring to
earn money for a small business.

**What it does.** ShopSense links a shop's Ring account and reads its motion
events and snapshots.
- The **front door** counts customers, finds the busy hours and, from one number
  typed at closing, works out how many visitors bought something.
- The **back door** logs supplier deliveries and flags late and missing ones,
  with a supplier on-time record.
- **The link** joins the two: "Segar Fresh Produce's van arrives at 12:15 on
  Saturdays, inside your busiest hour. Ask them to come at 10am." Or: "On the
  Thursdays the drinks lorry came late, 54% of visitors bought instead of 62%.
  That is about RM264 a day."

The owner gets two or three plain sentences each day, in English or Bahasa
Melayu.

**How we built it.**
- **Ring Partner API:** OAuth 2.0 with PKCE, a Playground-token path, devices,
  paginated event history, snapshot download, and HMAC-verified webhooks.
- **Amazon Bedrock:** the Converse API for vision. Each snapshot becomes a small
  validated JSON verdict: people walking in vs out, staff vs customer by uniform
  (never by face), or which supplier's van is at the door. A text model turns
  the computed facts into advice and is never allowed to invent a number.
- **Postgres:** Supabase in production; embedded PGlite (Postgres in WASM) for a
  zero-setup demo.
- **Next.js on Vercel:** a serverless poller (the dashboard drives it while
  open, plus a cron), the dashboard and the setup flow.
- **A replayable shop simulator.** It plants three stories and one red herring
  for the brains to find. The brains are never told about them, and the tests
  prove the brains find them from raw events.

**Challenges.** Motion events are not people. We count entering and leaving
separately, put an honest ± band on every count (it holds on 98% of simulated
days), and rank busy hours within the shop's own history so a steady
undercount doesn't change the answer. Playground tokens last 30 minutes and
have no webhooks, so we built a serverless poller and a replay clock.

**Accomplishments.** In the demo shop, ShopSense finds about RM460 a week at stake, from nothing but motion events and one number a day. And the link insights: They come out of the data on their own,
and they are things an owner can act on tomorrow morning.

**What we learned.** The model should say less than you'd think. Numbers come
from code; the model only chooses words.

**What's next.** A WhatsApp morning brief and a closing prompt; multi-frame
sampling for long motion events; staff rota suggestions; holiday and weather
context.

**Built with:** ring-partner-api, amazon-bedrock, claude, nextjs, typescript,
postgresql, supabase, pglite, vercel, tailwindcss.

---

## Testing instructions (for judges)

1. Open the deployed URL. No login. The demo shop loads with a month of
   history and today replaying at 60×.
2. Watch the counters and the live feed. Hover a delivery to see its snapshot.
3. Click **Replay a Saturday** in the banner, then wait for 12:00–12:30: the
   produce van arrives in the lunch rush, as the top insight predicted.
4. Click **Enter today's sales** and type `1250` and `70`.
5. Switch **EN → BM → 中文**.
6. Open **ⓘ How it works** to see real snapshots next to the vision JSON.
7. To try real Ring data: **Setup** → paste a Ring Playground token → tag the
   cameras.

---

## Video script (2:45)

| Time | Screen | Voice-over |
| --- | --- | --- |
| 0:00–0:15 | A shop doorway; the Ring camera above it | "Across the US, the UK and Australia, millions of corner shops and cafés already have a Ring camera. It watches for thieves. It never tells the owner anything about their business." |
| 0:15–0:30 | ShopSense dashboard, advice card animating in | "ShopSense links that camera and gives the owner plain advice. No new hardware, one number a day. Here it's running for a grocery in Kuala Lumpur." |
| 0:30–1:00 | Counters ticking, live feed, hourly chart, heatmap | "The front door counts customers walking in, not out. Staff are recognised by their apron, never by their face, and every count shows how sure we are." |
| 1:00–1:25 | Delivery log, hover a van snapshot, scorecard | "The back door logs deliveries. Bedrock reads the name on the van and checks it against the owner's list: on time, late, or missing." |
| 1:25–2:00 | Replay a Saturday: 12:15, van arrives during the rush; link insight card | "And because ShopSense sees both doors, it notices what neither can alone: the produce van arrives inside the Saturday lunch rush, every week. And on the Thursdays the drinks lorry runs late, fewer visitors buy, about 264 ringgit a day." |
| 2:00–2:15 | Closing dialog; percent updates | "At closing the owner types today's sales. Now we know how many visitors actually bought." |
| 2:15–2:30 | EN → BM switch; "Written by Claude on Amazon Bedrock" | "The advice is written by Claude on Amazon Bedrock, in English, Bahasa Melayu or Chinese, from numbers ShopSense computed. It never makes them up." |
| 2:30–2:45 | Setup: paste a Playground token, tag cameras; How it works page | "It runs on the Ring Partner API today, with any shop's real cameras. ShopSense: your Ring camera, now a business advisor." |

---

## Product feedback answer (required field, draft)

**Tools used:** Ring Partner API (OAuth 2.0 + PKCE, devices, event history,
image download, webhooks), Ring Playground, the community ring-sandbox emulator,
**Amazon Bedrock** (Converse API; Claude for vision and text, swappable for
Amazon Nova), Next.js, Vercel, Supabase/PGlite.

**What worked:** the JSON:API resources are consistent and easy to type. The
image download endpoint gave us exactly the frame we needed for vision. Bedrock's
Converse API let us swap vision models with one environment variable.

**What to improve:** see our friction log. In short: a `start_after` filter on
event history; longer-lived or refreshable Playground tokens; Playground
webhooks; one consistent scope string in docs and samples; and documentation of
whether webhook event ids match history event ids.

**Onboarding:** the Playground made the first call quick; the 30-minute token
made long tests painful, which is why we built a replay simulator.

**Would you build again?** Yes. The Partner API is a good base for business
apps, not only home security, and the Appstore is the right place to reach
small shops.
