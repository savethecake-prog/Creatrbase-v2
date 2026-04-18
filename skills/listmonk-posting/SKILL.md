# listmonk-posting

## Description
Post completed drafts to Listmonk as campaign drafts.

## When to use
After a digest or editorial is drafted and ready for review.

## Rules
1. Use the post_to_listmonk_draft tool.
2. Status is always 'draft'. Never auto-schedule or auto-send.
3. Payload: name (descriptive), subject, lists (segment IDs), from_email (hello@creatrbase.com), content_type (richtext), body (HTML), altbody (plain text), tags, type (regular).
4. Store the returned campaign ID in the agent run's output_snapshot.
5. Include the alt-body (plain text version) for accessibility and deliverability.
6. Tags should include the digest type and date: ["creator-economy", "2026-04-21"].
