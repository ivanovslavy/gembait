# Solidity's Transient Storage delete Bug

You shipped a vault contract last quarter. (A vault is a smart contract that holds other people's funds.) The audit passed. Tests are green. It's been holding everyone's money without a hitch for months. Then on a quiet Tuesday, a user calls `deposit()` — a routine entry point that flips a reentrancy guard (a small flag that blocks a function from being re-entered mid-run) and returns. The transaction confirms. Gas is normal. No revert.

Three blocks later, a different address calls `initialize()`. That's a function that should have refused to run four months ago, because the vault was already set up. This time, it succeeds. The attacker is now the owner. The vault drains in minutes.

What happened? Your compiler wrote `sstore` where it should have written `tstore` — and zeroed out the `_owner` slot instead of your temporary reentrancy guard. Tests didn't catch it. The audit didn't catch it. The verified bytecode on Etherscan still looks fine. And up until **February 2026**, nobody knew this kind of bug even existed in Solidity.

This is **SOL-2026-1**, the Transient Storage Clearing Helper Collision. It hits contracts compiled with `--via-ir` (a newer compiler mode) on solc versions **0.8.28 through 0.8.33** that use `delete` on a transient state variable next to a matching clear of permanent storage. If that's you, upgrade to 0.8.34 and keep reading — the mechanism is worth understanding.

## The Problem

The bug is a cache mix-up inside Solidity's Yul IR code generator (the part of the compiler that turns your code into low-level instructions).

- The compiler builds one reusable helper for each distinct "zero this out" operation, so it doesn't repeat the work.
- It files each helper under the type name — e.g. `storage_set_to_zero_t_address`.
- That filing key **leaves out** which kind of storage it's for. Permanent storage (`sstore`) and temporary "transient" storage (`tstore`) end up sharing the same helper name.
- Whichever clear path the compiler sees first claims the cached helper. Every later clear of that type reuses the same body — with the wrong instruction baked in.

Think of it like two people with the same name sharing one locker: whoever opens it first decides what's inside, and the second person silently gets handed the first one's contents.

The fix in 0.8.34 is a one-line patch: stick `transient_` in front of the key when the storage is transient — exactly what the sibling helper `updateStorageValueFunction` already did.

From the Solidity team's own release post:

> "Fixed a bug in Yul IR Code Generation that could result in clearing a storage variable instead of a transient storage variable at the same position in the layout (and vice-versa)."

Plain words: **your code said "clear the temporary guard" and the compiler emitted "clear slot 0 of permanent storage."** No warning. No revert. The bytecode looks fine.

A contract is only exposed if all three of these are true:

1. It's compiled with `--via-ir` (or `settings.viaIR: true` in Standard JSON)
2. It uses `delete` on a transient state variable (the EIP-1153 `transient` keyword, which landed in solc 0.8.28)
3. The same compilation also clears permanent storage of a **matching value type**

That third one is the sneaky condition. "Matching value type" includes hidden overlaps — when the compiler clears storage arrays, it pushes every element smaller than 32 bytes through `uint256`. So a `bool[]` being shortened with `.pop()` can collide with a `uint256 transient` variable's `delete`, even though in your source code the two look nothing alike.

## The Debugging Dance

Picture yourself as the engineer whose vault just got drained. You pull the trace. First instinct is the obvious one: **the reentrancy guard is broken.** You re-read the modifier. The logic is correct. `require(_txSender == address(0), "reentrant");`, set the sender, run the body, `delete _txSender;`. Clean.

Second guess: **storage layout drift from a proxy upgrade.** (When you upgrade a contract, the old and new versions have to agree on which variable lives in which slot — drift means they don't.) You diff the implementations. Layouts match. `_owner` is at slot 0 in both versions. `_txSender` is transient — it isn't even in the permanent layout. They can't collide. Except… wait.

Third guess, because by now it's 2am and Stack Overflow is open in 8 tabs: **a reorg ate a state root.** No. The state root on that block is exactly what the archive node says it is. `_owner` really was zero when `initialize()` was called.

Here's the part that makes people slam laptops shut: none of your usual tools can see this. Your unit tests probably don't even run through `--via-ir` — most repos default to the older "legacy" pipeline in CI, and that pipeline isn't affected. Your formal verification tools treat the compiler as trustworthy; they prove your Solidity is safe and just assume the compiler translates it faithfully. Your on-chain monitoring watches for weird state changes — but a legitimate `delete` on a storage slot looks completely legitimate. The attacker never wrote to `_owner`. The compiler did.

The "aha" moment comes when somebody — in this case, the Hexens team during a compiler-source audit on February 11, 2026 — opens the generated Yul IR and greps for `storage_set_to_zero_`. They see **one** helper where there should be two: a single function, using `sstore`, called from both the permanent `delete` path **and** the transient `delete` path.

From there it's 30 minutes of reading `storageSetToZeroFunction` in the compiler source and realising the cache key is `"storage_set_to_zero_" + _type.identifier()` — with no marker for which storage it's for. Compare the neighbouring `updateStorageValueFunction`, which gets it right:

```cpp
std::string const functionName =
    "update_" +
    (_location == VariableDeclaration::Location::Transient ? "transient_s" : "") +
    "storage_value_" + ...;
```

One helper in the compiler remembers which storage it belongs to. The one right next to it doesn't. That's the whole bug — eighteen characters of missing string concatenation.

## The Solution

Three actions, in order of urgency.

**1. Upgrade.** solc 0.8.34 is a single-issue bugfix release. Bump your `pragma` or your toolchain's compiler version, recompile, redeploy. In Foundry: update `foundry.toml`'s `solc_version = "0.8.34"` and run `forge build --via-ir`. In Hardhat: update the `solc.version` in `hardhat.config.ts` and recompile.

**2. Prove your recompile is clean.** Diff the Yul IR before and after:

```bash
solc --ir --via-ir MyContract.sol > after.yul
diff before.yul after.yul | grep -E "storage_set_to_zero|transient_storage"
```

If the new IR contains two distinct helpers — `storage_set_to_zero_t_address` using `sstore` and `transient_storage_set_to_zero_t_address` using `tstore` — you're safe. If the old IR had only the first, and it was being called from both paths, you were poisoned.

**3. If you can't upgrade yet, defuse the trigger.** A single line of inline assembly replaces the poisoned helper:

```solidity
address transient _txSender;

function _clearGuard() internal {
    assembly { tstore(_txSender.slot, 0) }
}
```

This skips the Yul helper machinery entirely and emits `tstore` directly. The compiler can't mis-file what you wrote by hand. Apply the same pattern on the permanent side if the transient path is the one being miscompiled — whichever direction the collision runs, one side can be hand-written out of harm's way.

One thing **not** to do: don't try to "fix" this by renaming your transient variable or moving it to a different slot. The bug isn't about slots. It's about the shared Yul helper. Two different variables of the same value type are enough to collide, no matter how the storage is laid out.

For contracts behind an upgradeable proxy, swapping the implementation is enough. For non-upgradeable contracts already live with the vulnerability, you need a migration plan — and probably a pause on withdrawals while you carry it out.

## The Lesson

Transient storage is eighteen months old. EIP-1153 shipped in Dencun (March 2024); Solidity added the `transient` keyword in 0.8.28 (October 2024). The feature was stable, the opcode was stable — but the compiler code gluing them together was brand-new, and it shared a helper function with an eighteen-year-old code path (permanent storage clearing) that was never built to handle two kinds of storage.

That's the lesson worth keeping: **a new language feature is a new compiler surface to get wrong.** If you're one of the first teams using `transient`, `tstore`, `tload`, or anything else that only recently got a Solidity-level abstraction, your threat model has to include compiler bugs of this kind. That means pin an exact solc version, run CI with the same pipeline you ship to production (`--via-ir` if that's what deploys), bookmark the Solidity known-bugs list and the security-alerts blog, and subscribe to the compiler's release channel. Better you read about it there than a researcher like Hexens reading about it in your codebase.

Correctness is a stack. The compiler sits underneath your audit.

## Credit & Further Reading

This article is based on the detailed compiler-source analysis published by [Hexens on February 18, 2026](https://hexens.io/research/solidity-compiler-bug-tstore-poison) and the accompanying official advisory from the Solidity team at [soliditylang.org](https://www.soliditylang.org/blog/2026/02/18/transient-storage-clearing-helper-collision-bug/). Thanks to the Hexens research team for the clear reproduction cases and to the Solidity/Argot maintainers for the fast turnaround on [solc 0.8.34](https://www.soliditylang.org/blog/2026/02/18/solidity-0.8.34-release-announcement/). Deeper reading: the [List of Known Bugs](https://docs.soliditylang.org/en/latest/bugs.html) (entry `SOL-2026-1`, `TransientStorageClearingHelperCollision`) and the [EIP-1153 transient storage spec](https://eips.ethereum.org/EIPS/eip-1153).

## FAQ

**Q: How do I check whether my already-deployed contract is affected?**

A: Pull your deployment's verified source and recompile it locally with the exact solc version and settings you used (Etherscan's verified-metadata panel tells you both). Generate the Yul IR with `solc --ir --via-ir YourContract.sol` and search for `storage_set_to_zero_`. If a single helper gets called from both a permanent and a transient clear path, you're vulnerable. If you don't use `--via-ir`, or your contract has no `transient` state variable, you're safe no matter which compiler version you used.

**Q: I upgraded to 0.8.34 but haven't redeployed. Am I covered?**

A: No. The fix lives in the compiler, so the old bytecode stays bugged. You have to recompile and redeploy the implementation contract. For upgradeable proxies, that's a standard implementation swap. For non-upgradeable contracts, you need a migration — usually pausing new deposits, draining state to a new deployment, and redirecting the frontend.

**Q: Does this affect the legacy compilation pipeline?**

A: No. The bug lives only in the Yul IR pipeline. If you compile without `--via-ir` (still the default in many setups as of 0.8.33), permanent-storage clearing goes through a different code path and the helper collision can't happen. That's why a lot of projects dodged the bug by accident — their CI uses the legacy pipeline. Whether that's good news depends on whether your *production* build also uses the legacy pipeline.

**Q: Why did this take eighteen months to find?**

A: `delete` on a transient state variable is a genuinely niche pattern — the EVM's `tstore` opcode already auto-clears at the end of the transaction, so most developers never write `delete _transientGuard;` because they don't need to. The Hexens scan across 20M+ deployed contracts found roughly 500,000 compiled with affected versions plus `--via-ir`, but only four projects hitting the specific trigger pattern. Narrow blast radius, plus the need to read generated Yul IR to spot the miscompilation — the bug hid in plain sight.

**Q: Are transient mappings or arrays affected?**

A: solc 0.8.33 doesn't support transient mappings, transient arrays, or transient structs — only plain value-type transient variables. So the attack surface is limited to scalar transients (`address transient`, `uint256 transient`, etc.) colliding with permanent clears of the same scalar type. If you were rolling your own assembly-based transient mapping, you were writing `tstore` by hand anyway, and the miscompilation doesn't apply.

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I check whether my already-deployed contract is affected by SOL-2026-1?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Pull your deployment's verified source and recompile locally with the exact solc version and settings you used. Generate the Yul IR with solc --ir --via-ir YourContract.sol and search for storage_set_to_zero_. If a single helper is invoked from both a persistent and a transient clear path, you are vulnerable. If you don't use --via-ir or your contract has no transient state variable, you're safe regardless of compiler version."
      }
    },
    {
      "@type": "Question",
      "name": "I upgraded to solc 0.8.34 but haven't redeployed. Am I covered?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The fix lives in the compiler, so old bytecode stays bugged. You have to recompile and redeploy the implementation contract. For upgradeable proxies, that's a standard implementation swap. For non-upgradeable contracts, you need a migration — usually pausing new deposits, draining state to a new deployment, and redirecting the frontend."
      }
    },
    {
      "@type": "Question",
      "name": "Does the Transient Storage Clearing Helper Collision bug affect the legacy compilation pipeline?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. The bug lives only in the Yul IR pipeline. If you compile without --via-ir, persistent-storage clearing goes through a different code path and the helper collision can't happen. Many projects dodged the bug because their CI uses the legacy pipeline, but check your production build too."
      }
    },
    {
      "@type": "Question",
      "name": "Why did SOL-2026-1 take eighteen months to find?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Delete on a transient state variable is a genuinely niche pattern — the EVM's tstore opcode already auto-clears at end of transaction, so most developers never write delete _transientGuard. A Hexens scan across 20M+ deployed contracts found roughly 500,000 compiled with affected versions plus --via-ir, but only four hitting the specific trigger pattern. Narrow blast radius plus the need to read generated Yul IR to spot the miscompilation meant the bug hid in plain sight."
      }
    },
    {
      "@type": "Question",
      "name": "Are transient mappings or arrays affected by SOL-2026-1?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "solc 0.8.33 doesn't support transient mappings, transient arrays, or transient structs — only value-type transient variables. So the attack surface is limited to scalar transients (address transient, uint256 transient) colliding with persistent clears of the same scalar type. Custom assembly-based transient mapping implementations emit tstore directly and are not affected by the helper miscompilation."
      }
    }
  ]
}
</script>
