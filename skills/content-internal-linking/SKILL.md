## Description
Internal link suggestions for Creatrbase content — relevance criteria and anchor text rules.

## Purpose
Ensure every piece of content links to relevant existing content, building topical authority and helping creators navigate related intelligence.

## When to Suggest Links

Call `list_published_content` before drafting. Suggest links when:
- The article mentions a concept that is covered in depth on another page
- A niche page exists for a niche mentioned in the article
- A comparison page exists for a competitor mentioned
- A related blog article provides complementary information

Do not force links. If no genuinely relevant content exists, do not link.

## Anchor Text Rules

- Descriptive and specific: "how engagement quality affects brand deals" not "click here" or "this article"
- Naturally integrated into the sentence — not appended as "(see our guide to X)"
- Never duplicate anchor text for different destinations in the same article
- 3-5 internal links per standard article is appropriate; more only if the content is genuinely link-dense

## Link Format

In body_markdown, use standard Markdown links:
`[anchor text](/path/to/page)`

Example:
`Creators who understand [how niche commercial value affects earnings](/niche/gaming) are better positioned to negotiate.`

## Priority Order for Link Inclusion

1. Direct topic match (article about gaming → link to /niche/gaming)
2. Core concept links (mentions brand deal rates → link to /scoring-explained)
3. Related articles on the same sub-topic
4. Comparison pages if competitor names appear
