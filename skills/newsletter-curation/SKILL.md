# newsletter-curation

## Description
Select and rank items for newsletter digests from the ingestion pipeline.

## When to use
When building a digest issue. Called before summarisation.

## Purpose
Pick the 8-12 most relevant, novel, and creator-applicable items from the ingestion pipeline.

## Rules
1. Relevance: does this affect independent creators with 1k-100k subscribers?
2. Novelty: is this new information, not a rehash of last week's story?
3. Credibility: is the source reliable? Prefer tier 1-2 sources (see source-credibility-tiering).
4. Creator-angle: can we frame this through a creator lens? If not, skip it.
5. Diversity: mix topics. Don't run five YouTube stories and nothing else.
6. Volume target: 8-12 items per digest. Under 8 feels thin, over 12 feels overwhelming.
7. Ranking: sort by relevance x novelty x creator-angle. Lead with the strongest.
8. Recency: prefer items from the last 7 days. Older items only if they're significant and not yet covered.
9. No duplicates: if two sources cover the same story, pick the higher-tier source.
10. Mark items as used after inclusion (via mark_ingestion_used tool).
