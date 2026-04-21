# The Creatrbase Inference Model

## The Core Problem

The most valuable commercial information in the creator economy is locked away. It lives inside agencies, inside brand procurement teams, inside closed deal rooms. It is not documented publicly, and it is rarely if ever shared. Things like:

- What a brand is actually willing to pay for a 60-second integration
- What engagement rate threshold marks the point a creator becomes worth approaching
- Which niches are entering a buying window right now
- How much leverage a creator has in a negotiation at their specific tier

Creatrbase cannot obtain this information directly. Neither can any other tool. But that does not mean we cannot reason towards it.

---

## The Inference Approach

Rather than pretending to have data we do not have, or refusing to answer because we cannot be certain, Creatrbase uses an algebraic approach:

**If we cannot know X directly, we define every variable that X depends on, measure those variables where we can, and calculate towards X with a stated level of confidence.**

This is the same logic a doctor uses when estimating disease risk, or a bank uses when pricing a loan. The value of the approach is not that it is always right — it is that it is reasoned, honest, and improvable over time.

### A concrete example

We cannot know what Brand X will pay Creator Y for a 60-second integration. But we can define the variables a brand uses to make that decision:

| Variable | What it represents | How we measure it |
|---|---|---|
| Subscriber tier | Approximate reach of the channel | YouTube data |
| Engagement quality | How attentive and responsive the audience is | Views, comments, consistency ratios |
| Niche commercial value | How much brands in this category typically spend | CPM benchmarks, deal history |
| Geography | Whether the audience is in premium markets (UK, US) | YouTube Analytics geo data |
| Content consistency | Whether the creator can be relied on for campaign planning | Upload cadence tracking |
| Brand alignment | How safe and suitable the content environment is | Content analysis |

When we apply these variables to a scoring model and cross-reference against known benchmark data, we can produce a rate estimate — not as a single number presented as fact, but as a range with a stated confidence level.

---

## Confidence as a First-Class Output

Every piece of information Creatrbase surfaces to a user that involves inference — rather than direct measurement — must come with a confidence indicator.

This is not a weakness. It is the product's intellectual honesty, and it is a differentiator.

The three levels:

**High confidence** — we have multiple strong signals and benchmark data to support this figure. We are not certain, but we are well-reasoned.

**Medium confidence** — we have some signals but limited benchmark data, or the signals are mixed. The estimate is directionally useful but should be treated as a starting point.

**Low confidence** — we have few signals or the creator's profile is unusual. Present the logic, not the number. Surface what we do know and flag what we cannot yet calculate.

The rule: **we never present an inferred figure as a fact. We always show our working.**

---

## The Learning Loop

The model does not stay static. Every time the system produces an estimate and that estimate can later be compared to a real outcome, we learn. This learning is entirely passive — the user does nothing to enable it.

### Zero-friction signal collection

**The creator is never asked to record anything manually.**

All signal collection is automatic, passive, and inferred from the interactions that happen naturally inside the product. Asking a user to confirm an outcome is friction. Friction means missing data. Missing data means a worse model for everyone.

Instead, every feature is designed from the start to answer the question: **what signal does this interaction generate, and how do we capture it automatically?**

### Signal sources

| Source | What we capture | How |
|---|---|---|
| Email chains (Gmail integration) | Brand response rates, rate figures discussed, copy patterns that generated replies, thread length as intent signal | Automatic analysis of connected inbox threads |
| Negotiations feature | Rate proposals sent, counter-offers received, final agreed rate, deal duration | Logged as events on every negotiation action |
| Outreach feature | Which brands received outreach, whether they responded, timing of responses | Tracked against outreach log |
| Platform sync (YouTube, Twitch) | Metric changes over time — subscribers, engagement, upload consistency | Triggered on every sync |
| Scoring events | Before/after snapshot whenever a re-score runs | Stored in DimensionScoreHistory |
| Coach conversations | What commercial questions were asked, what the creator acted on | Session logs, outreach/negotiation actions taken after coach interactions |

### Signal quality is calculated, not declared

Not all signals are equal. A rate figure extracted from a completed email negotiation thread is stronger evidence than an unresponded outreach. The quality of each signal is inferred from the data itself using the same algebraic approach applied to everything else.

Signal quality factors:

- **Corroboration** — does the signal agree with other signals, or conflict with them?
- **Recency** — a deal closed last month is more relevant than one closed two years ago
- **Completeness** — a full negotiation thread with an agreed rate is stronger than a single data point
- **Source type** — direct outcome (deal closed) outweighs indirect proxy (brand opened email)
- **Creator similarity** — how closely does this creator's profile match the one the signal came from?

This quality score is what determines how much weight any given signal gets when updating the model.

### What signals update

Each captured signal feeds into one or more of:

- **The creator's own rate estimate** — updated when their own signal comes in
- **The CPM benchmark table** — anonymised, aggregated deal data improves niche-level benchmarks for all creators in that niche and tier
- **The confidence level** — a creator with 3 inferred closed deals has a higher confidence score than one with none
- **Copy and pitch effectiveness** — email patterns that generated brand responses improve future outreach suggestions
- **Dimension weighting over time** — if geography consistently correlates with higher actual rates, the model learns to weight it more

### The compounding effect

Each individual signal is a small update. But across many creators and interactions over time, the aggregate creates something no competitor can replicate: a proprietary dataset of real commercial outcomes and behaviours, built passively from inside the platform.

This is the durable advantage. Early accuracy comes from the algebra. Long-term accuracy comes from the learning loop. The product gets more useful the more it is used — not because of features added, but because the model underneath gets sharper.

---

## Radical Transparency

**The user always knows when the system has learned from their data.**

This is not negotiable. It is not a "nice to have" traded off against build complexity. If something is harder to explain, the solution is better design and better copy — not silence.

The reason is both ethical and strategic: the user should feel at all times that the platform is working actively on their behalf. When the model updates, they should see it. When a new signal improves their estimate, they should be told. When an email they sent influenced a benchmark, they should understand that their data contributed to something useful.

This transparency serves three functions:

1. **Trust** — the user understands what the system knows and how it knows it
2. **Agency** — the user understands why they should keep using the platform (it gets better for them specifically)
3. **Differentiation** — no tool in this space behaves this way; it is a visible, felt advantage

The transparency layer is a UI and copy challenge. It will require investment in how information is communicated — but that investment is required, not optional.

Example of what this looks like in practice:

> "Your rate estimate has been updated. Based on the negotiation thread with [Brand] and 2 similar deals in the UK gaming niche, your estimated integration rate is now £650-£900. Confidence: High."

> "Your outreach to [Brand] was opened 4 times without a reply. We have noted this as a weak signal for that brand's current buying status."

> "Your Commercial Viability Score increased by 4 points this week. The driver was content consistency — you uploaded on schedule for 6 consecutive weeks."

---

## Design Rules for Future Features

Any new feature that surfaces information to the user where that information involves inference must answer four questions before it is built:

**1. What are the variables?**
Define every factor that influences the value being calculated. If you cannot define the variables, you cannot build the feature honestly.

**2. What is our confidence level, and why?**
State what data we have, what we are inferring, and where the gaps are. The confidence level must be derivable from the inputs, not assigned arbitrarily.

**3. What signal does this feature generate, and how is it captured automatically?**
Every user interaction is a potential data point. Zero-friction capture is the standard. If the design requires the user to manually record an outcome, the design is wrong.

**4. How does the user see the system learning from this?**
The transparency layer must be specified before the feature is built. "We will show this somewhere later" is not acceptable. Define where and how the signal update is communicated to the user at design time.

---

## What This Is Not

This model does not give users false certainty. It does not invent data. It does not hide behind vagueness when a reasoned answer is possible. It does not silently improve without telling the user.

The goal is to be the most honest and most useful commercial intelligence tool available to independent creators — not by having data nobody else has, but by reasoning better with the data that is observable, and by being transparent about every step of that reasoning.
