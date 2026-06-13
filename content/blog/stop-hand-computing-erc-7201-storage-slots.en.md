You upgrade a vault contract on Tuesday. Tests pass. The storage layout report comes back clean. The proxy points at the new code, and the first user deposit lands. Their balance is correct. Two days later, a different user withdraws — and gets the wrong number back. Not zero. A *different non-zero number*. There's no error in the logs. The transaction succeeded. Etherscan shows the call data exactly as the frontend sent it.

You know that sinking feeling? It's the one you get when you realize the bug isn't in your code — it's in storage, the place on-chain where your contract keeps its data. To be exact, it's in a hex constant one of your contracts uses to anchor its data. That constant was supposed to be `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300` but is actually `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199301`.

One character. One digit at the very end. And now every read from that data block hits a spot that another contract's data block is *also* writing to. Two contracts, scribbling over the same page.

This problem has had a name and a workaround for two years. As of [Solidity v0.8.35, released on April 29, 2026](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701), it finally has a fix built right into the language — and you should be using it on every new upgradeable contract you ship.

## The problem: ERC-7201, but typed by hand

If you've written an upgradeable contract since 2024 (a contract you can swap out for a new version later), you've seen this pattern:

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

That comes straight from `OwnableUpgradeable.sol` in OpenZeppelin Contracts v5. It uses [ERC-7201 namespaced storage](https://eips.ethereum.org/EIPS/eip-7201). The idea is simple: instead of letting the default storage allocator pick where your data goes — which gets jumbled the moment your inheritance changes — every contract claims its own private corner. Think of it like assigning each contract a permanent locker number derived from its name, so two contracts never reach into the same locker. The number comes from the formula `keccak256(keccak256(id) - 1) & ~0xff`, where `id` is a string nobody else uses (`"openzeppelin.storage.Ownable"` here).

The math is solid. The risk is that **that locker number is a 32-byte hex constant you typed in by hand**. The compiler doesn't check it. The comment above it (`@custom:storage-location`) is just a comment — it does nothing. So if you change `openzeppelin.storage.Ownable` to `mycompany.storage.Vault` and forget to recompute `OwnableStorageLocation`, your "Vault" reads happily from the Ownable locker. No revert. No warning. Two contracts writing to the same place.

People have asked about this over and over. Search `"erc7201"` and `"storage location"` together and you'll find dozens of GitHub Issues, OpenZeppelin Forum threads, and audit findings. RareSkills [puts it bluntly](https://rareskills.io/post/erc-7201): *"A single character error in the hardcoded constant is catastrophic… verification requires manual code review or formal verification tools."* That's a hard sentence to read when shipping contracts is how you pay the bills.

## The Debugging Dance

Here's how this kind of incident actually plays out — we've seen the pattern across audits and our own GembaTools deployments.

**First instinct: the ABI is wrong.** The ABI is the contract's interface description, the thing your app reads to know how to call it. So you re-export the artifact, regenerate the typings, retry. The ABI is fine.

**Second guess: the proxy points at the wrong code.** A proxy is the stable address users talk to; it forwards calls to whatever implementation it's pointed at. So you open Etherscan and check the implementation slot — the standard EIP-1967 one, `0x360894...`. Correct. Curse.

**Third: maybe Hardhat compiled with a stale version.** So you wipe `cache/` and `artifacts/` and recompile. Same bytecode hash. Same bug.

**Fourth, and finally useful: dump the raw storage slots.** This is the moment everything clicks. You read slot `0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300` and find what looks like an address that has no business being there — it's the owner of an *unrelated* contract that shares your proxy. Then you read the slot you *meant* to use, the one you typed by hand, and find a `uint256` that should never have been there.

By now Stack Overflow is open in eight tabs and your blood pressure has joined them. You compute the namespace by hand on a notepad. You compute it again with `cast keccak`. You compute it a third time in a `keccak256` REPL. All three agree. The constant in your contract is one byte off. Maybe someone copy-pasted from another project's example and never re-ran the formula. Maybe it was a typo while transcribing from Remix. It doesn't matter. The contract has been corrupting state in production for 49 hours, and the only fix is a redeploy.

> "Tools like Remix or custom scripts execute the calculation once during contract development. The constant is then hardcoded." — RareSkills, on the de facto workflow

That sentence describes the whole problem in passing. The compiler had no idea what your namespace string was supposed to mean. It saw a `bytes32` constant. It accepted it. The runtime looked up that slot. Done.

![Abstract isometric visualization of a smart contract storage namespace lookup, two glowing lattice structures resolving to overlapping slots, blue and purple gradient on dark background.](/images/blog/stop-hand-computing-erc-7201-storage-slots/mid.webp)

## What 0.8.35 actually adds

The Solidity team [announced 0.8.35](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701) on April 29, 2026 with what they call the *first* comptime builtin in the language: `erc7201`. ("Comptime" just means it runs at compile time, before your contract is ever deployed.) The changelog entry is one sentence:

> "Add a builtin that computes the base slot of a storage namespace using the `erc7201` formula from ERC-7201."

In plain words: the compiler now gives you a function you can use right where you'd put a constant. You hand it a namespace string, it hands you back the correct slot — and you never type a single hex digit. The pattern above becomes:

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

That's the whole change. The constant is no longer typed; it's *computed* at compile time, from the same string that appears in the `@custom:storage-location` comment. You can also pass the result straight to a `layout at` specifier when you want to anchor an entire contract's layout to the namespace.

Three things are worth pinning down:

1. **It runs at compile time, not at runtime.** Calling `erc7201(...)` produces a `bytes32` value while the compiler works; there's no extra code, no extra opcode, no runtime cost. The deployed bytecode holds the exact same hex constant you had before — you just no longer have to work it out yourself.
2. **The comment and the builtin argument are still separate strings.** This is the one trap the new feature doesn't erase: if the comment says `erc7201:foo.bar` and the call says `erc7201("foo.baz")`, your tooling and your runtime disagree. Audit reviewers should flag the mismatch; eventually the compiler probably will too.
3. **0.8.35 also formalizes an `--experimental` flag** to gate in-development features and ships an experimental `--via-ssa-cfg` codegen aimed at stack-too-deep errors. `erc7201` is *not* experimental — it's stable and behind no flag. Use it freely.

## The lesson: hand-typed cryptographic constants are technical debt

This was always the right move. The whole ERC-7201 idea — the EIP, the OZ implementation, the dozens of forks — works *because* the slot is uniquely determined by a string. And the compiler has always known how to hash strings. The only reason developers were typing the result by hand is that the language never gave them a way to ask the compiler to do it for them.

There's a broader pattern here. Anywhere a deployment depends on a derived constant — function selectors, EIP-712 typehashes, role identifiers, slot roots — the safe move is the same: let the compiler derive it, and you just write the one source-of-truth string. Selectors got this right with `IERC20.transfer.selector`. Typehashes got it half-right with `keccak256(bytes("..."))` — still a hash you can mistype, but at least the input is the literal string. ERC-7201 was the worst of all worlds: a string in a comment, and a hand-typed hash on the next line, with nothing tying the two together.

If you maintain an upgradeable codebase pinned to ^0.8.20 because the OZ Upgradeable docs said so, now's the moment to bump to ^0.8.35. The migration is mechanical: replace each hardcoded `bytes32` constant with `erc7201("the.same.string.in.your.comment")`. Then write a one-time migration test that re-reads every namespace's first slot on the new implementation and confirms it matches the slot on the old one. If it matches, you had it right all along. If it doesn't, you just caught a bug that's been quietly corrupting state.

This is the same checklist we run on GembaTools' factory contracts before every deploy: every namespace string is canonicalized, every constant is now `erc7201(...)`, and the migration test reads the slot at the proxy after upgrade to confirm nothing moved.

## Credit & further reading

This article is based on the [Solidity v0.8.35 release announcement](https://forum.soliditylang.org/t/solidity-v0-8-35-is-out/3701) by the Solidity team (forum post by `czepluch`, April 29, 2026), and the [ERC-7201 specification](https://eips.ethereum.org/EIPS/eip-7201). The deep-dive on why the formula uses double-hashing, subtraction, and last-byte masking comes from the [RareSkills ERC-7201 explainer](https://rareskills.io/post/erc-7201). The reference implementation pattern is taken from [OpenZeppelin's `OwnableUpgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/access/OwnableUpgradeable.sol) in Contracts v5.

For deeper reading on namespaced storage in production, see the [OpenZeppelin Contracts Upgradeable v5 docs](https://docs.openzeppelin.com/contracts/5.x/upgradeable). For the compiler-side detail of how comptime builtins work, watch the [Solidity 0.8.x changelog](https://github.com/argotorg/solidity/blob/develop/Changelog.md).

## Frequently Asked Questions

### Does upgrading to 0.8.35 change the bytecode of existing contracts?

No — not unless you actually swap the hardcoded constants for `erc7201(...)`. Either way the compiler produces the same `bytes32` literal in the bytecode; the only difference is whether you computed that literal (with the chance of a typo) or the compiler did (always correct). If you bump the compiler version but leave your hand-typed constants in place, your bytecode is identical aside from any unrelated 0.8.35 codegen improvements. The `erc7201(...)` change is purely a refactor for safety. Run a bytecode diff before and after to confirm.

### What happens to my proxy if I change the namespace string in a new implementation?

You'll silently corrupt your storage. The whole point of the namespace string is that it deterministically picks a storage root; change the string and you change the root, so all reads now hit a different slot than the one your previous implementation wrote to. Treat namespace strings as part of the contract's permanent ABI. Pin them in source-of-truth form and never edit them in an upgrade. If you need new state, define a *new* namespace alongside the old one — that's exactly what ERC-7201 was built to allow.

### Can I still use the old hardcoded approach in 0.8.35?

Yes. `erc7201(...)` is additive — the compiler still accepts a `bytes32` literal as the storage root via inline assembly, exactly as before. Existing OpenZeppelin Upgradeable contracts compile unchanged on 0.8.35. The only reason to migrate is safety: every hardcoded constant is a spot where one typo causes silent state corruption with no error message. New contracts should use the builtin. Existing audited contracts can stay as they are if you've already verified the constants by formal means.

### Does the `@custom:storage-location` annotation still matter when using `erc7201(...)`?

Yes. The annotation is what tools — storage layout reporters, audit tools, OpenZeppelin's upgrade plugin — read to *describe* the namespace in their reports. The builtin computes the runtime constant, but it doesn't write the comment for you. Keep the annotation in sync with the string you pass to `erc7201(...)`: if a tool sees `erc7201:foo` in the comment but you computed the slot from `bar`, the tool's collision-detection will be wrong. Treat the annotation and the builtin call as a paired declaration that must match.

### Is the new `--experimental` flag related to `erc7201`?

No. `erc7201` is stable in 0.8.35 and needs no flag. The new `--experimental` flag gates a separate set of in-development features, including the SSA CFG code generator (`--via-ssa-cfg`), an experimental `@future` EVM version, and the previously-experimental `ssa-cfg` Yul codegen. The Solidity team formalized the experimental lifecycle in this release so future preview features can ship in stable releases without anyone accidentally relying on them. If you want to try the SSA CFG codegen for stack-too-deep relief, opt in with `--experimental --via-ssa-cfg`; everything else, including `erc7201`, is on by default.
