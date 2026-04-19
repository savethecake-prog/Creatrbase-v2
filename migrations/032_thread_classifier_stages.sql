-- ============================================================
-- 032_thread_classifier_stages.sql
-- Extends interaction_type and signal_type constraints to support
-- auto-detected deal stages from Gmail thread classification.
-- ============================================================

-- Drop and replace the interaction_type check constraint
ALTER TABLE brand_creator_interactions
  DROP CONSTRAINT IF EXISTS brand_creator_interactions_interaction_type_check;

ALTER TABLE brand_creator_interactions
  ADD CONSTRAINT brand_creator_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'gifting_received',
    'paid_deal_confirmed',
    'outreach_sent',
    'outreach_responded',
    'outreach_declined',
    'deal_negotiating',
    'deal_contracting',
    'deal_completed',
    'deal_declined',
    'stale',
    'relationship_ongoing'
  ));

-- Drop and replace the signal_type check constraint
ALTER TABLE signal_events
  DROP CONSTRAINT IF EXISTS signal_events_signal_type_check;

ALTER TABLE signal_events
  ADD CONSTRAINT signal_events_signal_type_check
  CHECK (signal_type IN (
    'deal_closed',
    'brand_replied',
    'outreach_sent_with_state',
    'deal_progressed',
    'deal_stale',
    'deal_declined'
  ));
