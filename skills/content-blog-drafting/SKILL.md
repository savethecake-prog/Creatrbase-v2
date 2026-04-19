## Description
Full blog article drafting for Creatrbase — structure, voice, data integration, and internal linking.

## Purpose
Produce complete, publish-ready blog articles that are factually grounded in Creatrbase data, consistent with editorial voice, and optimised for independent creators as the primary audience.

## Article Structure

### Required sections in order:
1. **Opening paragraph** — Hook with a specific, concrete claim. No "In today's digital landscape..." style openings. Lead with the tension or insight, not a preamble.
2. **H2 sections** — 3 to 5 sections. Each H2 should be a complete thought, not a label. E.g. "Why engagement rate is the wrong number to optimise" not "Engagement Rate".
3. **Closing section** — Practical takeaway or call to action. Never a summary ("In conclusion..."). Leave the reader with something actionable.

### Length
- Standard articles: 1,200 to 1,800 words
- Deep-dive articles: 2,000 to 2,500 words
- Never pad to hit a word count. Cut anything that doesn't add information.

## Voice and Tone

- Direct, specific, and honest about uncertainty
- Write for creators who are intelligent but not marketing experts
- Never patronise. Never explain basics. Assume the reader understands what brand deals are.
- Third-person references to Creatrbase: "Creatrbase data shows..." or "across Creatrbase creators..."
- UK English throughout. No em-dashes or en-dashes — use commas or full stops instead.
- Confidence levels on data claims: "Based on X confirmed deals in Creatrbase..." not just asserting numbers.

## Data Integration Rules

- Always call get_cpm_benchmarks or get_platform_stats when making claims about rates, deal frequency, or creator earnings
- When referencing a specific niche, call get_niche_data
- State data sources inline: "Creatrbase benchmark data shows gaming creators in the UK earn..." not "creators in gaming earn..."
- Never invent statistics. If you don't have data, say so directly: "We don't have enough data to state this confidently for [niche]."

## What Not to Do

- No listicles formatted as "Top 10 things..." — use flowing H2 sections
- No jargon without explanation (CPM is acceptable; ROI should be explained)
- No "unique," "revolutionary," "game-changing"
- No passive voice where active is possible
- No generic advice that applies to any creator tool ("use analytics to grow")
- Never end with "If you found this useful, share it!"

## Body Markdown Format

Use standard Markdown:
- `##` for H2 sections
- `**bold**` for key terms on first use
- Bullet lists only for genuinely list-like content (not as a lazy substitute for prose)
- No horizontal rules
- Code blocks only if quoting data
