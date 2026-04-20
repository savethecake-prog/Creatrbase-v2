#!/usr/bin/env node
// scripts/migrate.js
// Runs all migrations in order. Safe to re-run — skips already-applied versions.
// Usage: node scripts/migrate.js
// Requires: DATABASE_URL in environment

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const FILES = [
  '001_create_tenants_users.sql',
  '002_create_creators_platforms.sql',
  '003_create_brand_registry.sql',
  '004_create_tasks_recommendations.sql',
  '005_create_experiments.sql',
  '006_create_toolkit.sql',
  '007_create_billing.sql',
  '008_create_admin.sql',
  '009_create_knowledge_layer.sql',
  '010_seed_reference_data.sql',
  '010_seed_brand_registry.sql',
  '011_seed_subscription_plans.sql',
  '012_platform_metrics_snapshots.sql',
  '013_content_analysis.sql',
  '014_task_metric_baseline.sql',
  '015_avg_views_momentum.sql',
  '016_support_tickets.sql',
  '017_gmail_connections.sql',
  '018_creator_tags.sql',
  '019_tiktok.sql',
  '020_instagram.sql',
  '021_create_blog.sql',
  '022_create_distribution_signals.sql',
  '023_create_public_score_cards.sql',
  '024_add_free_plan.sql',
  '025_admin_access_level.sql',
  '026_newsletter_subscribers.sql',
  '027_ingestion.sql',
  '028_voice_memory_agent_run.sql',
  '029_comparison_pages.sql',
  '030_programmatic_seo.sql',
  '031_signal_feedback_loop.sql',
  '032_thread_classifier_stages.sql',
  '033_gmail_watch_history.sql',
  '034_admin_override_plan.sql',
  '035_content_studio.sql',
  '036_gdpr_compliance.sql',
  '037_power_user.sql',
  '038_roadmap.sql',
  '039_creator_acquisition.sql',
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map(r => r.version));

    for (const file of FILES) {
      const version = file.replace('.sql', '');
      if (applied.has(version)) {
        console.log(`  skipped  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
        await client.query('COMMIT');
        console.log(`  applied  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAILED   ${file}`);
        console.error(err.message);
        process.exit(1);
      }
    }
    console.log('\nAll migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run();
