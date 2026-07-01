Your checkout works. You've tested it a dozen times as a guest, the card goes through, the order flips to "paid", everyone's happy. Then a real customer does something completely reasonable: they get halfway through, remember they have an account, and log in. They click pay again. And the whole thing falls over with a `400` error your team has never seen in testing.

The kicker is that nothing is actually broken. The card is fine. Stripe is up. Your code didn't change between the click that worked and the click that didn't. The only thing that changed is *who the customer is* — and that, it turns out, is enough.

This is the trap behind an idempotency key (the unique string you send Stripe so a retried request doesn't charge someone twice). Used right, it's the thing that saves you from double-charges. Used slightly wrong, it quietly becomes the thing that blocks a paying customer at the last step. Here's the exact failure, why it only shows up for logged-in users, and the one-line idea that fixes it.

## What an idempotency key is supposed to do

Quick plain-English version, because the whole bug hides in this definition.

When your server asks Stripe to create a payment, the network can hiccup. Maybe Stripe charged the card but the reply got lost on the way back. If your code just retries, you've now charged the customer twice. Bad.

The fix is the idempotency key: you attach a unique string to the request — say, a random UUID (a long random ID like `8ZMXNVK2YZ767Z42`). Stripe remembers that key. If it sees the *same* key again, it doesn't run the charge a second time. Instead it replays the saved answer from the first try. One click or ten, one charge. That's the whole point.

So far so good. "Use an idempotency key on your payment requests" is correct advice. The problem is the part nobody puts in bold: a key isn't a label you slap on the operation once. It's a fingerprint of *that exact request*. Change the request, and you must change the fingerprint — or Stripe pushes back.

## The Problem

Here's the error, word for word, that the request comes back with:

```
Keys for idempotent requests can only be used with the same parameters
they were first used with. Try using a key other than
'8ZMXNVK2YZ767Z42_11591' if you meant to execute a different request.
```

Error type: `idempotency_error`. HTTP status `400`.

Read it once and it sounds almost helpful. Read it at 11pm when checkout is down in production and it sounds like Stripe is accusing you of a crime you didn't commit. *Different request?* You didn't send a different request. You sent the same checkout for the same order. What's it talking about?

This is not a rare corner case. The clearest write-up is [Vendure issue #3903](https://github.com/vendurehq/vendure/issues/3903) ("Checkout fails after login due to reused idempotency key"), but the exact same wall has been hit over and over: the same project had it filed earlier as issue #2364, and you'll find the identical error in [tipsi-stripe #799](https://github.com/tipsi/tipsi-stripe/issues/799), in [flutter_stripe_payment #311](https://github.com/jonasbark/flutter_stripe_payment/issues/311), in [a Rails bootcamp app](https://github.com/fjordllc/bootcamp/issues/3928), and in WooCommerce support threads. Different stacks, different languages, one identical mistake.

The reproduction in the Vendure report is the cleanest you'll find:

1. Start checkout as an anonymous guest.
2. Your server creates a Stripe PaymentIntent (the object that represents "we intend to charge this card").
3. The customer logs in — same cart, same order, nothing cancelled.
4. Your server calls "create payment intent" again.
5. Stripe rejects it with the idempotency error above.

Works every time as a guest. Breaks every time someone logs in mid-checkout. That's the shape of the bug.

## The Debugging Dance

If you've never seen this one, here's roughly how the afternoon goes.

**First instinct: it's the card.** Maybe the test card is being declined now. You swap to a different test card. Same error. You check the Stripe dashboard — no declined charge, no charge at all, just an API error logged. The card never even got tried. Okay, not the card.

**Second guess: it's the keys.** Live key vs test key, right? That's the classic Stripe gotcha. You triple-check your environment variables. Production secret in production, test secret in dev. All correct. The error isn't about authentication anyway — a wrong API key gives you a `401`, not this. Curse quietly. Move on.

**Third guess: Stripe's having a moment.** You open the status page. All green. Of course it's all green.

By now you've got the Stripe docs in one tab, the error pasted into a search box in another, and a growing suspicion that the problem is *you*. And here's where a lot of people take the genuinely wrong turn: they see the word "idempotent", decide the key is the troublemaker, and "fix" it by generating a brand-new random key on every single click.

It makes the error go away. It also throws out the one piece of safety the key was there to give you. Now if a customer double-clicks pay, or the network retries under the hood, each attempt carries a fresh key — and Stripe happily creates two PaymentIntents. You've traded a loud `400` for a silent double-charge, which is so much worse. The error was annoying. This is the kind of thing that ends up in a chargeback.

The actual "aha" comes from reading the error *literally*. "Can only be used with the same parameters they were first used with." Same parameters. So the parameters must have changed. What changed between the guest click and the logged-in click?

The customer logged in. And when they did, your code started attaching a Stripe `customer` field to the request — linking the payment to their saved customer record. The guest request had no customer. The logged-in request has one. **Same key, different parameters.** Stripe is doing exactly what it promised: it's refusing to let one key stand for two genuinely different requests. The bug was never Stripe's. It's that the key was built to ignore the one thing that changed.

In the Vendure case the key was built from `orderCode + amount`. Both of those stay identical when you log in — so the key stays identical, while the body of the request quietly grew a `customer` field. The fingerprint didn't match the thing it was fingerprinting anymore.

![Abstract isometric illustration of two near-identical request envelopes carrying the same key tag, one holding an extra token the other lacks, a validation gate rejecting the mismatch, deep blue and purple gradient, no text](/images/blog/stripe-idempotency-key-breaks-after-login/mid.webp)

## The Solution

The fix is small, and once you see it you can't unsee it: bake the changing thing *into* the key.

If logging in adds a customer to the request, then the customer has to be part of the key. The Vendure report's own suggestion says it plainly — include the `customerId` (or a literal `'anon'` when nobody's logged in) in the key:

```js
// Before — ignores who the customer is
const idempotencyKey = `${orderCode}-${amount}`;

// After — the key changes when the request changes
const customerPart = customerId ?? 'anon';
const idempotencyKey = `${orderCode}-${amount}-${customerPart}`;
```

Now the guest attempt and the logged-in attempt carry *different* keys, because they really are different requests. Stripe stops complaining. And — this is the part that matters — you keep the protection: two clicks from the *same* logged-in customer on the *same* order still share a key, so they still can't double-charge.

Why does this work? Because you've made the key honest. An idempotency key is a promise: "every request with this key is the same request." The moment that stops being true, the promise is broken and Stripe calls it out. Your job is to make sure the key includes every input that defines "the same request" for you — and nothing that doesn't.

For anything beyond a toy checkout, don't hand-glue fields with template strings. Hash the parameters that actually matter and append a version tag, so adding a new field later is one line, not a hunt through string concatenation:

```js
import { createHash } from 'node:crypto';

function paymentKey({ orderCode, amount, currency, customerId }) {
  const fingerprint = JSON.stringify({
    orderCode,
    amount,
    currency,
    customer: customerId ?? 'anon',
  });
  const hash = createHash('sha256').update(fingerprint).digest('hex').slice(0, 24);
  // bump the version when you change what's in the fingerprint
  return `pi_v2_${orderCode}_${hash}`;
}
```

A few edges to guard:

- **Amount and currency belong in the key too.** If the customer changes the shipping option or applies a coupon, the amount changes — that's a new request, and it should get a new key. The hash approach covers this for free.
- **Stripe remembers a key for at least 24 hours.** After that it's pruned and a reused key starts fresh. So this is a "within one checkout session" concern, not forever.
- **Don't go the other way and randomize per click.** The key should be *stable* for one logical operation and change only when its inputs change. Stable, not random.

This is the same discipline we lean on inside GembaPay, our own payment gateway — a retry has to be provably the *same* intent before we let it collapse into one charge, and the key is where you encode "same".

## The Lesson

An idempotency key is not a name you give an operation. It's a fingerprint of the request's inputs. Treat it like a name — set it once from a couple of "stable-looking" fields — and it'll lie to you the moment some *other* field changes underneath it. Login is the classic trigger because it sneaks a `customer` into the body without touching the order code or the amount, but coupons, address changes, and metadata updates all do the same thing.

The actionable takeaway fits on a sticky note: **the key must include every parameter that, if changed, would make this a different request — and exclude everything that wouldn't.** Build it from a hash of those exact inputs, version it, and the whole category of "works for guests, breaks on login" bugs disappears. When Stripe says "same parameters", it means it. Make your key mean it too.

## Credit & Further Reading

This article is based on a problem clearly reported and reproduced in [Vendure issue #3903](https://github.com/vendurehq/vendure/issues/3903), filed by **@grandant**, who pinned down both the trigger (logging in mid-checkout) and the root cause (an idempotency key built from only `orderCode + amount`). The same issue had surfaced earlier as Vendure #2364. For the authoritative behavior, see Stripe's own [Idempotent requests reference](https://docs.stripe.com/api/idempotent_requests), which spells out that the API compares incoming parameters against the original request and rejects mismatches.

## Frequently Asked Questions

### What does "Keys for idempotent requests can only be used with the same parameters" actually mean?

It means you sent Stripe a request with an idempotency key it has seen before, but the *parameters* of this request don't match the parameters of the first request that used that key. Stripe stores the first request's inputs and compares every later request that reuses the key. If anything differs — a new `customer`, a different `amount`, changed metadata — it refuses with a `400` rather than guess which request you meant. The card is never touched, so it's a blocked request, not a failed charge.

### Should I just generate a fresh random key on every request to make the error go away?

No — that's the trap. A brand-new key per click does silence the error, but it also throws away the protection the key existed for. If a customer double-clicks "pay", or the network retries the request under the hood, each attempt now carries a different key and Stripe will create a separate charge for each. You've turned a visible `400` into an invisible double-charge. The key should be stable for one logical payment and change only when the payment's real inputs change.

### How long does Stripe remember an idempotency key?

At least 24 hours. Stripe saves the status code and body of the first request under that key and replays it for any matching retry within the window. After roughly a day the key is pruned; reusing it after that starts a fresh request. So in practice this is a within-session concern — long enough to cover retries during one checkout, short enough that yesterday's keys won't haunt you.

### Which parameters trigger the mismatch — does changing metadata count?

Any parameter Stripe receives is part of the comparison, including `metadata`. The login case is the famous one because it adds a `customer` field without changing the order code or amount, so a naive key misses it. But changing the amount (coupon, shipping), the currency, the description, or a metadata value all count as "different parameters". If a field can change between attempts and you want those attempts treated as the same request, either keep that field constant or fold it into the key.

### Does this bug double-charge customers?

Not by itself. The idempotency error blocks the request before any charge happens, so the symptom is a customer who can't pay, not one who pays twice. The double-charge risk comes from the *wrong fix* — a random key per click — which removes the safety net. Fix it properly by folding the changing fields into the key and you get both: no spurious `400`, and no duplicate charges.
