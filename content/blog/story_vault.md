# story_vault.md — first-hand stories from Slavcho (GEMBA IT)

This file is the **ONLY** source of genuine first-hand experience the auto-blogger
is allowed to weave into articles. Everything else must stay in third-person
("developers typically…").

## How Claude uses this file

On every weekly run, the auto-blogger:

1. Reads this file
2. If the candidate topic it picked for today **matches** a story here, it
   integrates the story into the Debugging Dance section with the opening
   sentence: *"Slavcho, founder of GEMBA IT, hit a similar issue while
   building [product]: …"*
3. When a story is used, the byline becomes `"Slavcho Ivanov and the GEMBA IT team"`
   and `first_hand_story_used: true` in posts.json
4. If no story matches, the post is published under `"GEMBA IT team"` and stays
   third-person

## How to add a story

Append a new section at the bottom using the template below. Each story is:

- **Specific**: date (approx OK), product, what you were trying to do
- **Honest**: the wrong turns, not a polished victory lap
- **Short**: 150–300 words. The blogger will expand/adapt for the article.

```markdown
### <short slug> — <one-line summary>

Tags: <tag1, tag2> (to help Claude match against article topics)
Product: <GembaPay | GembaTools | GembaTicket | EduChain | infra>
Approx date: <YYYY-MM or season/year>

The story (150–300 words, first person, no polish):
<your text>
```

---

## Stories

<!-- Add entries below. Example placeholder follows — replace it with real stories. -->

### example-placeholder-delete-me — the placeholder story

Tags: placeholder
Product: n/a
Approx date: 2026-04

This is a placeholder. Delete this section and add your own stories.
Until a real story is added, Claude will not integrate any first-hand
anecdote — all posts will publish under "GEMBA IT team".

### permitiv-kickoff — the industrial software plan finally left the drawer

Tags: permitiv, permit-to-work, industrial-safety, confined-space, federation, company-news
Product: Permitiv (permitiv.com)
Approx date: 2026-07

The story (first person, from Slavcho, recorded 2026-07-05):
For years I kept a private folder of plans for one big piece of software —
a platform for permit-to-work, confined-space control, and compliance in
high-risk industrial work. I kept reopening it and closing it because the
scope scared me and the timing was never right. Gemba Industrial's crews
kept feeding it: every turnaround they worked, they came back describing
paper permits at shift-start windows, hand-collected signatures, gas
readings copied off meter screens, audit evidence in binders. In early July
2026 we officially started building it as Permitiv. Foundation first
(multi-tenant isolation, cryptographically chained append-only audit log,
security audits before features), wedge modules next (permits, confined
space, bidding). Two decisions I won't compromise: the AI copilot never
makes a safety call (deterministic rules + human signature, always), and
the platform is federated so plants keep their operational data on their
own instance. Landing: permitiv.com; investor/partner brief:
permitiv.com/investors. We are at day one and saying so publicly.
