## Description
Niche page generation — data-driven pages explaining commercial value for specific creator niches.

## Purpose
Produce niche pages that tell creators in a specific niche what they can realistically expect commercially: what brands pay, what deals look like, and what dimensions matter most for their niche.

## Required Data Calls

Before drafting, always call:
1. `get_niche_data(niche_slug)` — for niche description, brand categories, signal stats
2. `get_cpm_benchmarks(niche_slug)` — for rate data across platforms and tiers
3. `get_platform_stats()` — for overall platform context

If CPM benchmark data is sparse (fewer than 3 rows), state this honestly: "Benchmark data for this niche is limited — figures below are indicative and based on [X] data points."

## Page Structure

1. **Niche overview** (display_name field) — What type of content is this? Who are the typical creators? One paragraph.
2. **Commercial landscape** — What brands buy in this niche? What deal types are typical (sponsorships, integrations, affiliate)? Based on typical_brand_categories from niche data.
3. **Rate benchmarks** — Present the CPM/rate data in plain English. "Gaming creators on YouTube in the UK with 10k-100k subscribers typically see CPM rates of £X to £Y." Include confidence qualifier if data is thin.
4. **What brands look for in this niche** — Based on niche data and Creatrbase commercial intelligence. Concrete and specific, not generic.
5. **Key commercial dimensions for [niche]** — Which of the 6 CVS dimensions typically matter most for this niche? Informed by niche data and voice memory.

## analysis_markdown Format

Write as flowing prose with `##` sections matching the structure above. This is the main body content displayed on the page. Should be 800-1,200 words.

## Tone

- Data-first but readable
- Third-person references to Creatrbase: "Creatrbase data shows..."
- Honest about data limitations
- No generic creator growth advice
- Written for creators in that specific niche — use their language, reference their context
