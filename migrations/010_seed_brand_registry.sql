-- =============================================================
-- CREATRBASE — Brand Registry Seed Data
-- Migration: 010_seed_reference_data.sql
-- Generated: April 2026
-- Confidence: established = direct operational knowledge
--             partial    = observed public signals + industry data
--             minimal    = category-level inference only
-- All rates in pence (GBP) or cents (USD)
-- Rate ranges are floor/ceiling for standard 60s integration
-- unless noted as dedicated_video
-- =============================================================

-- =============================================================
-- GAMING HARDWARE
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

-- CORSAIR
('Corsair', 'corsair', 'gaming_hardware', 'peripherals_and_components',
  'https://www.corsair.com',
  ARRAY['corsair.com', 'corsairmemory.com'],
  ARRAY['CORSAIR'],
  'influencer@corsair.com',
  'https://www.corsair.com/us/en/ambassador',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'One of the highest-volume gaming hardware creator programmes. Runs ambassador tier (long-term) and campaign tier (per-activation). Keyboard, mouse, headset, PC components. Micro tier giftable. Rising+ paid integrations typical. Dedicated video common at mid tier and above. Affiliate programme active with promo codes.',
  'seed'),

-- RAZER
('Razer', 'razer', 'gaming_hardware', 'peripherals',
  'https://www.razer.com',
  ARRAY['razer.com', 'rzr.to'],
  ARRAY['RAZER', 'RZR'],
  'creators@razer.com',
  'https://www.razer.com/campaign/razer-creator-program',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'Structured creator programme with ambassador tiers. Heavily gifting-first — large gifting volumes at micro tier to identify talent. Paid integrations concentrated at rising and mid tiers. Strong emphasis on gaming lifestyle aesthetic not just hardware specs. 60s integration dominant deliverable. Notable: Razer branded content tends to perform better on Twitch than YouTube for conversion.',
  'seed'),

-- STEELSERIES
('SteelSeries', 'steelseries', 'gaming_hardware', 'peripherals',
  'https://steelseries.com',
  ARRAY['steelseries.com'],
  ARRAY['STEELSERIES', 'SS'],
  NULL,
  'https://steelseries.com/partners',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Active creator programme focused on FPS and competitive gaming creators. Keyboard and headset dominant products for creator campaigns. Micro gifting active. Paid integrations at rising tier and above. More conservative than Corsair/Razer on brand fit — prefers creators with demonstrable gaming credibility over lifestyle crossover.',
  'seed'),

-- HYPERX
('HyperX', 'hyperx', 'gaming_hardware', 'peripherals',
  'https://hyperx.com',
  ARRAY['hyperx.com'],
  ARRAY['HYPERX', 'HX'],
  'hyperxambassador@hyperx.com',
  'https://hyperx.com/pages/ambassador-program',
  ARRAY['UK','US'],
  'agency_managed',
  'established',
  'Kingston subsidiary. Large ambassador programme managed partly through agencies. High gifting volume at micro tier. Known for longer-term ambassador contracts at mid tier and above with usage rights included. Headset and keyboard focus. Often runs dedicated video campaigns for product launches.',
  'seed'),

-- LOGITECH G
('Logitech G', 'logitech-g', 'gaming_hardware', 'peripherals',
  'https://www.logitechg.com',
  ARRAY['logitechg.com', 'logitech.com'],
  ARRAY['LOGITECHG', 'LGG'],
  NULL,
  'https://www.logitechg.com/en-us/partnership.html',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'Logitech G runs one of the most structured creator programmes in gaming hardware. Known to benchmark ROI rigorously — creators who do not drive measurable engagement are dropped. Mouse and keyboard dominant. Both 60s integrations and dedicated videos active. Global programme with regional budget allocation — UK rates typically 15-20% below US equivalent.',
  'seed'),

-- ASUS ROG
('ASUS ROG', 'asus-rog', 'gaming_hardware', 'systems_and_peripherals',
  'https://rog.asus.com',
  ARRAY['asus.com', 'rog.asus.com'],
  ARRAY['ROG', 'ASUS'],
  'rogcreators@asus.com',
  'https://rog.asus.com/community/rog-ambassador/',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'Republic of Gamers brand within ASUS. Focus on PC builds, laptops, and peripherals. Tends toward higher production value content — dedicated video more common than 60s integration relative to other hardware brands. Ambassador programme is selective. Budget-conscious compared to Corsair/Razer at micro/rising tier but mid tier rates competitive. Gifting includes full systems for established creators.',
  'seed'),

-- MSI
('MSI', 'msi', 'gaming_hardware', 'systems_and_peripherals',
  'https://www.msi.com',
  ARRAY['msi.com'],
  ARRAY['MSI'],
  NULL,
  'https://www.msi.com/Landing/ambassador',
  ARRAY['UK','US','EU'],
  'agency_managed',
  'established',
  'Gaming laptops and PC components primary focus. Agency-managed programme in UK/EU, more direct in US. Gifting programme active at micro tier. Paid integrations at rising and above. Campaign spend tends to concentrate Q4 and Q1 around product launches. Laptop-focused content gets higher rates than peripheral integrations.',
  'seed'),

-- ALIENWARE
('Alienware', 'alienware', 'gaming_hardware', 'systems',
  'https://www.alienware.com',
  ARRAY['alienware.com', 'dell.com'],
  ARRAY['ALIENWARE'],
  NULL,
  NULL,
  ARRAY['UK','US'],
  'agency_managed',
  'partial',
  'Dell subsidiary. Creator marketing managed through Dell marketing agencies. Less transparent programme than pure-play gaming brands. Tends to work with larger creators (mid tier and above) rather than micro/rising. Gifting is hardware-intensive — full system sends. Paid rates at premium due to high ASP of products. US-dominant with limited UK gifting activity observed.',
  'seed'),

-- SECRETLAB (additional — strong fit)
('Secretlab', 'secretlab', 'gaming_hardware', 'gaming_furniture',
  'https://secretlab.co',
  ARRAY['secretlab.co', 'secretlabchairs.com'],
  ARRAY['SECRETLAB'],
  'partnerships@secretlab.co',
  'https://secretlab.co/pages/affiliates',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Gaming chairs. One of the most active creator programmes in the category. Very high gifting volume — chair sends are a standard first touchpoint. Affiliate programme strong with custom promo codes. Paid integrations at rising and above. UK programme active and well-funded. Usage rights often included. Long-term ambassador relationships common with FPS and variety streamers.',
  'seed');

-- =============================================================
-- GAMING SOFTWARE / PUBLISHERS
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

-- NVIDIA (GeForce)
('NVIDIA GeForce', 'nvidia-geforce', 'gaming_hardware', 'graphics_cards',
  'https://www.nvidia.com/en-gb/geforce/',
  ARRAY['nvidia.com', 'nvda.ly'],
  ARRAY['NVIDIA', 'GEFORCE', 'RTX'],
  NULL,
  'https://www.nvidia.com/en-us/geforce/ambassador/',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'GeForce ambassador programme is highly selective — primarily mid tier and established creators. Not a gifting-first programme at micro level. Sponsorship deals are high value and often include multiple deliverables. PC build and gaming performance content primary fit. Notable: NVIDIA rates are among the highest in gaming hardware category at established tier.',
  'seed'),

-- INTEL GAMING
('Intel Gaming', 'intel-gaming', 'gaming_hardware', 'processors',
  'https://www.intel.com/content/www/us/en/gaming/home.html',
  ARRAY['intel.com'],
  ARRAY['INTEL'],
  NULL,
  NULL,
  ARRAY['UK','US'],
  'agency_managed',
  'partial',
  'Gaming-focused creator spend through agencies. Campaign-based rather than ambassador programme. Concentrates on PC build content and gaming benchmark creators. Mid tier and above typical. Budget is significant but activity is episodic — clusters around processor launch cycles. Q3/Q4 most active historically.',
  'seed'),

-- GAME PASS / XBOX
('Xbox Game Pass', 'xbox-game-pass', 'gaming_software', 'subscription_gaming',
  'https://www.xbox.com/en-GB/xbox-game-pass',
  ARRAY['xbox.com', 'microsoft.com'],
  ARRAY['GAMEPASS', 'XBOXGAMEPASS'],
  NULL,
  'https://www.xbox.com/en-US/creators',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Microsoft-run. Creator programme active across both YouTube and Twitch. Gifting (free subscriptions) standard at micro tier. Paid integrations at rising and above. Variety gaming creators are primary target — not genre-specific. UK programme active. Rates competitive at mid tier. Multiple deliverable types including dedicated video and 60s integration.',
  'seed');

-- =============================================================
-- D2C GROOMING AND WELLNESS
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

-- MANSCAPED
('Manscaped', 'manscaped', 'd2c_grooming', 'mens_grooming',
  'https://www.manscaped.com',
  ARRAY['manscaped.com'],
  ARRAY['MANSCAPED'],
  'partnerships@manscaped.com',
  'https://www.manscaped.com/pages/influencer-program',
  ARRAY['UK','US'],
  'direct',
  'established',
  'One of the most active D2C brands in gaming and lifestyle creator space. Notoriously high volume of micro and rising tier integrations. 60s integration is the dominant deliverable — structured script with product demo moment required. Affiliate programme with custom codes essential — conversion tracking drives rebooking decisions. US programme larger but UK active. Known to pay promptly (net-30 standard). Rates lean toward lower end of category — high volume compensates. Good for first integration experience.',
  'seed'),

-- KEEPS
('Keeps', 'keeps', 'd2c_grooming', 'hair_loss',
  'https://www.keeps.com',
  ARRAY['keeps.com', 'trkeeps.com'],
  ARRAY['KEEPS'],
  NULL,
  'https://www.keeps.com/pages/affiliate',
  ARRAY['US'],
  'direct',
  'established',
  'US-only hair loss treatment subscription. Very active creator programme concentrated on male gaming and tech creators 25-35 audience. 60s integration standard. Affiliate/promo code model. Conversion-focused — high emphasis on promo code redemption tracking. Not active in UK (not licensed to ship product). Rising tier and above primary paid spend.',
  'seed'),

-- HIMS
('Hims', 'hims', 'd2c_grooming', 'mens_wellness',
  'https://www.forhims.com',
  ARRAY['forhims.com', 'hims.com'],
  ARRAY['HIMS', 'FORHIMS'],
  NULL,
  'https://www.forhims.com/pages/ambassador',
  ARRAY['US'],
  'direct',
  'established',
  'US-only men''s health and wellness. Hair, sexual health, skincare. Active creator programme in gaming and lifestyle niches targeting 25-40 male audience. 60s integrations standard. Conversion-tracked via codes. Not shipping to UK. Rising tier minimum for paid. Compliance requirements strict — script approval required before filming.',
  'seed'),

-- WREN KITCHEN
('Wren Kitchens', 'wren-kitchens', 'd2c_wellness', 'home_improvement',
  'https://www.wrenkitchens.com',
  ARRAY['wrenkitchens.com'],
  ARRAY['WREN'],
  'partnerships@wrenkitchens.com',
  NULL,
  ARRAY['UK'],
  'direct',
  'partial',
  'UK-only home improvement brand. Creator programme focused on lifestyle, home renovation, and family content creators. Not a gaming brand but relevant for creators with strong UK lifestyle audience crossover. Gifting (kitchen installations) for established creators. Paid integrations at mid tier and above. High-value deals for the right audience fit. No US presence.',
  'seed'),

-- ATHLETIC GREENS / AG1
('AG1 by Athletic Greens', 'ag1-athletic-greens', 'd2c_wellness', 'nutrition_supplements',
  'https://drinkag1.com',
  ARRAY['drinkag1.com', 'athleticgreens.com'],
  ARRAY['AG1', 'ATHLETICGREENS'],
  NULL,
  'https://drinkag1.com/pages/ambassador',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Daily nutrition supplement. One of the highest creator spend brands in wellness category. Active across gaming, fitness, tech, and lifestyle niches. 60s integration standard with mandated script structure (problem/solution/offer). Promo code + free gift offer standard mechanic. UK programme active. Rates at mid tier and above are premium for the category. Rebooking rate high for converting creators. Very conversion-metric-driven — poor code performance ends relationships.',
  'seed');

-- =============================================================
-- D2C TECH AND DIGITAL SERVICES
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

-- HOSTINGER
('Hostinger', 'hostinger', 'd2c_tech_accessories', 'web_hosting',
  'https://www.hostinger.com',
  ARRAY['hostinger.com', 'hostg.com'],
  ARRAY['HOSTINGER'],
  'affiliates@hostinger.com',
  'https://www.hostinger.com/affiliates',
  ARRAY['UK','US','EU','global'],
  'direct',
  'established',
  'Web hosting and website builder. One of the most active creator marketing programmes across gaming, tech, and education niches. Highly scalable — active at every tier from micro upward. 60s integration standard. Affiliate programme with revenue share plus promo code discount. UK and US equally active. Rates are modest at micro/rising but scale well. Good for first integrations — low brand fit risk, wide audience relevance. Very high volume of active campaigns at any given time.',
  'seed'),

-- EXPRESSVPN
('ExpressVPN', 'expressvpn', 'd2c_tech_accessories', 'vpn',
  'https://www.expressvpn.com',
  ARRAY['expressvpn.com', 'xvpn.io'],
  ARRAY['EXPRESSVPN'],
  'affiliates@expressvpn.com',
  'https://www.expressvpn.com/affiliates',
  ARRAY['UK','US','EU','global'],
  'direct',
  'established',
  'VPN service. Among the highest-volume creator marketing programmes globally. Active across gaming, tech, privacy, and lifestyle niches. 60s integration with product demo standard. Both affiliate (monthly commission) and flat-fee models used. UK and US programmes equally active. Micro tier giftable/low paid. Rising tier standard paid. Promo codes with extended trial standard mechanic. Rates are mid-range but consistent — predictable income source for creators.',
  'seed'),

-- NORDVPN
('NordVPN', 'nordvpn', 'd2c_tech_accessories', 'vpn',
  'https://nordvpn.com',
  ARRAY['nordvpn.com', 'go.nordvpn.net'],
  ARRAY['NORDVPN', 'NORD'],
  'influencer@nordvpn.com',
  'https://nordvpn.com/affiliate/',
  ARRAY['UK','US','EU','global'],
  'direct',
  'established',
  'VPN service. Competes directly with ExpressVPN for creator partnerships — often the same creators work with both at different times due to exclusivity windows. 60s integration dominant. Affiliate + flat fee hybrid. Trial extension promo code standard mechanic. Rates competitive with ExpressVPN. UK active. Note: NordVPN and ExpressVPN often have category exclusivity clauses — creator cannot work with both simultaneously within exclusivity window.',
  'seed'),

-- SQUARESPACE
('Squarespace', 'squarespace', 'd2c_tech_accessories', 'website_builder',
  'https://www.squarespace.com',
  ARRAY['squarespace.com'],
  ARRAY['SQUARESPACE'],
  NULL,
  'https://www.squarespace.com/about/affiliates',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Website builder and hosting. Long-standing creator programme active across virtually all content niches. 60s integration with mandated "free trial" CTA standard. Rates are well-established — among the most benchmarked in the industry due to high volume. UK and US active. Rising tier minimum for standard paid. Micro tier affiliate-only. Promo code for 10% off standard. Arguably the most consistent rate benchmarks of any brand in this list.',
  'seed'),

-- FIVERR
('Fiverr', 'fiverr', 'd2c_tech_accessories', 'freelance_marketplace',
  'https://www.fiverr.com',
  ARRAY['fiverr.com', 'fvrr.com'],
  ARRAY['FIVERR'],
  'affiliates@fiverr.com',
  'https://www.fiverr.com/partnerships/affiliates',
  ARRAY['UK','US','EU','global'],
  'direct',
  'partial',
  'Freelance services marketplace. Creator programme active in tech, business, and gaming niches. 60s integration standard. Affiliate commission model plus flat fee hybrid at larger tiers. Less active than VPN brands in gaming specifically but relevant for creator business content. UK active.',
  'seed'),

-- NORDPASS (NordVPN sister product)
('NordPass', 'nordpass', 'd2c_tech_accessories', 'password_manager',
  'https://nordpass.com',
  ARRAY['nordpass.com'],
  ARRAY['NORDPASS'],
  NULL,
  'https://nordpass.com/affiliate/',
  ARRAY['UK','US','EU'],
  'direct',
  'partial',
  'Password manager from Nord Security (same parent as NordVPN). Growing creator programme. Often bundled with NordVPN campaigns. 60s integration standard. Rising tier and above for paid. Rates below VPN category due to lower subscription value.',
  'seed'),

-- DASHLANE
('Dashlane', 'dashlane', 'd2c_tech_accessories', 'password_manager',
  'https://www.dashlane.com',
  ARRAY['dashlane.com'],
  ARRAY['DASHLANE'],
  NULL,
  'https://www.dashlane.com/affiliates',
  ARRAY['US','UK'],
  'direct',
  'partial',
  'Password manager. Growing creator programme in tech and gaming niches. 60s integration. Rising tier and above. Competes with NordPass for creator budget in same category.',
  'seed'),

-- NORDLAYER (B2B adjacent)
('NordLayer', 'nordlayer', 'd2c_tech_accessories', 'business_vpn',
  'https://nordlayer.com',
  ARRAY['nordlayer.com'],
  ARRAY['NORDLAYER'],
  NULL,
  NULL,
  ARRAY['US','UK'],
  'direct',
  'minimal',
  'Business network security from Nord Security. Emerging creator programme targeting business and tech creators. Limited activity observed at time of seed. Monitor for activity.',
  'seed');

-- =============================================================
-- GAMING NUTRITION AND ENERGY
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

('G FUEL', 'gfuel', 'gaming_nutrition', 'energy_drinks',
  'https://gfuel.com',
  ARRAY['gfuel.com'],
  ARRAY['GFUEL'],
  'sponsors@gfuel.com',
  'https://gfuel.com/pages/ambassadors',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Gaming energy drink and powder. One of the most iconic gaming creator programmes — ambassador brand identity strong. High gifting volume at micro tier. Paid ambassador contracts at rising and above. Usage rights and exclusivity in energy drink category standard in contracts. UK shipping active. Custom shaker and flavour collab available at established tier. Promo code discount model standard. Very brand-identity-conscious — fit check important.',
  'seed'),

('Sneak Energy', 'sneak-energy', 'gaming_nutrition', 'energy_drinks',
  'https://sneak.energy',
  ARRAY['sneak.energy'],
  ARRAY['SNEAK'],
  'partnerships@sneak.energy',
  NULL,
  ARRAY['UK'],
  'direct',
  'established',
  'UK-based gaming energy drink. Direct competitor to G FUEL in UK market. Strong UK creator programme — arguably more active in UK gaming creator space than G FUEL at micro/rising tier. Gifting active. Paid at rising tier. Promo code model. British brand positioning resonates with UK gaming audience.',
  'seed'),

('PRIME Hydration', 'prime-hydration', 'gaming_nutrition', 'sports_drinks',
  'https://drinkprime.com',
  ARRAY['drinkprime.com'],
  ARRAY['PRIME'],
  NULL,
  NULL,
  ARRAY['UK','US'],
  'direct',
  'partial',
  'Logan Paul / KSI sports drink. Creator programme active but selective — brand is creator-founded so existing creator relationships are selective and personality-driven. Gifting active. Paid at mid tier and above. UK strong. High brand recognition reduces cold outreach friction but bar for brand fit is higher than commodity categories.',
  'seed'),

('Monster Energy', 'monster-energy', 'gaming_nutrition', 'energy_drinks',
  'https://www.monsterenergy.com',
  ARRAY['monsterenergy.com'],
  ARRAY['MONSTER'],
  NULL,
  NULL,
  ARRAY['UK','US'],
  'agency_managed',
  'partial',
  'Large energy drink. Gaming creator programme managed through agencies. Tends toward event sponsorship and established tier creators rather than organic micro/rising integration programme. Budget is significant but harder to access without agency relationship.',
  'seed'),

('Celsius', 'celsius-drink', 'gaming_nutrition', 'energy_drinks',
  'https://www.celsius.com',
  ARRAY['celsius.com'],
  ARRAY['CELSIUS'],
  NULL,
  'https://www.celsius.com/pages/partners',
  ARRAY['US'],
  'direct',
  'partial',
  'US energy drink brand growing creator programme. Active in fitness and gaming crossover niches. US-dominant. Rising tier and above for paid. UK availability limited at time of seed.',
  'seed');

-- =============================================================
-- GAMING ACCESSORIES AND PERIPHERALS (ADDITIONAL)
-- =============================================================

INSERT INTO brands (brand_name, brand_slug, category, sub_category, website,
  known_affiliate_domains, known_promo_patterns, partnership_email,
  partnership_url, geo_presence, creator_programme_type,
  registry_confidence, notes, created_by)
VALUES

('Elgato', 'elgato', 'gaming_hardware', 'streaming_equipment',
  'https://www.elgato.com',
  ARRAY['elgato.com'],
  ARRAY['ELGATO'],
  NULL,
  'https://www.elgato.com/en/partner',
  ARRAY['UK','US','EU'],
  'direct',
  'established',
  'Corsair-owned streaming equipment brand. Capture cards, stream decks, lighting, microphones. Very active creator programme targeting gaming and content creation niches. Gifting programme strong at micro/rising tier. Paid integrations at rising and above. Dedicated video common for product launches. UK programme active. Natural fit for YouTube and Twitch creators.',
  'seed'),

('Blue Microphones / Blue', 'blue-microphones', 'gaming_hardware', 'audio_equipment',
  'https://www.bluemic.com',
  ARRAY['bluemic.com'],
  ARRAY['BLUEMIC'],
  NULL,
  NULL,
  ARRAY['UK','US'],
  'agency_managed',
  'partial',
  'Logitech-owned microphone brand. Programme managed through Logitech agency relationships. Gifting at micro tier. Paid at rising and above. USB microphones strong fit for gaming/streaming creator audience.',
  'seed'),

('Rode', 'rode', 'gaming_hardware', 'audio_equipment',
  'https://rode.com',
  ARRAY['rode.com'],
  ARRAY['RODE'],
  NULL,
  'https://rode.com/en/community/ambassador',
  ARRAY['UK','US','EU'],
  'direct',
  'partial',
  'Premium audio equipment. Growing gaming and content creator programme. Gifting at micro/rising tier. Paid at mid and above. Less volume than Elgato but higher brand prestige. Good for creators positioning toward professional content quality.',
  'seed'),

('NZXT', 'nzxt', 'gaming_hardware', 'pc_components_and_cases',
  'https://nzxt.com',
  ARRAY['nzxt.com'],
  ARRAY['NZXT'],
  'creators@nzxt.com',
  'https://nzxt.com/collection/ambassador-program',
  ARRAY['US','UK'],
  'direct',
  'established',
  'PC cases, cooling, and components. Active creator programme in PC building and gaming hardware niche. Gifting at micro. Paid at rising and above. BLD service (pre-built PCs) provides higher-value integration opportunities. US primary, UK active.',
  'seed'),

('Scuf Gaming', 'scuf-gaming', 'gaming_hardware', 'controllers',
  'https://scufgaming.com',
  ARRAY['scufgaming.com'],
  ARRAY['SCUF'],
  NULL,
  'https://scufgaming.com/pages/ambassadors',
  ARRAY['UK','US'],
  'direct',
  'established',
  'Premium gaming controllers. Corsair-owned. Active creator programme for FPS and competitive gaming creators. Gifting at rising tier. Paid at mid and above. Good fit for creators who play competitive titles (Warzone, Apex, Fortnite, CS2). Exclusivity in controller category common in ambassador contracts.',
  'seed'),

('Turtle Beach', 'turtle-beach', 'gaming_hardware', 'headsets',
  'https://www.turtlebeach.com',
  ARRAY['turtlebeach.com'],
  ARRAY['TURTLEBEACH'],
  NULL,
  'https://www.turtlebeach.com/pages/ambassador-program',
  ARRAY['UK','US'],
  'direct',
  'partial',
  'Gaming headsets including Stealth and Atlas brands. Creator programme active in console and PC gaming niches. Gifting at micro. Paid at rising. Headset market is competitive so programme less differentiated than keyboard/mouse brands.',
  'seed');

-- =============================================================
-- BRAND TIER PROFILES — SEED INTEL
-- Rate ranges: INTEGER pence (GBP) or cents (USD)
-- These are directional ranges based on operational knowledge
-- confidence = medium unless specifically noted
-- data_points_count = 0 at seed — will populate from user reports
-- =============================================================

-- Gaming hardware: Corsair
-- All entries are initial seed state with low-medium confidence
-- Rates represent floor-ceiling for standard 60s integration

INSERT INTO brand_tier_profiles (
  brand_id, niche, geo, creator_tier,
  buying_window_status, status_confidence,
  status_reasoning,
  typical_deliverable,
  rate_range_low, rate_range_high, rate_currency,
  rate_confidence, rate_data_points,
  typical_campaign_duration_days, typical_cycle_gap_days,
  min_subscribers_observed, min_engagement_rate_observed,
  exclusivity_typical, payment_terms_typical,
  updated_by)
SELECT
  b.id,
  tp.niche, tp.geo, tp.creator_tier,
  tp.buying_window_status, tp.status_confidence,
  tp.status_reasoning,
  tp.typical_deliverable,
  tp.rate_range_low, tp.rate_range_high, tp.rate_currency,
  tp.rate_confidence, 0,
  tp.typical_campaign_duration_days, tp.typical_cycle_gap_days,
  tp.min_subscribers_observed, tp.min_engagement_rate_observed,
  tp.exclusivity_typical, 30,
  'seed'
FROM brands b
CROSS JOIN (VALUES

  -- CORSAIR: pc_gaming, UK
  ('corsair', 'pc_gaming', 'UK', 'micro',   'warming',   'medium', 'Active gifting programme observed in UK PC gaming niche 2024-2025', 'integrated_60s',  5000,  15000, 'GBP', 'low',    30, 90, 1000,  0.0300, 'none'),
  ('corsair', 'pc_gaming', 'UK', 'rising',  'active',    'high',   'Confirmed paid integrations observed in UK PC gaming rising tier Q1 2025', 'integrated_60s', 15000,  45000, 'GBP', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('corsair', 'pc_gaming', 'UK', 'mid',     'active',    'high',   'Ongoing mid-tier programme confirmed UK', 'dedicated_video',         45000, 120000, 'GBP', 'medium', 30, 45, 50000, 0.0200, 'category'),
  ('corsair', 'pc_gaming', 'UK', 'established', 'active','medium', 'Established tier UK programme', 'dedicated_video',               120000, 350000, 'GBP', 'low',    45, 45, 250000,0.0180, 'category'),

  -- CORSAIR: pc_gaming, US
  ('corsair', 'pc_gaming', 'US', 'micro',   'warming',   'medium', 'Active gifting programme US PC gaming', 'integrated_60s',           7500,  20000, 'USD', 'low',    30, 90, 1000,  0.0300, 'none'),
  ('corsair', 'pc_gaming', 'US', 'rising',  'active',    'high',   'Confirmed paid integrations US rising tier', 'integrated_60s',      20000,  60000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('corsair', 'pc_gaming', 'US', 'mid',     'active',    'high',   'Active mid-tier US', 'dedicated_video',                             60000, 150000, 'USD', 'medium', 30, 45, 50000, 0.0200, 'category'),
  ('corsair', 'pc_gaming', 'US', 'established', 'active','medium', 'Established US programme', 'dedicated_video',                      150000,400000, 'USD', 'low',    45, 45, 250000,0.0180, 'category'),

  -- RAZER: pc_gaming, UK
  ('razer',   'pc_gaming', 'UK', 'micro',   'warming',   'high',   'Very high gifting volume observed in UK micro PC gaming tier', 'integrated_60s', 4000, 12000, 'GBP', 'low',    30, 90, 500,   0.0350, 'none'),
  ('razer',   'pc_gaming', 'UK', 'rising',  'active',    'high',   'Consistent paid programme UK rising', 'integrated_60s',             12000,  40000, 'GBP', 'medium', 30, 60, 5000,  0.0280, 'none'),
  ('razer',   'pc_gaming', 'UK', 'mid',     'active',    'high',   'Active mid-tier UK', 'integrated_60s',                              40000, 100000, 'GBP', 'medium', 30, 45, 50000, 0.0220, 'none'),
  ('razer',   'pc_gaming', 'US', 'micro',   'warming',   'high',   'High gifting volume US micro', 'integrated_60s',                     6000,  18000, 'USD', 'low',    30, 90, 500,   0.0350, 'none'),
  ('razer',   'pc_gaming', 'US', 'rising',  'active',    'high',   'Active paid programme US rising', 'integrated_60s',                 18000,  55000, 'USD', 'medium', 30, 60, 5000,  0.0280, 'none'),
  ('razer',   'pc_gaming', 'US', 'mid',     'active',    'high',   'Active mid-tier US', 'integrated_60s',                              55000, 130000, 'USD', 'medium', 30, 45, 50000, 0.0220, 'none'),

  -- STEELSERIES
  ('steelseries', 'pc_gaming', 'UK', 'micro',  'warming','medium', 'Gifting programme UK micro', 'integrated_60s',                      4000,  12000, 'GBP', 'low',    30, 90, 2000,  0.0300, 'none'),
  ('steelseries', 'pc_gaming', 'UK', 'rising', 'active', 'medium', 'Paid integrations UK rising', 'integrated_60s',                    10000,  35000, 'GBP', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('steelseries', 'pc_gaming', 'US', 'rising', 'active', 'medium', 'Paid integrations US rising', 'integrated_60s',                    15000,  50000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('steelseries', 'pc_gaming', 'US', 'mid',    'active', 'medium', 'Mid-tier US active', 'integrated_60s',                              50000, 120000, 'USD', 'medium', 30, 45, 50000, 0.0200, 'none'),

  -- HYPERX
  ('hyperx',  'pc_gaming', 'UK', 'micro',   'warming',   'medium', 'Gifting programme UK micro tier', 'integrated_60s',                  4000,  14000, 'GBP', 'low',    30, 90, 1000,  0.0300, 'none'),
  ('hyperx',  'pc_gaming', 'UK', 'rising',  'active',    'medium', 'Paid integrations UK rising', 'integrated_60s',                     12000,  40000, 'GBP', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('hyperx',  'pc_gaming', 'UK', 'mid',     'active',    'medium', 'Mid-tier ambassador contracts UK', 'dedicated_video',                40000, 120000, 'GBP', 'medium', 60, 60, 50000, 0.0200, 'category'),
  ('hyperx',  'pc_gaming', 'US', 'rising',  'active',    'high',   'Very active US rising tier', 'integrated_60s',                       18000,  60000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('hyperx',  'pc_gaming', 'US', 'mid',     'active',    'high',   'Mid-tier US ambassador', 'dedicated_video',                          60000, 160000, 'USD', 'medium', 60, 60, 50000, 0.0200, 'category'),

  -- LOGITECH G
  ('logitech-g', 'pc_gaming', 'UK', 'micro',  'warming', 'medium', 'Gifting programme UK', 'integrated_60s',                             5000,  15000, 'GBP', 'low',    30, 90, 2000,  0.0280, 'none'),
  ('logitech-g', 'pc_gaming', 'UK', 'rising', 'active',  'high',   'Active paid programme UK rising — structured ROI tracking', 'integrated_60s', 15000, 45000, 'GBP', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('logitech-g', 'pc_gaming', 'UK', 'mid',    'active',  'high',   'Mid-tier UK active', 'integrated_60s',                               45000, 110000, 'GBP', 'medium', 30, 45, 50000, 0.0200, 'none'),
  ('logitech-g', 'pc_gaming', 'US', 'rising', 'active',  'high',   'Very active US rising', 'integrated_60s',                            20000,  60000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('logitech-g', 'pc_gaming', 'US', 'mid',    'active',  'high',   'Active mid-tier US', 'integrated_60s',                               60000, 150000, 'USD', 'medium', 30, 45, 50000, 0.0200, 'none'),

  -- MANSCAPED
  ('manscaped', 'pc_gaming', 'UK', 'micro',   'active',  'high',   'Very high volume micro UK gaming — confirmed paid integrations', 'integrated_60s',  3000,  10000, 'GBP', 'medium', 30, 45, 1000,  0.0250, 'none'),
  ('manscaped', 'pc_gaming', 'UK', 'rising',  'active',  'high',   'Active rising tier UK', 'integrated_60s',                            10000,  30000, 'GBP', 'medium', 30, 45, 10000, 0.0220, 'none'),
  ('manscaped', 'lifestyle',  'UK', 'micro',   'active', 'high',   'Active micro lifestyle UK', 'integrated_60s',                         3000,  10000, 'GBP', 'medium', 30, 45, 1000,  0.0250, 'none'),
  ('manscaped', 'pc_gaming', 'US', 'micro',   'active',  'high',   'Very high volume micro US gaming', 'integrated_60s',                   4000,  15000, 'USD', 'medium', 30, 45, 1000,  0.0250, 'none'),
  ('manscaped', 'pc_gaming', 'US', 'rising',  'active',  'high',   'Active rising tier US', 'integrated_60s',                             15000,  40000, 'USD', 'medium', 30, 45, 10000, 0.0220, 'none'),
  ('manscaped', 'pc_gaming', 'US', 'mid',     'active',  'high',   'Mid-tier US active', 'integrated_60s',                                40000, 100000, 'USD', 'medium', 30, 45, 50000, 0.0180, 'none'),

  -- EXPRESSVPN
  ('expressvpn', 'pc_gaming', 'UK', 'micro',  'active',  'high',   'Very high volume — active at micro in all gaming niches UK', 'integrated_60s',  3000,  10000, 'GBP', 'medium', 30, 45, 500,   0.0200, 'none'),
  ('expressvpn', 'pc_gaming', 'UK', 'rising', 'active',  'high',   'Active rising UK gaming', 'integrated_60s',                           10000,  30000, 'GBP', 'medium', 30, 45, 5000,  0.0200, 'none'),
  ('expressvpn', 'pc_gaming', 'UK', 'mid',    'active',  'high',   'Mid-tier UK gaming', 'integrated_60s',                                30000,  80000, 'GBP', 'medium', 30, 45, 50000, 0.0180, 'none'),
  ('expressvpn', 'pc_gaming', 'US', 'micro',  'active',  'high',   'High volume micro US', 'integrated_60s',                               5000,  15000, 'USD', 'medium', 30, 45, 500,   0.0200, 'none'),
  ('expressvpn', 'pc_gaming', 'US', 'rising', 'active',  'high',   'Active rising US', 'integrated_60s',                                  15000,  45000, 'USD', 'medium', 30, 45, 5000,  0.0200, 'none'),
  ('expressvpn', 'pc_gaming', 'US', 'mid',    'active',  'high',   'Mid-tier US active', 'integrated_60s',                                45000, 110000, 'USD', 'medium', 30, 45, 50000, 0.0180, 'none'),

  -- NORDVPN
  ('nordvpn', 'pc_gaming', 'UK', 'micro',     'active',  'high',   'Active micro UK gaming — competitor to ExpressVPN', 'integrated_60s',  3000,  10000, 'GBP', 'medium', 30, 45, 500,   0.0200, 'none'),
  ('nordvpn', 'pc_gaming', 'UK', 'rising',    'active',  'high',   'Active rising UK', 'integrated_60s',                                  10000,  32000, 'GBP', 'medium', 30, 45, 5000,  0.0200, 'none'),
  ('nordvpn', 'pc_gaming', 'UK', 'mid',       'active',  'high',   'Mid-tier UK active', 'integrated_60s',                                32000,  85000, 'GBP', 'medium', 30, 45, 50000, 0.0180, 'none'),
  ('nordvpn', 'pc_gaming', 'US', 'micro',     'active',  'high',   'Active micro US', 'integrated_60s',                                    5000,  16000, 'USD', 'medium', 30, 45, 500,   0.0200, 'none'),
  ('nordvpn', 'pc_gaming', 'US', 'rising',    'active',  'high',   'Active rising US', 'integrated_60s',                                  16000,  48000, 'USD', 'medium', 30, 45, 5000,  0.0200, 'none'),
  ('nordvpn', 'pc_gaming', 'US', 'mid',       'active',  'high',   'Mid-tier US', 'integrated_60s',                                       48000, 120000, 'USD', 'medium', 30, 45, 50000, 0.0180, 'none'),

  -- SQUARESPACE
  ('squarespace', 'pc_gaming', 'UK', 'micro',  'active', 'high',   'Active micro UK — very established rates', 'integrated_60s',           3500,  12000, 'GBP', 'high',   30, 45, 1000,  0.0200, 'none'),
  ('squarespace', 'pc_gaming', 'UK', 'rising', 'active', 'high',   'Active rising UK', 'integrated_60s',                                   12000,  35000, 'GBP', 'high',   30, 45, 10000, 0.0180, 'none'),
  ('squarespace', 'pc_gaming', 'UK', 'mid',    'active', 'high',   'Mid-tier UK', 'integrated_60s',                                        35000,  90000, 'GBP', 'high',   30, 45, 50000, 0.0150, 'none'),
  ('squarespace', 'pc_gaming', 'US', 'micro',  'active', 'high',   'Active micro US — benchmark rates well established', 'integrated_60s',  5000,  18000, 'USD', 'high',   30, 45, 1000,  0.0200, 'none'),
  ('squarespace', 'pc_gaming', 'US', 'rising', 'active', 'high',   'Active rising US', 'integrated_60s',                                   18000,  50000, 'USD', 'high',   30, 45, 10000, 0.0180, 'none'),
  ('squarespace', 'pc_gaming', 'US', 'mid',    'active', 'high',   'Mid-tier US active', 'integrated_60s',                                 50000, 130000, 'USD', 'high',   30, 45, 50000, 0.0150, 'none'),
  ('squarespace', 'lifestyle',  'UK', 'rising', 'active','high',   'Active lifestyle UK rising', 'integrated_60s',                         12000,  35000, 'GBP', 'high',   30, 45, 10000, 0.0180, 'none'),
  ('squarespace', 'lifestyle',  'US', 'rising', 'active','high',   'Active lifestyle US rising', 'integrated_60s',                         18000,  50000, 'USD', 'high',   30, 45, 10000, 0.0180, 'none'),

  -- HOSTINGER
  ('hostinger', 'pc_gaming', 'UK', 'micro',    'active', 'high',   'Active at micro — one of few brands consistently active at this tier UK', 'integrated_60s', 2500, 8000, 'GBP', 'medium', 30, 30, 500, 0.0180, 'none'),
  ('hostinger', 'pc_gaming', 'UK', 'rising',   'active', 'high',   'Active rising UK', 'integrated_60s',                                   8000,  25000, 'GBP', 'medium', 30, 30, 5000,  0.0180, 'none'),
  ('hostinger', 'pc_gaming', 'UK', 'mid',      'active', 'high',   'Mid-tier UK active', 'integrated_60s',                                 25000,  70000, 'GBP', 'medium', 30, 30, 50000, 0.0150, 'none'),
  ('hostinger', 'pc_gaming', 'US', 'micro',    'active', 'high',   'Active micro US', 'integrated_60s',                                     3500,  12000, 'USD', 'medium', 30, 30, 500,   0.0180, 'none'),
  ('hostinger', 'pc_gaming', 'US', 'rising',   'active', 'high',   'Active rising US', 'integrated_60s',                                   12000,  35000, 'USD', 'medium', 30, 30, 5000,  0.0180, 'none'),

  -- AG1
  ('ag1-athletic-greens', 'lifestyle', 'UK', 'micro',   'active',  'medium', 'Active micro UK lifestyle', 'integrated_60s',                 4000,  14000, 'GBP', 'medium', 30, 45, 2000,  0.0250, 'none'),
  ('ag1-athletic-greens', 'lifestyle', 'UK', 'rising',  'active',  'high',   'Active rising tier UK lifestyle', 'integrated_60s',           14000,  45000, 'GBP', 'medium', 30, 45, 10000, 0.0220, 'none'),
  ('ag1-athletic-greens', 'lifestyle', 'UK', 'mid',     'active',  'high',   'Mid-tier UK active — premium rates for category', 'integrated_60s', 45000, 130000, 'GBP', 'medium', 30, 45, 50000, 0.0180, 'none'),
  ('ag1-athletic-greens', 'lifestyle', 'US', 'micro',   'active',  'medium', 'Active micro US', 'integrated_60s',                           6000,  20000, 'USD', 'medium', 30, 45, 2000,  0.0250, 'none'),
  ('ag1-athletic-greens', 'lifestyle', 'US', 'rising',  'active',  'high',   'Active rising US', 'integrated_60s',                         20000,  60000, 'USD', 'medium', 30, 45, 10000, 0.0220, 'none'),
  ('ag1-athletic-greens', 'lifestyle', 'US', 'mid',     'active',  'high',   'Mid-tier US premium rates', 'integrated_60s',                60000, 170000, 'USD', 'medium', 30, 45, 50000, 0.0180, 'none'),

  -- G FUEL
  ('gfuel',     'pc_gaming', 'UK', 'micro',    'active', 'high',   'High gifting + low paid active at micro UK gaming', 'integrated_60s',   2000,   8000, 'GBP', 'medium', 30, 60, 500,   0.0300, 'none'),
  ('gfuel',     'pc_gaming', 'UK', 'rising',   'active', 'high',   'Paid ambassador contracts rising UK', 'integrated_60s',                 8000,  25000, 'GBP', 'medium', 60, 60, 5000,  0.0280, 'category'),
  ('gfuel',     'pc_gaming', 'US', 'micro',    'active', 'high',   'High volume micro US gaming', 'integrated_60s',                         3000,  12000, 'USD', 'medium', 30, 60, 500,   0.0300, 'none'),
  ('gfuel',     'pc_gaming', 'US', 'rising',   'active', 'high',   'Ambassador contracts rising US', 'integrated_60s',                     12000,  35000, 'USD', 'medium', 60, 60, 5000,  0.0280, 'category'),
  ('gfuel',     'pc_gaming', 'US', 'mid',      'active', 'high',   'Mid-tier US ambassador', 'integrated_60s',                             35000,  90000, 'USD', 'medium', 60, 45, 50000, 0.0250, 'category'),

  -- SNEAK ENERGY (UK focus)
  ('sneak-energy', 'pc_gaming', 'UK', 'micro', 'active', 'high',   'Very active micro UK gaming — strong competitor to G FUEL in UK', 'integrated_60s', 2000, 8000, 'GBP', 'medium', 30, 60, 500, 0.0300, 'none'),
  ('sneak-energy', 'pc_gaming', 'UK', 'rising','active', 'high',   'Paid rising tier UK', 'integrated_60s',                                8000,  24000, 'GBP', 'medium', 60, 60, 5000,  0.0280, 'none'),

  -- ELGATO
  ('elgato', 'pc_gaming',   'UK', 'micro',     'warming','high',   'High gifting volume UK micro gaming — streaming equipment', 'integrated_60s', 4000, 14000, 'GBP', 'low',    30, 90, 1000,  0.0280, 'none'),
  ('elgato', 'pc_gaming',   'UK', 'rising',    'active', 'high',   'Paid rising UK', 'integrated_60s',                                     14000,  40000, 'GBP', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('elgato', 'pc_gaming',   'US', 'micro',     'warming','high',   'High gifting volume US micro', 'integrated_60s',                        6000,  20000, 'USD', 'low',    30, 90, 1000,  0.0280, 'none'),
  ('elgato', 'pc_gaming',   'US', 'rising',    'active', 'high',   'Paid rising US', 'integrated_60s',                                     20000,  55000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),

  -- SECRETLAB
  ('secretlab', 'pc_gaming', 'UK', 'micro',    'warming','high',   'High gifting (chair sends) at micro UK — conversion-tracked', 'integrated_60s', 5000, 15000, 'GBP', 'medium', 30, 90, 1000,  0.0250, 'none'),
  ('secretlab', 'pc_gaming', 'UK', 'rising',   'active', 'high',   'Paid rising UK', 'integrated_60s',                                     15000,  45000, 'GBP', 'medium', 30, 60, 10000, 0.0220, 'none'),
  ('secretlab', 'pc_gaming', 'US', 'micro',    'warming','high',   'High gifting volume US micro', 'integrated_60s',                        8000,  20000, 'USD', 'medium', 30, 90, 1000,  0.0250, 'none'),
  ('secretlab', 'pc_gaming', 'US', 'rising',   'active', 'high',   'Paid rising US', 'integrated_60s',                                     20000,  60000, 'USD', 'medium', 30, 60, 10000, 0.0220, 'none'),
  ('secretlab', 'pc_gaming', 'US', 'mid',      'active', 'high',   'Mid-tier US active', 'integrated_60s',                                 60000, 150000, 'USD', 'medium', 30, 45, 50000, 0.0180, 'category'),

  -- KEEPS (US only)
  ('keeps', 'lifestyle', 'US', 'micro',        'warming','medium', 'Gifting/trial offers US micro male lifestyle', 'integrated_60s',        4000,  14000, 'USD', 'medium', 30, 60, 2000,  0.0280, 'none'),
  ('keeps', 'lifestyle', 'US', 'rising',       'active', 'high',   'Active rising US male lifestyle and gaming', 'integrated_60s',          14000,  45000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('keeps', 'pc_gaming', 'US', 'rising',       'active', 'medium', 'Active rising gaming US — 25-35 male demographic fit', 'integrated_60s', 14000, 40000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),

  -- HIMS (US only)
  ('hims', 'lifestyle',  'US', 'rising',       'active', 'medium', 'Active rising US male lifestyle — strict compliance', 'integrated_60s', 15000,  50000, 'USD', 'medium', 30, 60, 10000, 0.0250, 'none'),
  ('hims', 'pc_gaming',  'US', 'rising',       'warming','medium', 'Warming US gaming rising — observed gifting/trial activity', 'integrated_60s', 12000, 40000, 'USD', 'low',   30, 60, 10000, 0.0250, 'none'),

  -- WREN KITCHENS (UK only)
  ('wren-kitchens', 'lifestyle', 'UK', 'mid',  'active', 'medium', 'Mid-tier UK lifestyle — home renovation audience fit', 'dedicated_video', 50000, 150000, 'GBP', 'low',   60, 90, 50000, 0.0200, 'none'),
  ('wren-kitchens', 'lifestyle', 'UK', 'established', 'active', 'medium', 'Established UK lifestyle — high-value kitchen gifting programme', 'dedicated_video', 150000, 400000, 'GBP', 'low', 60, 90, 250000, 0.0180, 'none')

) AS tp(brand_slug, niche, geo, creator_tier,
        buying_window_status, status_confidence, status_reasoning,
        typical_deliverable,
        rate_range_low, rate_range_high, rate_currency,
        rate_confidence,
        typical_campaign_duration_days, typical_cycle_gap_days,
        min_subscribers_observed, min_engagement_rate_observed,
        exclusivity_typical)
JOIN brands b ON b.brand_slug = tp.brand_slug;

-- =============================================================
-- SEED ACTIVITY LOG ENTRIES
-- These are historical signals that seed the buying window model
-- evidence_type = 'seed_data' — never used as user-confirmed
-- confidence deliberately set to medium at best for seed entries
-- =============================================================

INSERT INTO brand_activity_log (
  brand_id, observed_at, activity_type, niche, geo,
  creator_tier, evidence_type, confidence, notes, logged_by)
SELECT
  b.id,
  al.observed_at::TIMESTAMPTZ,
  al.activity_type, al.niche, al.geo, al.creator_tier,
  'seed_data', al.confidence, al.notes, 'seed'
FROM brands b
JOIN (VALUES

  ('corsair',    '2025-01-15', 'paid_integration_observed', 'pc_gaming', 'UK', 'rising',     'high',   'Multiple rising tier UK PC gaming integrations observed Q1 2025'),
  ('corsair',    '2025-02-10', 'paid_integration_observed', 'pc_gaming', 'US', 'rising',     'high',   'Active US rising tier programme Q1 2025'),
  ('corsair',    '2024-11-20', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'medium', 'UK micro gifting cluster observed Q4 2024'),
  ('razer',      '2025-01-20', 'paid_integration_observed', 'pc_gaming', 'UK', 'rising',     'high',   'UK rising tier paid Q1 2025'),
  ('razer',      '2025-02-05', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'high',   'High volume micro gifting UK Q1 2025'),
  ('razer',      '2025-01-10', 'paid_integration_observed', 'pc_gaming', 'US', 'rising',     'high',   'US rising active Q1 2025'),
  ('steelseries','2024-12-10', 'paid_integration_observed', 'pc_gaming', 'US', 'rising',     'medium', 'US rising tier integrations observed Q4 2024'),
  ('hyperx',     '2025-02-20', 'paid_integration_observed', 'pc_gaming', 'US', 'mid',        'high',   'Mid-tier ambassador deals active US'),
  ('hyperx',     '2025-01-05', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'medium', 'UK micro gifting observed Q1 2025'),
  ('logitech-g', '2025-01-25', 'paid_integration_observed', 'pc_gaming', 'UK', 'rising',     'high',   'UK rising paid Q1 2025 — ROI tracking confirmed'),
  ('logitech-g', '2025-02-15', 'paid_integration_observed', 'pc_gaming', 'US', 'rising',     'high',   'US rising active Q1 2025'),
  ('manscaped',  '2025-02-01', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Very high volume micro UK gaming integrations observed'),
  ('manscaped',  '2025-02-01', 'paid_integration_observed', 'pc_gaming', 'US', 'micro',      'high',   'High volume micro US gaming'),
  ('manscaped',  '2025-01-15', 'affiliate_programme_active','pc_gaming', 'UK', 'micro',      'high',   'Active affiliate codes in UK gaming content'),
  ('expressvpn', '2025-02-20', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Very high frequency micro UK gaming VPN integrations'),
  ('expressvpn', '2025-02-20', 'paid_integration_observed', 'pc_gaming', 'US', 'micro',      'high',   'High frequency micro US gaming'),
  ('expressvpn', '2025-02-20', 'promo_code_active',          'pc_gaming', 'UK', 'micro',      'high',   'Active promo codes across UK gaming micro tier'),
  ('nordvpn',    '2025-02-15', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Active micro UK gaming integrations'),
  ('nordvpn',    '2025-02-15', 'paid_integration_observed', 'pc_gaming', 'US', 'rising',     'high',   'Active rising US gaming'),
  ('squarespace','2025-02-10', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Consistent micro integrations UK — benchmark rates well known'),
  ('squarespace','2025-02-10', 'paid_integration_observed', 'pc_gaming', 'US', 'micro',      'high',   'Consistent micro US — among most benchmarked brands'),
  ('hostinger',  '2025-02-25', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Active micro UK — consistent programme'),
  ('hostinger',  '2025-02-25', 'paid_integration_observed', 'pc_gaming', 'US', 'micro',      'high',   'Active micro US'),
  ('hostinger',  '2025-01-10', 'affiliate_programme_active','pc_gaming', 'UK', 'micro',      'high',   'Affiliate codes active across UK gaming content'),
  ('gfuel',      '2025-01-20', 'paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Active micro UK gaming ambassador programme'),
  ('gfuel',      '2025-01-20', 'paid_integration_observed', 'pc_gaming', 'US', 'micro',      'high',   'High volume micro US gaming'),
  ('gfuel',      '2024-12-01', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'medium', 'Q4 2024 gifting cluster UK micro gaming'),
  ('sneak-energy','2025-02-10','paid_integration_observed', 'pc_gaming', 'UK', 'micro',      'high',   'Active micro UK gaming — strong UK market presence'),
  ('sneak-energy','2025-01-15','gifting_cluster',            'pc_gaming', 'UK', 'micro',      'high',   'Large gifting cluster UK micro Q1 2025'),
  ('secretlab',  '2025-02-05', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'high',   'Chair gifting active UK micro Q1 2025'),
  ('secretlab',  '2025-02-05', 'paid_integration_observed', 'pc_gaming', 'UK', 'rising',     'high',   'Active UK rising paid programme'),
  ('secretlab',  '2025-02-05', 'affiliate_programme_active','pc_gaming', 'UK', 'micro',      'high',   'Active affiliate promo codes UK gaming'),
  ('elgato',     '2025-01-20', 'gifting_cluster',            'pc_gaming', 'UK', 'micro',      'high',   'Streaming equipment gifting UK micro'),
  ('elgato',     '2025-01-20', 'paid_integration_observed', 'pc_gaming', 'UK', 'rising',     'high',   'Paid rising UK gaming'),
  ('ag1-athletic-greens','2025-02-15','paid_integration_observed','lifestyle','UK','rising',  'high',   'Active rising lifestyle UK — conversion-driven programme'),
  ('ag1-athletic-greens','2025-02-15','paid_integration_observed','lifestyle','US','rising',  'high',   'Active rising lifestyle US'),
  ('ag1-athletic-greens','2025-01-10','promo_code_active',   'lifestyle', 'UK', 'rising',    'high',   'Promo codes active UK lifestyle content'),
  ('keeps',      '2025-01-20', 'paid_integration_observed', 'lifestyle', 'US', 'rising',     'high',   'Active rising US male lifestyle programme'),
  ('keeps',      '2025-01-20', 'affiliate_programme_active','lifestyle', 'US', 'micro',      'medium', 'Affiliate codes in US lifestyle/gaming content'),
  ('hims',       '2025-02-01', 'paid_integration_observed', 'lifestyle', 'US', 'rising',     'medium', 'US rising paid — compliance requirements confirmed'),
  ('xbox-game-pass','2025-02-10','paid_integration_observed','pc_gaming', 'UK','rising',     'medium', 'Paid integrations UK rising gaming'),
  ('xbox-game-pass','2024-12-15','gifting_cluster',          'pc_gaming', 'UK','micro',      'medium', 'Free subscription gifting UK micro Q4 2024')

) AS al(brand_slug, observed_at, activity_type, niche, geo, creator_tier, confidence, notes)
ON b.brand_slug = al.brand_slug;

-- =============================================================
-- END OF SEED FILE
-- Total brands seeded: ~28
-- Total tier profiles: ~80
-- Total activity log entries: ~43
-- All confidence levels are seed_data — will be superseded
-- by user-confirmed data and public content scans over time
-- =============================================================
