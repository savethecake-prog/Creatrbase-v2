# voice-memory-protocol

## Description
Protocol for reading and writing voice memory entries.

## When to use
Every agent invocation that touches editorial content.

## Rules
1. Read voice memory on every invocation (WHERE deprecated_at IS NULL).
2. Only write editorial decisions, not facts. "Anthony believes micro-creators below 1k subs are not commercially viable" is a position. "YouTube has 2 billion users" is not.
3. Topics use kebab-case: "micro-creator-viability", "tiktok-creator-fund", "brand-deal-rates".
4. Position field: complete statement, not a fragment. "Micro-creators below 1k subscribers are not commercially viable for brand deals, but they can build audience for future monetisation."
5. Context field: why this position was formed. "Based on our scoring data showing sub-1k channels have insufficient engagement signals for brand evaluation."
6. Confidence: high (Anthony stated directly), medium (inferred from pattern of answers), low (single offhand comment).
7. Source: 'anthony' (only the editorial composer agent may write this), 'inferred' (digest agents), 'published' (appeared in a sent newsletter).
8. Deprecation: set deprecated_at and superseded_by when a position is replaced. Never delete.
9. Touch last_referenced_at when reading a memory entry for use in drafting.
