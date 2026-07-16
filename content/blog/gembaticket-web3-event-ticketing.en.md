---
title: "We're Launching GembaTicket"
slug: "gembaticket-web3-event-ticketing"
date: "2026-07-16"
lastUpdated: "2026-07-16"
author: "Slavcho Ivanov and the GEMBA IT team"
cluster: "company-news"
tags:
  - gembaticket
  - event-ticketing
  - web3
  - nft-tickets
  - gembablockchain
  - invisible-blockchain
readingTime: 9
excerpt: "Fifteen months of building, rebuilding, and refusing to quit: GembaTicket is a modern web3 ticketing platform where the blockchain is invisible, the fees are zero, and organizers get paid the moment a ticket sells."
hero: "/images/blog/gembaticket-web3-event-ticketing/hero.webp"
heroRetina: "/images/blog/gembaticket-web3-event-ticketing/hero@2x.webp"
midImage: "/images/blog/gembaticket-web3-event-ticketing/mid.webp"
midImageRetina: "/images/blog/gembaticket-web3-event-ticketing/mid@2x.webp"
---

# We're Launching GembaTicket

I'll start with the contradiction that shaped everything.

I love blockchain. I've loved it since before it was fashionable and long after it stopped being — the idea that you can prove something happened without asking anyone to trust you. But every time I watched a normal person try to actually *use* a web3 product, I felt the same wince: connect a wallet, approve a network, sign a transaction, pay gas in a token you had to buy first. We built cathedrals of cryptography and then made people fill in a customs form to walk through the door.

So I set myself a rule that sounds almost hostile to the technology I love: **build something on blockchain that a person who has never heard the word "wallet" can use without ever learning it.** Not hide the value — hide the machinery. And that's exactly what we did.

This month, after fifteen months of work, **GembaTicket** — a modern web3 event-ticketing platform — is in its final phase before launch. GEMBA IT is a step away from turning it on for real, and I decided it was time to stop building quietly and tell you what it is.

## Fifteen months, and every one of them earned

I started this in April 2025. What I have today barely resembles what I sketched back then — it changed shape more times than I can count, because the honest version of "we built a platform" is "we built several, threw most of them away, and kept what survived contact with reality."

Along the way I talked to a lot of independent builders. More than a few told me, kindly, that what I was describing was a hard problem — that the seams between payments, an on-chain layer, a live entry system, and a normal-person UX were exactly where projects like this fall apart. They weren't wrong. There were weeks I stopped shipping features entirely and sat with a single architectural knot — how to make on-chain actions feel instant, how to make a QR that can't be screenshotted and resold, how to let a scanner at a gate work offline — until it came loose. Then I'd start again.

I didn't quit. That's not a personality boast; it's the only reason this exists. And now that it works, I want to share the whole thing.

## What GembaTicket actually is

A modern platform for selling tickets to events, with **zero platform fees** for organizers *and* attendees — and a blockchain underneath that nobody has to see.

For the **organizer**, it's a full dashboard. Create an event, add ticket categories, map them to entry zones, and schedule how they go on sale — by date, or by sell-out, so your Early-Bird can hand off to General Admission automatically, and on the day only a pricier Last-Chance tier is left. Issue free promo tickets for friends, partners and press. Provision as many scanner devices as your doors need, each locked to the zones it may admit. Registration is free and open; the only thing you need to start taking real money is a GembaPay account.

For the **attendee**, it's almost aggressively simple. No account. No app. No wallet. You buy a ticket with nothing but an email address, and the ticket lands in your inbox the instant the payment clears. Open it and there's a live QR that refreshes every 30 seconds — so a screenshot is worthless seconds later. If you want, you can claim a free, multi-page NFT keepsake of the event to your own wallet — but that's a gift, never a requirement, and it costs you nothing, not even gas.

![A GembaTicket event page: the on-chain smart-contract address, live sales and check-in stats, one click from scanners and zones](/images/blog/gembaticket-web3-event-ticketing/mid.webp)

## The hard part was making it look easy

The whole product is a magic trick, and the trick is that the interesting engineering is the part you never notice.

**The blockchain is invisible.** GembaTicket runs on **GembaBlockchain** — our own EVM-compatible Layer-1 with effectively zero gas — and the backend does the signing and relaying on the user's behalf. Buying a ticket touches no wallet. Claiming the NFT is a single free, gasless signature and the collectible simply appears. Every event is a real on-chain contract, every ticket is verifiable, and the attendee experiences none of it. That inversion — real cryptographic guarantees, zero cryptographic friction — was the hardest thing to get right, and it's the thing I'm proudest of.

**The entry system is built for real doors.** The QR isn't a static code you can pass around; it's a rotating, signed credential that changes every 30 seconds. Scanners are bound to zones — a VIP reader admits VIP and Stage but not General, a main-gate reader admits everyone — and the whole thing scales from a single door to a three-day festival with multiple entrances. Because the scanner API is device-agnostic, the same door can run on a phone, a tablet, or a cheap Raspberry Pi wired to a professional 2D reader and a relay — which matters a lot for fixed venues that don't want to hand out tablets.

**The money moves the right way.** Here's a detail organizers feel immediately: most ticketing platforms hold your money until after the event, then wire it two to six weeks later, minus their cut. GembaTicket doesn't. Payments run through **GembaPay**, and the organizer's balance is credited **the moment a ticket sells** — fresh cashflow upfront, not a delayed payout. No platform fees on top of it.

## The stack, for the curious

For anyone who reads this blog for the engineering: a Node and Prisma backend, React apps for the storefront and the organizer dashboard, PostgreSQL and Redis, our own EVM Layer-1 (**GembaBlockchain**, ~0 gas) for the event contracts, IPFS for the NFT metadata and the multi-page ticket artwork, **GembaPay** for payments (cards and PayPal), and a standalone scanner PWA for gate staff — plus the headless Raspberry Pi reader for venues that prefer hardware. The platform has been through several internal security audits; the only work left before launch is final polish, final testing, and one last audit pass.

## Isn't this already a solved problem?

Fair question. There are other ticketing platforms — and yes, a couple of them have tried the "NFT tickets" angle. On the whole market you can count the serious attempts at web3 ticketing on one hand.

But none of them are quite the same animal, and the difference is the entire thesis. Most web3-ticketing projects made the blockchain the *product* — they forced wallets, crypto and jargon onto fans who never asked for any of it, and most of them are gone now. We did the opposite: the blockchain is a silent layer the customer never notices, so buying a GembaTicket feels like buying any ticket — just cheaper, faster, and without the paper. Add the two things nobody else pairs together — **zero blockchain fees for users** and **money that lands on the organizer's balance instantly** — and the gap stops being cosmetic.

And the real moat is that we own the whole rail. Because **GembaBlockchain** and **GembaTicket** are built by the same house, the integrations are trivial where everyone else negotiates: no third-party chain, no gas markets, no per-transaction toll passed to the attendee. That vertical integration is an advantage a competitor renting infrastructure simply can't copy.

## We're looking for a co-founder

Here's the honest gap. I'm the technical founder — the entire stack, the blockchain, the backend, the scanner system, the audits are mine. What GembaTicket needs next isn't more engineering; it's someone to open the market.

So I'm looking for an experienced **commercial co-founder** — someone with a real network among event organizers, promoters and venues, who can land organizers and own go-to-market across the **EU and the USA** (I'd happily work with two, one per market). If that's you, or you know that person, I put the whole story in a short deck: **[the co-founder pitch (PDF)](https://gembaticket.com/gembaticket-cofounder-pitch.pdf)**.

You can reach me through the [GembaTicket contact form](https://gembaticket.com/contact), see the product at [gembaticket.com](https://gembaticket.com), the payments rail at [gembapay.com](https://gembapay.com), and me at [slavy.gembait.com](https://slavy.gembait.com).

## The short version

- **GembaTicket** is a modern web3 event-ticketing platform, in its final phase before launch — fifteen months in the making, started April 2025.
- **Zero platform fees** for organizers and attendees. Buyers need only an email — no account, no app, no wallet.
- The blockchain is **invisible**: our own **GembaBlockchain** (≈0 gas), backend-signed and relayed, real on-chain contracts, a free optional NFT keepsake.
- Rotating 30-second QR entry, zone-aware scanners, and hardware (Raspberry Pi) readers for fixed venues.
- Organizers are paid **the moment a ticket sells** via GembaPay — not weeks after the event.
- We're hiring a **commercial co-founder** for the EU/USA. [Read the pitch.](https://gembaticket.com/gembaticket-cofounder-pitch.pdf)

## Frequently Asked Questions

### Do I need a crypto wallet to buy a GembaTicket?

No. That's the entire point. You buy a ticket with just an email address — no account, no app, no wallet, no crypto knowledge of any kind. The ticket is delivered to your inbox the moment payment clears, and it opens straight from the email with a live entry QR. The blockchain is there underneath, making every ticket verifiable, but the backend handles all of it on your behalf. Claiming the optional NFT keepsake later is a single free, gasless signature — but even that is never required.

### How is GembaTicket different from other NFT ticketing platforms?

Most web3-ticketing platforms made the blockchain the product — forcing fans to install wallets, buy crypto, and pay gas. GembaTicket makes the blockchain an invisible layer: buyers use email, organizers use a normal dashboard, and nobody deals with wallets or gas. On top of that, GembaTicket charges zero platform fees and pays organizers instantly — the balance is credited the moment a ticket sells, rather than weeks after the event. Because GembaTicket runs on our own GembaBlockchain, there are no third-party chain fees passed to users, which is an advantage platforms renting external infrastructure can't match.

### What does it cost organizers and attendees?

GembaTicket charges no platform fees to either side. Attendees pay exactly the price shown — no surprise service fees at checkout. The only deduction is the standard payment-processing fee on the sale (via GembaPay's card and PayPal rails), which comes out of the organizer's proceeds; blockchain usage itself is free, because GembaBlockchain has effectively zero gas. Organizers register for free and receive their revenue instantly to their balance.

### When can I use GembaTicket?

It's in its final phase — the platform is built and has been through several internal security audits; what remains is final polish, final testing, and one last audit before the public launch. If you're an event organizer who wants early access, or a commercial partner interested in the co-founder opportunity, reach out through the contact form at gembaticket.com/contact.

## Credit & further reading

GembaTicket is built by **GEMBA IT**, the technology division of GEMBA Team EOOD in Varna, Bulgaria — the same team behind [GembaPay](https://gembapay.com) (our non-custodial payment platform) and the systems this blog usually takes apart. See the product at [gembaticket.com](https://gembaticket.com), the co-founder pitch at [the deck (PDF)](https://gembaticket.com/gembaticket-cofounder-pitch.pdf), and more of what we run in production at [gembait.com](https://gembait.com).
