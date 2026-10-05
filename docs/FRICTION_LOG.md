# Ring API friction log

A running record of what was confusing or blocking while building ShopSense on
the Ring Partner API. Format follows the hackathon rules: task → steps →
expected vs actual → severity → workaround → suggestion.

> Entries 1–6 were found while reading the docs and building against them.
> Entries marked *(verify live)* need re-checking with a Playground token before
> submission; edit or drop any that turn out to be wrong.

---

### 1. Scope string differs between prose and sample code
- **Task:** build the OAuth authorize URL.
- **Steps:** read the API documentation's authorization section, then the code
  sample.
- **Expected:** one scope value.
- **Actual:** the prose says only `ava.v1:read` is supported; the sample uses
  `scope=ava`.
- **Severity:** medium (a failed account link on the first try).
- **Workaround:** used `ava.v1:read` (`RING_SCOPE` in `src/lib/ring/partner.ts`).
- **Suggestion:** make the sample match the prose, and list valid scopes in a
  table.

### 2. Playground tokens expire in ~30 minutes with no refresh
- **Task:** keep a dashboard polling all afternoon while developing.
- **Steps:** generate a token in the Playground; poll Event History every 15 s.
- **Expected:** a refresh path, or a longer-lived developer token.
- **Actual:** the token dies after ~30 minutes; every call returns 401.
- **Severity:** medium (breaks long-running tests and demos).
- **Workaround:** detect 401 and show "Playground token expired — paste a new
  one" in Setup. A replay simulator covers the long runs.
- **Suggestion:** offer a developer refresh token, or a 24 h sandbox token
  bound to test devices.

### 3. No webhooks in the Playground, so you must poll
- **Task:** react to motion in near real time.
- **Expected:** webhooks or a server-sent stream available to Playground users.
- **Actual:** webhooks need a registered app; Playground users poll.
- **Severity:** low-medium.
- **Workaround:** the poller (`src/lib/poller.ts`) plus an HMAC-verified webhook
  receiver (`/api/ring/webhook`) for production.
- **Suggestion:** a Playground "send test webhook" button to any HTTPS URL.

### 4. Event History pagination edge cases *(verify live)*
- **Task:** fetch only events newer than the last one ingested.
- **Expected:** a `since` / `start_time` filter, and a consistent `links.next`.
- **Actual:** no time filter is documented, so the client pages backwards until
  it passes its cursor. The community emulator returns no `links` on an empty
  page, while the docs always show `links.next`.
- **Severity:** medium (wasted calls, and it is easy to loop forever).
- **Workaround:** stop on empty `data`, on missing `next`, or when an event is
  older than the cursor; capped at 10 pages.
- **Suggestion:** add `filter[start_after]=<epoch ms>` and document the empty
  page shape.

### 5. Snapshot download is a 303 to a short-lived URL
- **Task:** fetch the image for an event.
- **Expected:** image bytes, or JSON with a URL.
- **Actual:** `POST …/media/image/download` answers with a 303 redirect.
  Whether to forward the bearer token to the redirect host is not documented.
- **Severity:** low.
- **Workaround:** let `fetch` follow the redirect (it drops `Authorization`
  across origins).
- **Suggestion:** document the redirect target's auth requirements, and allow
  `?response=json` to return the signed URL.

### 6. Webhook event id vs history event id *(verify live)*
- **Task:** de-duplicate events that arrive by webhook and later by polling.
- **Expected:** the same id in both, documented.
- **Actual:** the docs don't say whether `data.id` in a `motion_detected`
  webhook equals the history event's `id`.
- **Severity:** medium (double counting if they differ).
- **Workaround:** events are keyed by id; if the ids differ, the fallback is to
  match on device + timestamp within 2 s (not yet implemented).
- **Suggestion:** state the relationship explicitly in the webhook docs.

### 7. Timestamp units
- **Task:** parse `start` / `end` on history events.
- **Actual:** examples show epoch milliseconds; the snapshot request takes
  `timestamp` with no unit stated.
- **Workaround:** `toMs()` accepts seconds, milliseconds or ISO strings.
- **Suggestion:** say "epoch milliseconds (UTC)" next to every time field.

---

*Add entries as you test with a live token: the task, what happened, and a
concrete suggestion. This log can earn up to a 10% bonus.*
