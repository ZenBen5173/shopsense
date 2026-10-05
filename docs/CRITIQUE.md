# ShopSense: the case against it, and how we answer each point

This is a hard look at the idea and the build. Each risk is followed by what we
did about it, or what is still open. Items marked **OPEN** need a decision or a
check by the team before submission.

---

## 1. Does the market even have Ring cameras? — **checked: Ring is not officially sold in Malaysia**

**The attack.** The spec's hero user is a Malaysian *kedai runcit*. Ring is
sold officially in a short list of countries (US, Canada, UK, Ireland,
Australia, NZ, parts of Europe, India and a few others). We have not confirmed
that Malaysia is one of them, or that the Partner API links accounts there. A
judge who knows this will ask: "how many kedai runcit owners have a Ring
camera?"

**Our answer.**
- Keep the Malaysian shop as the demo persona (it is vivid and it shows the
  Bahasa Melayu advice), but pitch the market as **every single-camera small
  shop in Ring's markets**: US corner stores and bodegas, UK newsagents,
  Australian milk bars, independent cafés. The product is the same.
- Say it in one line in the video: "Built for any shop with one Ring camera;
  shown here in Kuala Lumpur."
- **Checked (Oct 2026):** Ring is not officially sold in Malaysia; buyers
  import it through forwarding services. So the video must not imply that
  Malaysian shops are the main market. Lead with US / UK / Australian corner
  shops and cafés, and present Kuala Lumpur as the localisation demo
  (Bahasa Melayu, ringgit), plus a growth market once Ring launches in SEA.

## 2. Motion events are not people

**The attack.** Ring fires one motion event per trigger, with a cool-down. At
the busiest moment a door may trigger once for a stream of people, and a single
snapshot catches whoever is in frame at that instant. So the count is worst
exactly when it matters most: in the rush.

**What we built.**
- The vision step counts people walking **in** and **out** separately, so no
  one is counted twice.
- Every total carries a **± band** computed from per-snapshot confidence. In the
  simulator the true count falls inside the band on **98% of days** (checked
  over 120 simulated days).
- Busy hours are a **ranking within the shop's own history**, not an absolute
  count. Undercounting by a steady 15% does not change *which* hour is busiest.

**Still open (roadmap).**
- For long motion events (Ring returns `start` and `end`), sample 2–3 snapshots
  with `latest_in_range` instead of one. This is a contained change in
  `src/lib/ring/partner.ts` and `src/lib/vision/index.ts`.
- A one-tap **calibration**: once a week the owner counts customers for an hour
  with a tally; the app learns a correction factor.

## 3. AI cost per shop

**The attack.** A busy shop makes ~300 front-door events a day. One vision call
per event on a top model costs too much for a shop that earns a few thousand
ringgit a day.

**Rough numbers** (first-party list prices; Bedrock prices differ, so treat as
order of magnitude). One snapshot ≈ 300 image tokens + ~300 prompt tokens in,
~200–400 tokens out.

| Vision model | ≈ cost per event | ≈ per month at 300 events/day |
| --- | --- | --- |
| Claude Opus 5.5 ($4 / $20 per M tokens) | ~$0.008 | ~$75 |
| Claude Haiku 4.5 ($1 / $5) | ~$0.002 | ~$19 |
| Amazon Nova 2 Lite | lower still (check Bedrock pricing) | a few dollars |

**What we built.** Both models are env vars (`BEDROCK_VISION_MODEL`,
`BEDROCK_TEXT_MODEL`). Advice is a handful of calls per day and is cached per
hour, so a strong model there costs cents.

**Decision for the team.** The code defaults both to Claude Opus 5.5. For a
real shop, run vision on Haiku 4.5 or Nova 2 Lite and keep the strong model for
advice. That is one env var; it is your call.

## 4. Camera placement

**The attack.** Many shop cameras point at the till or the street, not the
doorway. Many shops have no back-door camera at all.

**What we built.**
- The front-door prompt asks for direction of movement, which works from above
  the door looking out (the usual doorbell position).
- **Everything degrades gracefully with one camera.** Without a back-door
  camera the delivery log and the link insights simply don't appear; footfall,
  busy hours, conversion and advice still work.
- Setup asks the owner to tag each camera; untagged cameras are ignored.

**Roadmap:** a setup check that looks at the first snapshot and warns "this
camera can't see the door".

## 5. "Visitors who bought" needs a receipt count

**The attack.** Many owners know today's takings, not the number of receipts.

**What we built.** The closing dialog asks for takings and, optionally,
receipts, and previews the result live. Leave receipts blank and ShopSense
estimates them from the shop's usual basket over the last four weeks (stored
as `source = 'estimated'`).

**Roadmap:** read both straight from popular POS systems.

## 6. Correlation is not causation

**The attack.** "Late drinks lorry → fewer buyers" rests on a handful of
Thursdays. Two bad days could be rain.

**What we built.**
- The insight states its sample: "On the **2** Thursdays it came late…".
- It needs at least 2 bad days and 2 comparison days, and a drop of at least
  4 points, before it shows.
- It compares like with like (the same supplier's on-time days, else the same
  weekday).
- It does **not** blame the rice lorry, whose no-shows don't move sales. A test
  checks this.

**Roadmap:** show "early signal" vs "confirmed" once a pattern holds for 4+
weeks; mark public holidays and rain days as unusual.

## 7. Privacy and the law (Malaysia's PDPA 2010, GDPR in Europe)

**The attack.** Security footage reused for analytics, sent to a cloud AI.

**What we built.**
- Read-only Ring scope (`ava.v1:read`).
- No face recognition. Staff are told apart by a uniform the owner describes.
- Front-door snapshots are analysed in memory and **never stored**; only counts
  are kept. Back-door snapshots are kept only for deliveries, as proof.
- Prompts forbid describing anyone's face, age or race.

**Roadmap:** a printable notice for the shop door; Bedrock in the shop's
nearest region (e.g. `ap-southeast-1`) for data residency.

## 8. Owners don't open dashboards

**The attack.** A busy owner won't check a web page.

**What we built.** The top of the screen is two or three sentences of advice,
not charts, and it is available in Bahasa Melayu.

**Roadmap (high value):** send the same advice to WhatsApp at opening time,
and ask for the sales figure there at closing. The dashboard becomes the place
for detail, not the daily habit.

## 9. "Ring could build this"

**The attack.** Ring or a competitor (Nest, Verkada, Eufy) could add footfall.

**Our answer.** Chains already have FootfallCam and similar tools. Nobody
serves the one-camera shop. Our edge is **the link**: front door and back door
together, in plain words, in the owner's language. This is also an argument
*for* the Ring Appstore: it is the kind of business app a platform wants on it.

## 10. Demo credibility

**The attack.** Judges can't see a real shop, and a simulator can look staged.

**What we built.**
- The simulator plants three stories. **The brains are not told about them**,
  and tests prove the brains find them from raw events.
- It also plants a red herring (the rice lorry), and the brains ignore it.
- The **How it works** page shows real rows: each snapshot next to the exact
  JSON the vision step returned.
- With AWS keys set, simulated snapshots go through Bedrock exactly like Ring
  JPEGs. A Playground token switches to a real Ring account, and
  `RING_API_BASE` points the same client at the community `ring-sandbox`
  emulator.

**Action:** before recording, run once with AWS credentials so the video shows
"Written by Claude on Amazon Bedrock", and paste a real Playground token on
camera.

---

## Reinforcements: what would make the idea clearly stronger

Ranked by impact per hour of work.

1. **Supplier scorecard.** "Ah Seng Drinks: on time 4 of 8 deliveries this
   month." It gives the owner something to show the supplier. The data already
   exists. *(Built: see the delivery log panel.)*
2. **WhatsApp morning brief and closing prompt.** It turns ShopSense into a
   daily habit.
3. **Multi-frame sampling for long events.** This makes counts honest in the
   rush.
4. **Staff rota suggestion** from the week heatmap: "Add a part-timer Saturday
   11am–2pm."
5. **Holiday and weather overlay** (Hari Raya, school holidays, rain) to
   explain dips instead of letting them look like problems.
6. **Chinese advice** for Chinese-Malaysian shop owners. Bedrock writes it;
   only the interface labels need translating.

## How the build maps to the judging criteria (equal weights)

| Criterion | What judges will see |
| --- | --- |
| Tech implementation | Ring Partner API client: OAuth + PKCE, Playground, devices, event history with pagination, snapshot download, HMAC-verified webhooks. Bedrock Converse vision + text with validated JSON. Postgres schema. 20+ tests. |
| Design | One screen, advice first, live replay, bilingual, micro-interactions, privacy built in. |
| Potential impact | Millions of single-camera shops; zero new hardware; one number a day. |
| Quality of idea | The only Ring entry that makes the camera earn money; the two-door link is new. |
