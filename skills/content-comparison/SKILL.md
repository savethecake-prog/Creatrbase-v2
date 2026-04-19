## Description
Competitor comparison page drafting — honest, balanced, data-grounded analysis.

## Purpose
Produce comparison pages that help creators make genuinely informed decisions. Not attack pieces. Not marketing copy. Honest analysis that acknowledges where competitors are strong and where Creatrbase is different.

## The Honest-Voice Principle for Comparisons

Creatrbase is built on radical transparency. Comparison pages must reflect this:
- Acknowledge what competitors do well before explaining where Creatrbase differs
- Never claim superiority on a dimension where we have no evidence
- Where Creatrbase is weaker or different (not better), say so directly
- The goal is to help the creator choose the right tool, not to convert them at all costs

## Structure

### Page sections in order:
1. **Opening** — What problem does this comparison help the creator solve? Who is this page for? One paragraph.
2. **What [Competitor] does** — Fair, factual description of the competitor's core offering. 2-3 paragraphs. Use get_voice_memory to check for any established positions on this competitor.
3. **How Creatrbase approaches this differently** — Not "Creatrbase is better" but "Creatrbase's focus is on X, which matters if Y is your situation."
4. **Side-by-side comparison table** — Use the comparison_table field. Columns: Feature | [Competitor] | Creatrbase. Values: Yes / No / Partial / Free / Paid / N/A.
5. **Who each tool is best for** — Two clear paragraphs: "Choose [Competitor] if..." and "Choose Creatrbase if..."
6. **Closing** — One practical paragraph. No sales pitch.

## Comparison Table Format

The comparison_table field should be a JSON array:
```json
[
  { "feature": "Commercial viability scoring", "competitor": "No", "creatrbase": "Yes" },
  { "feature": "Brand deal rate benchmarks", "competitor": "Partial", "creatrbase": "Yes" }
]
```

## Tone Rules

- Never use loaded words: "just," "merely," "only" when describing competitors
- Never attribute bad faith to competitors
- Factual inaccuracies about competitors are a serious risk — if unsure, use search_research to verify
- Avoid "unlike [Competitor]..." as an opener — it reads as defensive
- OK to quote publicly available competitor pricing or features, but note the date caveat

## Data to Always Include

- Call get_platform_stats for Creatrbase-specific claims
- If the comparison involves scoring or rates: call get_cpm_benchmarks for specific niche data
- Internal links to related blog content: call list_published_content
