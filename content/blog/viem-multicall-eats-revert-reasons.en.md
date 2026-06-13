A user opens MetaMask, clicks "claim NFT", and your dashboard shows them a single sentence: `Execution reverted for an unknown reason.` Helpful. Nothing useful in the logs after it. Just that.

And the frustrating part? Your contract has a perfectly clear custom error — `ERC721NonexistentToken(uint256 tokenId)`. (A custom error is just a named error message your smart contract sends back when it refuses to do something.) Your tests catch it fine. A direct `cast call` on the very same RPC node returns the bytes with the exact selector you expect. But run that identical call through your app's viem client, and it dies with a sentence that tells you absolutely nothing.

Here's the kicker. Flip one boolean in your viem config and the same call suddenly returns `Execution reverted with reason: ERC721: owner query for nonexistent token.` That one boolean? It's `batch.multicall`.

This is the whole story behind [viem issue #4006](https://github.com/wevm/viem/issues/4006), opened in May 2026 and closed `not planned` — which is a polite way of saying "this isn't a bug, it's just how the thing works." It's a documented (well, *un*documented) side effect of how the multicall transport bundles your `eth_call` requests together. If you've ever burned half an afternoon staring at "unknown reason" and quietly wondering whether your RPC provider was lying to you, this one's for you.

## The Problem

In viem, `createPublicClient` lets you pass a `batch.multicall` option to its HTTP transport. (The transport is just the piece that actually carries your requests to the blockchain node.) Turn that option on, and every `readContract` or `eth_call` you fire within a short window gets quietly folded into one single multicall request through a contract called Multicall3. The payoff is real: one round-trip to the RPC instead of twenty. The default is `false`, so most people only switch it on once a read-heavy page starts tripping rate limits.

Here's the config from the issue, trimmed down:

```ts
const client = createPublicClient({
  chain: base,
  transport: http(rpcUrl, {
    batch: { multicall: true }, // the suspect
  }),
});

await client.readContract({
  address: nftContract,
  abi: erc721Abi,
  functionName: 'ownerOf',
  args: [99999999n], // nonexistent token
});
```

With `batch.multicall: true`, the call throws this:

```
ContractFunctionExecutionError: The contract function "ownerOf" reverted.
Details: Execution reverted for an unknown reason.
```

With `batch.multicall: false` (or the option just removed entirely):

```
ContractFunctionExecutionError: The contract function "ownerOf" reverted with the following reason:
ERC721: owner query for nonexistent token.
```

Same contract. Same calldata. Same RPC. The only thing that changed is which path the request took inside viem. The person who reported issue #4006 even proved it by digging into the error object itself: `error.cause.cause.data` holds the exact same raw revert bytes in both cases. The bytes survive the whole round-trip just fine. They just never make it through the part of viem that turns those bytes into a sentence a human can read.

And this isn't some freak one-in-a-million case. Search the wevm discussions for "multicall revert reason" and you'll find a handful of developers mid-conversation, most of them convinced their RPC provider had gone rogue. As one of them put it on the original issue: *"I was about to file a support ticket with Alchemy."*

## The Debugging Dance

Picture the scene. Sentry is lighting up with `Execution reverted for an unknown reason.` Your first instinct: the RPC is acting up. So you switch from Alchemy to Infura. Same result. You switch to a self-hosted node. Same result. You curse.

Next theory: the ABI doesn't match what's actually deployed. (The ABI is the contract's instruction manual — it tells your code what functions and errors exist.) But the happy path works fine — calling `ownerOf` for a real token returns the right address. If the ABI were wrong, *every* call would break, not just the ones that revert. You curse again.

Third theory: it's a custom error and somebody forgot to put the error fragment in the ABI. So you add it. Nothing changes. The custom error data is sitting right there in the response — `error.cause.cause.data` is something like `0x7e273289...` — but viem just isn't decoding it into a name. By now you've got Stack Overflow open in eight tabs and the multicall docs in a ninth.

Then comes the accidental discovery. Someone on the team is off chasing a slow page load, comments out the `batch: { multicall: true }` line for a minute, and drops a message in Slack: *"weird, your error is way more readable on my branch."* You put the two branches side by side. The only difference is six characters: `true` became `false`. The error message went from one sentence to two. And that second sentence is exactly the one you've been hunting for three days.

That's the moment it all clicks. The multicall transport wraps your individual `eth_call` requests inside a Multicall3 call named `aggregate3`. The Multicall3 contract hands back `(bool success, bytes returnData)[]` — so when one of the inner calls reverts, its revert bytes get tucked into `returnData` and the *outer* eth_call still succeeds. Viem unpacks that outer array just fine. But the code that turns inner revert bytes into "Execution reverted with reason: ..." was written for plain, direct `eth_call` errors — where the revert sits in the JSON-RPC error envelope. In the multicall path, those bytes live somewhere else on the response, the formatter never reaches them, and the message you show the user falls back to the generic default.

So the data is all there. The bug is in the *narration*.

![Abstract isometric illustration of structured error data flowing through a branching pipeline — one branch keeps a detailed payload while the other reduces it to a generic glyph](/images/blog/viem-multicall-eats-revert-reasons/mid.webp)

## The Solution

You've got three real options. Pick based on the trade-off that fits you.

**Option 1 — Decode the bytes yourself.** The revert data is sitting right there on the error chain. Walk it and decode it.

```ts
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
} from 'viem';
import { erc721Abi } from './abi';

try {
  await client.readContract({
    address: nftContract,
    abi: erc721Abi,
    functionName: 'ownerOf',
    args: [tokenId],
  });
} catch (err) {
  if (err instanceof BaseError) {
    // First, ask viem if it already decoded a custom-error somewhere on the chain.
    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (revert instanceof ContractFunctionRevertedError && revert.data) {
      console.log('decoded:', revert.data.errorName, revert.data.args);
      return;
    }

    // Multicall path: the formatter never reached the inner bytes.
    // Pull the raw data off the cause chain and decode it directly.
    const raw =
      (err.cause as { cause?: { data?: `0x${string}` } } | undefined)
        ?.cause?.data;
    if (raw) {
      const decoded = decodeErrorResult({ abi: erc721Abi, data: raw });
      console.log('decoded (raw):', decoded.errorName, decoded.args);
    }
  }
  throw err;
}
```

`walk()` is the documented way to climb through viem's error chain. The new piece here is the `decodeErrorResult` fallback for the multicall case — the one where the walker came up empty and you have to turn the raw bytes into a name by hand.

**Option 2 — Two clients, one per job.** This is a surprisingly common production pattern. Keep `batch.multicall: true` for your high-volume read endpoints (NFT galleries, leaderboards, token lists) where reverts are rare and a generic error is fine. Then spin up a second client with batching off for the code paths that drive your UX, where a clear revert reason matters more than shaving off 50ms.

```ts
const fastClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl, { batch: { multicall: true } }),
});

const clearClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});
```

Use `fastClient` for the gallery page. Use `clearClient` for the mint button. The wallet provider stays exactly the same — only the read transport changes.

**Option 3 — Simulate first.** `simulateContract` always uses a direct `eth_call`, so it gets the full revert reason no matter what your transport setting is. Drop it in as a preflight check before any write you're about to broadcast. It's already the pattern the viem docs recommend for `writeContract`, and it happens to fix this too.

Here's the part that isn't obvious: the explicit `multicall()` function — the one you call by name with `contracts: [...]` — is **not** the thing biting you. That function defaults `allowFailure: true` and returns `{ status: 'failure', error }` for each call, with the error correctly decoded against your ABI. The trap is only the *implicit* batching — the silent kind you switch on with the transport option.

## The Lesson

Performance optimizations that quietly wreck your observability are the worst kind of leaky abstraction, because they vanish exactly when you need them most: 11pm, production traffic, a user yelling on Discord, and "execution reverted for an unknown reason" staring back at you from the logs.

When a library hands you an optimization flag like `batch.multicall`, ask two questions before you flip it on: *what does it cost me when something fails?* and *will I even be able to tell?* The answers should be in the docs. When they aren't, go find out — before production traffic finds out for you. Saving 50ms on a gallery page is not worth a three-day investigation when a single mint button starts spitting out nonsense.

The bigger principle: any layer that sits between your code and the wire, and is allowed to *rewrite* your errors, needs to pass them back through losslessly. If it can't, it should at least warn you — in the type signature or the docs — that error fidelity changes the moment you turn it on. Until that day comes, running two clients is a tiny price to pay to skip a debugging session you really don't want to live through.

## Credit & Further Reading

This article is based on the problem discussed in [viem issue #4006](https://github.com/wevm/viem/issues/4006). The reporter laid out a clean reproduction with a Base chain ERC721 call, which made it possible to see exactly where the decode path diverges. For the underlying primitives, see the [viem `decodeErrorResult` reference](https://viem.sh/docs/contract/decodeErrorResult) and the [Multicall3 contract source](https://github.com/mds1/multicall) by `@mds1`. The HTTP transport options, including the full shape of `batch.multicall`, are documented at [viem.sh/docs/clients/transports/http](https://viem.sh/docs/clients/transports/http).

## Frequently Asked Questions

### Does this affect the explicit multicall() function too?

No — and this is the distinction that matters. The explicit `multicall()` action, called with a `contracts: [...]` array, hands you back a result array where failed calls show up as `{ status: 'failure', error }` when `allowFailure: true` (the default). The `error` object there is properly decoded against the ABI you passed in. The issue only hits the **implicit** batching that kicks in when you set `batch.multicall: true` on the HTTP transport — that path runs through a different formatter that never reaches into the inner Multicall3 `returnData` when it wraps the error. So you can keep using `multicall()` directly without changing a thing; the trap is only the silent kind.

### Will turning off batch.multicall kill read performance?

In most production apps, no. The win from `batch.multicall` is real for pages that fire off twenty or more reads the moment they load — NFT galleries, multi-token balance fetches, vault dashboards — but most user-facing flows fire just one to three reads at a time, where the batching window only adds latency without saving you an RPC call. Measure before you optimize. A pragmatic split is the one above: a fast client for batch-heavy reads, a clear client for the UX-critical paths where the revert reason actually matters. Most teams running this pattern report the same thing: gallery pages stay snappy, mint flows stay debuggable.

### Why was the issue closed as not planned?

The maintainers didn't explain publicly, but the likely reason is architectural. Viem's error formatting is built around a one-call, one-response model, and the multicall path returns N responses tucked inside a single RPC reply. Threading inner revert data back through the error formatter touches a lot of code and creates ambiguity when several calls revert in one batch — which error wins? Which gets logged? Which one does the user see? Telling people "decode it yourself with `walk()` and `decodeErrorResult`" is the lower-risk answer for a library that prizes type safety and predictable error shapes, even if it stings in the moment.

### What about OpenZeppelin v5 custom errors like ERC721NonexistentToken?

Same problem, just a slightly different decode. Custom errors are encoded as a 4-byte selector plus ABI-encoded arguments. If your contract uses OpenZeppelin v5 custom errors, they live in your contract's ABI as `error` fragments. As long as those fragments are in the ABI you hand to `decodeErrorResult`, the function returns `{ errorName: 'ERC721NonexistentToken', args: [tokenId] }` cleanly. If they're missing from the ABI, you just get raw bytes back and you'll have to add the error fragments — viem can't (and won't) guess at custom errors that aren't in your ABI. A common slip-up here is using a hand-trimmed ABI that keeps the function signatures but drops the error fragments to save a few bytes. Keep the errors in.

### Is there a way to opt out of multicall just for a single read?

Not directly — `batch.multicall` is a transport-level setting, not a per-call one. The cleanest workaround is keeping two clients, like in Option 2. There's a more involved option where you set `batch.multicall.wait` to a really high value (that's the debounce window — calls with no siblings inside `wait` ms fly solo), but that defeats the whole purpose. Two clients is cleaner, costs almost nothing, and makes the intent of each call obvious right at the import site. And if you're running wagmi on top of viem, the same pattern applies: create two configs and pick the right one per component.
