You upgrade a vault contract on Tuesday. Tests pass. Storage layout report: clean. The proxy points at the new implementation, and the first user deposit comes in. Their balance is correct. Two days later, a different user withdraws — and gets the wrong number back. Not zero. A *different non-zero number*. There is no error in the logs. The transaction succeeded. Etherscan shows the call data exactly as the frontend sent it.

That sinking feeling? It's the one you get when you realize the bug is in storage, not in code. Specifically, in a hex constant that one of your contracts uses to anchor its namespaced storage struct — a constant that was supposed to be `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300` but is actually `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199301`.

One character. One end-of-byte. And every read from that struct now hits a slot that another struct in another contract is *also* writing to.

This problem has had a name and a workaround for two years. As of [Solidity v0.8.35, released on April 29, 2026](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701), it has a fix at the language level — and you should be using it on every new upgradeable contract you ship.

## The problem: ERC-7201, but typed by hand

If you have written an upgradeable contract since 2024, you have seen this pattern:

```solidity
/// @custom:storage-location erc7201:openzeppelin.storage.Ownable
struct OwnableStorage {
    address _owner;
}

// keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant OwnableStorageLocation =
    0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
    assembly {
        $.slot := OwnableStorageLocation
    }
}
```

That is straight from `OwnableUpgradeable.sol` in OpenZeppelin Contracts v5. It implements [ERC-7201 namespaced storage](https://eips.ethereum.org/EIPS/eip-7201): instead of relying on the slot-zero allocator that gets jumbled when inheritance changes, every contract carves out its own deterministic root at `keccak256(keccak256(id) - 1) & ~0xff`, where `id` is a string nobody else uses (`"openzeppelin.storage.Ownable"` in this case).

The math is sound. The risk is that **the root is a 32-byte hex constant you typed in by hand**. The compiler does not check it. The annotation comment is just a comment. If you change `openzeppelin.storage.Ownable` to `mycompany.storage.Vault` and forget to recompute `OwnableStorageLocation`, your "Vault" namespace happily reads from the Ownable namespace. No revert. No warning. Two structs writing to the same slots.

This has been asked over and over. Searching `"erc7201"` and `"storage location"` together returns dozens of GitHub Issues, OpenZeppelin Forum threads, and audit findings. RareSkills [puts it bluntly](https://rareskills.io/post/erc-7201): *"A single character error in the hardcoded constant is catastrophic… verification requires manual code review or formal verification tools."* That is a hard sentence to read when you ship contracts for a living.

## The Debugging Dance

Here is how this kind of incident actually unfolds, because we have seen the pattern across multiple audits and our own GembaTools deployments.

**First instinct: the ABI is wrong.** Re-export the artifact, regenerate the typings, retry. The ABI is fine.

**Second guess: the proxy is pointing at the wrong implementation.** Open Etherscan, check the implementation slot (the EIP-1967 one — `0x360894...`). Correct. Curse.

**Third: maybe Hardhat compiled with a stale version.** Wipe `cache/` and `artifacts/`. Recompile. Same bytecode hash. Same bug.

**Fourth, finally productive: dump storage slots.** This is the moment everything becomes obvious. You read slot `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300` and find what looks like an address that doesn't belong there — it's the owner of an *unrelated* contract that shares your proxy. Then you read your *intended* slot, the one you typed by hand, and find a `uint256` that should never have been there.

At this point Stack Overflow is open in eight tabs and your blood pressure has joined them. You compute the namespace by hand on a notepad. You compute it again with `cast keccak`. You compute it a third time using a `keccak256` REPL. All three agree. The constant in your contract is one byte off. Possibly because someone copy-pasted from another project's example and didn't re-run the formula. Possibly because of a typo while transcribing from Remix. It does not matter. The contract has been corrupting state in production for 49 hours, and the fix is a redeploy.

> "Tools like Remix or custom scripts execute the calculation once during contract development. The constant is then hardcoded." — RareSkills, on the de facto workflow

That sentence describes the entire problem in passing. The compiler had no idea what your namespace string was supposed to mean. It saw a `bytes32` constant. It accepted it. The runtime looked up that slot. Done.

![Abstract isometric visualization of a smart contract storage namespace lookup, two glowing lattice structures resolving to overlapping slots, blue and purple gradient on dark background.](/images/blog/stop-hand-computing-erc-7201-storage-slots/mid.webp)

## What 0.8.35 actually adds

The Solidity team [announced 0.8.35](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701) on April 29, 2026 with what they call the *first* comptime builtin in the language: `erc7201`. The changelog entry is one sentence:

> "Add a builtin that computes the base slot of a storage namespace using the `erc7201` formula from ERC-7201."

Translated, that means the compiler now exposes a function — usable in constant-expression contexts — that takes a namespace string and gives you back the canonical slot, without you ever typing a hex digit. The pattern above becomes:

```solidity
pragma solidity ^0.8.35;

/// @custom:storage-location erc7201:openzeppelin.storage.Ownable
struct OwnableStorage {
    address _owner;
}

bytes32 private constant OwnableStorageLocation =
    erc7201("openzeppelin.storage.Ownable");

function _getOwnableStorage() private pure returns (OwnableStorage storage $) {
    assembly {
        $.slot := OwnableStorageLocation
    }
}
```

That is the entire change. The constant is no longer typed; it is *computed* at compile time, from the same string that appears in the `@custom:storage-location` comment. You can also pass the result directly to a `layout at` specifier when you need to anchor an entire contract layout to the namespace.

Three things are worth pinning down:

1. **It is a comptime builtin, not a runtime function.** Calling `erc7201(...)` produces a `bytes32` value during compilation; there is no codegen, no extra opcode, no runtime cost. You get the same hex constant in the deployed bytecode that you had before — you just no longer have to compute it yourself.
2. **The annotation comment and the builtin argument are still independent strings.** This is the one footgun the new feature does not erase: if the comment says `erc7201:foo.bar` and the call says `erc7201("foo.baz")`, your tooling and your runtime disagree. Audit reviewers should flag mismatches; eventually the compiler probably will too.
3. **The 0.8.35 release also formalizes an `--experimental` flag** to gate in-development features and ships an experimental `--via-ssa-cfg` codegen targeting stack-too-deep errors. `erc7201` is *not* experimental — it is stable and behind no flag. Use it freely.

## The lesson: hand-typed cryptographic constants are technical debt

This was always the right move. The Solidity issue — the EIP, the OZ implementation, the dozens of forks — works *because* the slot is uniquely determined by a string identifier. The compiler has always known how to hash strings. The only reason developers were typing the result by hand is that the language did not give them a way to ask the compiler to do it.

There is a broader pattern here. Anywhere a deployment depends on a derived constant — selectors, EIP-712 typehashes, role identifiers, slot roots — the safe move is "let the compiler derive it; you just write the source-of-truth string." Selectors got this right with `IERC20.transfer.selector`. Typehashes got it half-right with `keccak256(bytes("..."))` (still a hash you can mistype, but at least the input is the literal string). ERC-7201 was the worst of all worlds: a string in a comment, and a hand-typed hash on the next line, with nothing tying them together.

If you maintain an upgradeable codebase that pinned to ^0.8.20 because the OZ Upgradeable docs said so, this is the moment to bump to ^0.8.35. The migration is mechanical: replace each hardcoded `bytes32` constant with `erc7201("the.same.string.in.your.comment")`. Then write a one-time migration test that re-reads every namespace's first slot at the post-upgrade implementation and confirms it equals the slot at the pre-upgrade implementation. If it does, you had it right. If it does not, you just found a bug that has been quietly corrupting state.

This is the same checklist we run on GembaTools' factory contracts before every deploy: every namespace string is canonicalized, every constant is now `erc7201(...)`, and the migration test reads the slot at the proxy after upgrade to confirm continuity.

## Credit & further reading

This article is based on the [Solidity v0.8.35 release announcement](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701) by the Solidity team (forum post by `czepluch`, April 29, 2026), and the [ERC-7201 specification](https://eips.ethereum.org/EIPS/eip-7201). The deep-dive on why the formula uses double-hashing, subtraction, and last-byte masking comes from the [RareSkills ERC-7201 explainer](https://rareskills.io/post/erc-7201). The reference implementation pattern is taken from [OpenZeppelin's `OwnableUpgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/access/OwnableUpgradeable.sol) in Contracts v5.

For deeper reading on namespaced storage in production, see the [OpenZeppelin Contracts Upgradeable v5 docs](https://docs.openzeppelin.com/contracts/5.x/upgradeable). For the compiler-side detail of how comptime builtins work, watch the [Solidity 0.8.x changelog](https://github.com/argotorg/solidity/blob/develop/Changelog.md).

## Frequently Asked Questions

### Does upgrading to 0.8.35 change the bytecode of existing contracts?

No, not unless you actually replace the hardcoded constants with `erc7201(...)`. The compiler still produces the same `bytes32` literal in the bytecode either way; the difference is whether the literal is computed by you (with potential typos) or by the compiler (always correct). If you bump the compiler version but leave your hand-typed constants in place, your bytecode is identical aside from any unrelated 0.8.35 codegen improvements. The `erc7201(...)` change is purely a refactor for safety. Run a bytecode diff before and after to confirm.

### What happens to my proxy if I change the namespace string in a new implementation?

You will silently corrupt your storage. The whole point of the namespace string is that it deterministically picks a storage root; if you change the string, you change the root, and all reads now hit a different slot than the one your previous implementation wrote to. Treat namespace strings as part of the contract's permanent ABI. Pin them in source-of-truth form and never edit them in an upgrade. If you need to introduce new state, define a *new* namespace alongside the old one — that is what ERC-7201 was designed to enable.

### Can I still use the old hardcoded approach in 0.8.35?

Yes. `erc7201(...)` is additive — the compiler still accepts a `bytes32` literal as the storage root via inline assembly, exactly as before. Existing OpenZeppelin Upgradeable contracts will compile unchanged on 0.8.35. The only reason to migrate is safety: every hardcoded constant is a place where a single typo causes silent state corruption with no error message. New contracts should use the builtin. Existing audited contracts can stay as they are if you have already verified the constants by formal means.

### Does the `@custom:storage-location` annotation still matter when using `erc7201(...)`?

Yes. The annotation is what tools (storage layout reporters, audit tools, OpenZeppelin's upgrade plugin) read to *describe* the namespace in their reports. The builtin computes the runtime constant, but it does not write the comment for you. Keep the annotation in sync with the string you pass to `erc7201(...)` — if a tool sees `erc7201:foo` in the comment but you computed the slot from `bar`, the tool's collision-detection logic will be wrong. Treat the annotation and the builtin call as a paired declaration that must match.

### Is the new `--experimental` flag related to `erc7201`?

No. `erc7201` is stable in 0.8.35 and requires no flag. The new `--experimental` flag gates a separate set of in-development features, including the SSA CFG code generator (`--via-ssa-cfg`), an experimental `@future` EVM version, and the previously-experimental `ssa-cfg` Yul codegen. The Solidity team formalized the experimental lifecycle in this release so that future preview features can ship in stable releases without accidentally being relied on. If you want to try the SSA CFG codegen for stack-too-deep relief, opt in with `--experimental --via-ssa-cfg`; everything else, including `erc7201`, is on by default.
