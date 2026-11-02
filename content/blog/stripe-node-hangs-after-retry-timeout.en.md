---
title: "Why stripe-node Hangs After a Retry"
slug: "stripe-node-hangs-after-retry-timeout"
date: "2026-11-02"
lastUpdated: "2026-11-02"
author: "GEMBA IT team"
cluster: "payment-integrations"
tags: ["stripe", "stripe-node", "node-js", "fetch", "retries", "timeouts"]
readingTime: 6
excerpt: "Since stripe-node 22.6.0, a retried request leaves its timeout timer armed. Your script finishes, then the process sits there for 80 seconds. Here's why."
hero: "/images/blog/stripe-node-hangs-after-retry-timeout/hero.webp"
heroRetina: "/images/blog/stripe-node-hangs-after-retry-timeout/hero@2x.webp"
midImage: "/images/blog/stripe-node-hangs-after-retry-timeout/mid.webp"
midImageRetina: "/images/blog/stripe-node-hangs-after-retry-timeout/mid@2x.webp"
---

# Why stripe-node Hangs After a Retry

Your script does one thing: fetch a Stripe customer, print it, exit. It prints the customer. Then it just… sits there. No error. No pending promise. The cursor blinks for 80 seconds and only then do you get your prompt back.

Run it again and it exits instantly. Run it a third time — 80 seconds. You didn't change a line.

That's the bug reported to the stripe-node repository on 15 October 2026, and again by a second person six days later. The work is done. Something in the SDK refuses to let the Node process die, and the trigger is the one thing you'd never suspect: a retry that *succeeded*.

Here's the thing: this bug was born from a fix. In August, Stripe closed a nastier issue where the same timeout didn't work at all.

## The Problem

The reporter, `KevinDeLaTorre`, put it plainly in [stripe-node issue #2897](https://github.com/stripe/stripe-node/issues/2897): *"Since 22.6.0, a retried request leaves the failed attempt's `timeout` timer armed. The call succeeds, but with the default 80s timeout, a short-lived process stays alive for 80 seconds after its work finishes."*

Some context. stripe-node is Stripe's official Node.js library. When a call fails with a 5xx or a 409, the SDK retries it automatically (`maxNetworkRetries` defaults to 1). Every call also has a `timeout` — 80 000 ms by default — enforced by a `setTimeout` that aborts the request if it runs too long.

The reporter's test matrix makes this convincing: the same script on eight SDK versions. 18.5.0 through 22.5.0 exit in milliseconds. 22.6.0 through 23.1.0-beta.1 leave one timer and wait out the full timeout. A control run with no 500 exits clean everywhere.

Six days later, `hnoble5` filed [#2908](https://github.com/stripe/stripe-node/issues/2908) from a different stack (Cloudflare Workers code under test) with the same symptom: *"the Node process stayed open about 80 seconds after the tests finished."*

Both reports use `Stripe.createFetchHttpClient()`, the SDK's fetch-based transport. Hold that thought.

## The Debugging Dance

First instinct: an open handle, something still listening. You add `process._getActiveHandles()`. One `Timeout`. Whose? Node doesn't say.

Second guess: your own code. You grep for `setTimeout`. Nothing you don't clear. You strip the script down to the single Stripe call. Still 80 seconds.

Now the number starts to nag. 80 seconds is oddly specific. You set `timeout: 5000` on the Stripe client and the hang drops to 5 seconds. So the SDK's request timeout is the timer — but the request *finished*. Why would a finished request still own a timer?

The wrong turn that makes sense: downgrade one minor version at a time until the hang disappears. That's what the reporter did. It works; it just costs an afternoon. The answer is 22.6.0, released 26 August.

Its changelog has one line that looks unrelated: *"correctly throw connection errors if the server drops while sending the HTTP response body"* ([PR #2815](https://github.com/stripe/stripe-node/pull/2815)). It fixed [issue #2814](https://github.com/stripe/stripe-node/issues/2814): a stalled connection could hang stripe-node forever, because the timeout was cleared once response *headers* arrived and never covered the *body*.

The aha moment is reading that fix. The timer now stays armed after headers arrive, and whoever reads the body must release it:

```ts
// src/net/FetchHttpClient.ts (22.6.0+)
async toJSON(): Promise<any> {
  try {
    text = await this._requestTimeout.guard(this._res.text());
  } finally {
    this._requestTimeout.release();   // the only place the timer dies
  }
  return this._parseResponseBody(text);
}
```

Now think about what the retry path in `RequestSender` does with a 500: it calls `retryRequest(...)` and throws the response away *without reading the body*. Nobody calls `release()`. The `setTimeout` lives on, Node's event loop sees a live timer, and the process waits 80 seconds for a timer that, when it finally fires, aborts a request that ended ages ago.

![Abstract isometric illustration of a switch cutting a glowing thread between a discarded envelope and a ticking timer](/images/blog/stripe-node-hangs-after-retry-timeout/mid.webp)

## The Solution

The fix, [PR #2895](https://github.com/stripe/stripe-node/pull/2895) by `jar-stripe`, shipped in **stripe-node 23.0.1 on 22 October 2026**. If you're on 22.6.0 or later with the fetch client, upgrade:

```bash
npm install stripe@latest   # ≥ 23.0.1
```

The change is small. Responses gained an optional `dispose()` method, and the retry path calls it before throwing a response away:

```ts
// src/RequestSender.ts (23.0.1)
if (RequestSender._shouldRetry(res, requestRetries, maxRetries)) {
  res.dispose?.();
  return retryRequest(makeRequest, apiVersion, headers, requestRetries + 1);
}
```

```ts
// src/net/FetchHttpClient.ts (23.0.1)
dispose(): void {
  this._requestTimeout.release();
  this._requestTimeout.abort?.();
  const body = this._res.body;
  if (body && typeof body.cancel === 'function' && !body.locked) {
    body.cancel().catch(() => {});
  } else if (body && typeof body.destroy === 'function') {
    body.destroy();
  }
}
```

Why three steps? Clearing the timer stops the process from waiting. Aborting the controller tells fetch the response is dead. Cancelling the body closes the unread stream so the socket goes back to the pool. The reporter confirmed on the fix branch: zero leaked timers, exit in 506 ms.

What newcomers miss: **this is the fetch client only.** The default `NodeHttpClient` uses `req.setTimeout()` on the socket itself, so its timeout dies with the request. You hit this bug when you opt into `createFetchHttpClient()`.

If you can't upgrade yet, lower `timeout` to something sane for your workload; that caps how long the ghost timer lives. Don't set `maxNetworkRetries: 0` to dodge this — you'd trade a cosmetic hang for real failed payments.

## The Lesson

Every resource has an owner, and the owner changes when the code path changes. Before 22.6.0 the timer's owner was the fetch call: headers arrived, timer cleared, done. The August fix moved ownership to "whoever reads the body." That was the right call — it closed a real hang. But it created a new rule, and the retry path never got the memo, because the retry path doesn't read bodies.

The takeaway: when a change moves cleanup from "automatic" to "someone must call X," grep for every place that drops the resource without calling X — early returns, retry loops, error branches. That's where timers go to live forever.

## Credit & Further Reading

This article is based on a problem originally discussed in [stripe/stripe-node issue #2897](https://github.com/stripe/stripe-node/issues/2897). Thanks to `@KevinDeLaTorre` for the version-by-version reproduction, `@hnoble5` for the independent confirmation in [#2908](https://github.com/stripe/stripe-node/issues/2908), `@pouyashahrdami` for the original body-timeout report in [#2814](https://github.com/stripe/stripe-node/issues/2814), and `@jar-stripe` for the fix in [#2895](https://github.com/stripe/stripe-node/pull/2895). For the official options, see the stripe-node README on [network retries](https://github.com/stripe/stripe-node#network-retries) and [configuring timeout](https://github.com/stripe/stripe-node#configuring-timeout).

GembaPay's Stripe Connect integration runs on Node, which is why a bug about retries in short-lived processes got our attention.

## Frequently Asked Questions

### Does this affect the default Node HTTP client?

No. Both reports use `Stripe.createFetchHttpClient()`. The default `NodeHttpClient` applies the timeout with `req.setTimeout()` on the request object and calls `req.destroy()` when it fires, so the timer is tied to the socket and goes away with the request. You're exposed on Deno, Cloudflare Workers or Bun, where the fetch client is the normal choice, or if you passed `httpClient: Stripe.createFetchHttpClient()` in Node.

### Which versions are affected and which fix it?

Affected: 22.6.0 through 23.0.0, plus the 23.1.0 pre-releases before the fix, when using the fetch client. The regression arrived with PR #2815 in 22.6.0 (26 August 2026). The fix is PR #2895, released in 23.0.1 on 22 October 2026 and included in 23.1.0 and later. The reporter's matrix confirmed 18.5.0 through 22.5.0 are clean — though those versions still have the older body-timeout hang from #2814.

### My Deno tests fail with a leaked timer — same bug?

Very likely, if a Stripe call in that test got retried. Deno's test sanitizer refuses to pass a test that leaves a timer pending, and that's exactly what a discarded retry response does on 22.6.0–23.0.0. Upgrade to 23.0.1 or later and the sanitizer should go quiet. If it still complains, make sure your mock fetch returns a real `Response` with a body, because the fix works by cancelling that body stream.
