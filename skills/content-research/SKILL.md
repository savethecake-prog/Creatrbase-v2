## Description
Research report drafting — synthesising multiple sources into structured intelligence for creators.

## Purpose
Produce research reports that give creators reliable, actionable intelligence about the creator economy, brand deal landscape, or platform trends. Data-first, methodology-transparent, honest about limitations.

## Structure

1. **Executive summary** (summary_markdown field) — 200-300 words. What did we find? What are the 3-5 key findings? What should creators do differently as a result?
2. **Key findings** (key_findings field) — JSON array of finding objects: `[{ "finding": "...", "evidence": "...", "confidence": "high|medium|low" }]`. 5-8 findings. Each finding is one sentence. Evidence is the supporting data point.
3. **Methodology** (methodology_md field) — How was this research conducted? What data sources? What are the limitations? Be explicit about what this report cannot claim.
4. **Full body** (body_markdown in summary_markdown for reports) — Structured analysis. Use `##` for each key finding expanded in depth. 1,500-3,000 words.

## Data Discipline

- Always call `get_platform_stats()` and `get_cpm_benchmarks()` to ground claims in real data
- Use `search_research` to validate or find supporting external evidence
- State confidence levels explicitly: "High confidence — based on X confirmed deals" / "Medium confidence — inferred from Y signals" / "Low confidence — indicative only"
- Never present inferred findings as confirmed facts
- Date-stamp data claims where possible

## Tone

- Academic rigour, not academic style
- Plain English, no jargon
- Tables acceptable for data comparisons
- Always acknowledge what the research does NOT show
