A user opens MetaMask, clicks "claim NFT", and the dashboard surfaces a single sentence: `Execution reverted for an unknown reason.` Helpful. Nothing in the logs after it. Just that.

The contract has a perfectly clear custom error — `ERC721NonexistentToken(uint256 tokenId)`. Tests catch it. A direct `cast call` on the same RPC returns the bytes with the expected selector. But the same call, routed through the app's viem client, dies with a sentence that tells you nothing.

The kicker: flip one boolean in the viem config and the same call returns `Execution reverted with reason: ERC721: owner query for nonexistent token.` That boolean is `batch.multicall`.

This is the topic of [viem issue #4006](https://github.com/wevm/viem/issues/4006), opened in May 2026 and closed `not planned` — meaning it is not a bug, but a documented (well, *un*documented) consequence of how the multicall transport batches eth_call requests. If you have ever spent half an afternoon staring at "unknown reason" wondering whether your RPC is lying to you, this post is for you.

## The Problem

In viem, `createPublicClient` accepts a `batch.multicall` option on its HTTP transport. Enable it and every `readContract` / `eth_call` issued in a tight time window gets folded into a single multicall request through Multicall3. Performance win: one RPC call instead of twenty. The default is `false`, so most projects only turn it on when they start hitting rate limits on read-heavy pages.

Here is the config from the issue, trimmed:

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

With `batch.multicall: true` the call throws:

```
ContractFunctionExecutionError: The contract function "ownerOf" reverted.
Details: Execution reverted for an unknown reason.
```

With `batch.multicall: false` (or the option removed):

```
ContractFunctionExecutionError: The contract function "ownerOf" reverted with the following reason:
ERC721: owner query for nonexistent token.
```

Same contract. Same calldata. Same RPC. The only thing that changed is which path the request took inside viem. The reporter on issue #4006 even confirmed it on the error object itself: `error.cause.cause.data` contains the same raw revert bytes in both cases. The bytes survive the round-trip. They just never make it through the formatter that turns them into human-readable text.

This is not a rare edge case. Search the wevm discussions for "multicall revert reason" and a handful of developers can be found mid-conversation, mostly convinced their RPC provider is broken. As one developer put it on the original issue, *"I was about to file a support ticket with Alchemy."*

## The Debugging Dance

Picture the room. Sentry is firing `Execution reverted for an unknown reason.` First instinct: the RPC is being weird. Switch from Alchemy to Infura. Same result. Switch to a self-hosted node. Same result. Curse.

Second guess: the ABI does not match the deployment. But the success path works — `ownerOf` for a real token returns the correct address. If the ABI were wrong, every call would fail, not just the revert path. Curse again.

Third guess: it is a custom error and the team forgot to include the error fragment in the ABI. So they add it. Nothing changes. The custom error data is in the response — `error.cause.cause.data` is something like `0x7e273289...` — but viem is not decoding it into a name. At this point Stack Overflow is open in eight tabs and the multicall docs in a ninth.

The accidental discovery: someone on the team needs to debug a slow page load, comments out the `batch: { multicall: true }` line for a minute, and posts in Slack: *"weird, your error is way more readable on my branch."* Two branches go side by side. The only diff is six characters: `true` becomes `false`. The error message goes from one sentence to two. The second sentence is the one the team has been trying to surface for three days.

That is the moment it clicks. The multicall transport wraps individual `eth_call` requests inside a Multicall3 `aggregate3` call. The Multicall3 contract returns `(bool success, bytes returnData)[]` — when an inner call reverts, its revert bytes get tucked into `returnData` and the outer eth_call succeeds. Viem unpacks the outer array fine. But the decode path that turns inner revert bytes into "Execution reverted with reason: ..." is the one written for direct `eth_call` errors, where the revert sits in the JSON-RPC error envelope. In the multicall path the bytes live in a different place on the response, the formatter never reaches them, and the user-facing message defaults to the generic fallback.

So the data is preserved. The bug is in the *narration*.

![Abstract isometric illustration of structured error data flowing through a branching pipeline — one branch keeps a detailed payload while the other reduces it to a generic glyph](/images/blog/viem-multicall-eats-revert-reasons/mid.webp)

## The Solution

There are three real options. Pick by trade-off.

**Option 1 — Decode the bytes yourself.** The revert data is preserved on the error chain. Walk it and decode.

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

`walk()` is the documented way to traverse viem's error chain. The new bit is the `decodeErrorResult` fallback for the multicall case, where the walker did not find a pre-decoded revert and the raw bytes have to be turned into a name manually.

**Option 2 — Two clients, one per use case.** A surprisingly common production pattern: keep `batch.multicall: true` for high-volume read endpoints (NFT galleries, leaderboards, token lists) where reverts are rare and the generic error is acceptable, and create a second client with batching off for code paths that drive UX, where a clear revert reason matters more than 50ms of latency.

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

Use `fastClient` for the gallery page. Use `clearClient` for the mint button. The wallet provider stays the same; only the read transport differs.

**Option 3 — Simulate first.** `simulateContract` always uses a direct `eth_call`, so it gets the full revert reason regardless of the transport setting. Add it as a preflight for any write you are about to broadcast. It is the pattern the viem docs already recommend for `writeContract`, and it incidentally fixes this too.

What is non-obvious: the explicit `multicall()` function (the one called by name with `contracts: [...]`) is **not** what is biting you. That function defaults `allowFailure: true` and returns `{ status: 'failure', error }` per call, with the error correctly decoded against the ABI. The trap is only the *implicit* batching — the silent kind enabled by the transport option.

## The Lesson

Performance optimizations that silently degrade observability are the worst kind of leaky abstraction, because they are invisible exactly when you need them most: 11pm, production traffic, a user yelling on Discord, and "execution reverted for an unknown reason" in the logs.

When a library exposes an optimization flag like `batch.multicall`, ask two questions before turning it on: *what does it cost when something fails?* and *will I be able to tell?* The answers should be in the docs. When they are not, find out before production traffic does it for you. A 50ms saving on a gallery page is not worth a three-day investigation when a single mint button starts throwing nonsense errors.

The wider principle: any layer between your code and the wire that is allowed to *rewrite* errors needs to round-trip them losslessly. If it cannot, it should at least warn you in the type signature or the docs that error fidelity changes when the layer is enabled. Until then, two clients is a tiny price for a debugging session you do not have to live through.

## Credit & Further Reading

This article is based on the problem discussed in [viem issue #4006](https://github.com/wevm/viem/issues/4006). The reporter laid out a clean reproduction with a Base chain ERC721 call, which made it possible to see exactly where the decode path diverges. For the underlying primitives, see the [viem `decodeErrorResult` reference](https://viem.sh/docs/contract/decodeErrorResult) and the [Multicall3 contract source](https://github.com/mds1/multicall) by `@mds1`. The HTTP transport options, including the full shape of `batch.multicall`, are documented at [viem.sh/docs/clients/transports/http](https://viem.sh/docs/clients/transports/http).

## Frequently Asked Questions

### Does this affect the explicit multicall() function too?

No — and this is the important distinction. The explicit `multicall()` action, called with a `contracts: [...]` array, returns a result array where failed calls show up as `{ status: 'failure', error }` when `allowFailure: true` (the default). The `error` object there is properly decoded against the ABI you passed. The issue only affects the **implicit** batching that happens when `batch.multicall: true` is set on the HTTP transport — that path runs through a different formatter that does not reach into the inner Multicall3 `returnData` when wrapping the error. So you can keep using `multicall()` directly without changing anything; the trap is only the silent kind.

### Will turning off batch.multicall kill read performance?

In most production apps, no. The win from `batch.multicall` is real for pages that fire twenty or more reads on mount — NFT galleries, multi-token balance fetches, vault dashboards — but most user-facing flows fire one to three reads at a time, where the wait window adds latency without saving an RPC call. Measure before optimizing. A pragmatic split is the one suggested above: a fast client for batch-heavy reads, a clear client for UX-critical paths where the revert reason matters. Most teams running this pattern report the same: gallery pages stay snappy, mint flows stay debuggable.

### Why was the issue closed as not planned?

The maintainers did not comment publicly, but the likely reason is architectural. Viem's error formatting layer is built around a one-call, one-response model, and the multicall path returns N responses inside a single RPC reply. Threading inner revert data back through the error formatter touches a lot of code and introduces ambiguity when multiple calls revert in a single batch — which error wins, which gets logged, which is shown to the user? Saying "decode it yourself with `walk()` and `decodeErrorResult`" is the lower-risk answer for a library that prizes type safety and predictable error shapes, even if it is frustrating in the moment.

### What about OpenZeppelin v5 custom errors like ERC721NonexistentToken?

Same problem, slightly different decode. Custom errors are encoded as the 4-byte selector plus ABI-encoded arguments. If your contract uses OpenZeppelin v5 custom errors, they live in your contract's ABI as `error` fragments. As long as those fragments are in the ABI you pass to `decodeErrorResult`, the function returns `{ errorName: 'ERC721NonexistentToken', args: [tokenId] }` cleanly. If they are missing from the ABI, the call returns the raw bytes and you have to add the error fragments — viem does not (and cannot) infer custom errors that are not in your ABI. A common mistake here is using a hand-trimmed ABI that includes the function signatures but drops the error fragments to save bytes. Keep the errors in.

### Is there a way to opt out of multicall just for a single read?

Not directly — `batch.multicall` is a transport-level setting, not a per-call one. The cleanest workaround is to maintain two clients, as in Option 2. A more involved option is to set `batch.multicall.wait` to a very high value (it is the debounce window — calls without siblings inside `wait` ms fly solo), but that defeats the purpose. Two clients is cleaner, costs almost nothing, and makes the intent of each call obvious at the import site. If you are using wagmi on top of viem, the same pattern applies: create two configs and pick the right one per component.
