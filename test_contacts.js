'use strict';
require('dotenv').config();

const { getPool }          = require('./src/db/pool');
const { discoverContacts } = require('./src/domains/contacts/contactService');

async function run() {
  const pool = getPool();

  // 1. Find a brand with a website
  const { rows: brands } = await pool.query(
    "SELECT id, brand_name, website FROM brands WHERE website IS NOT NULL AND website <> '' LIMIT 5"
  );
  if (!brands.length) { console.log('No brands with websites found'); return; }
  console.log('\n── Brands with websites ─────────────────────────────');
  brands.forEach(b => console.log(` ${b.id}  ${b.brand_name}  ${b.website}`));

  // 2. Find Anthony's tenant
  const { rows: tenants } = await pool.query(
    "SELECT t.id FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.email = 'savethecake@gmail.com' LIMIT 1"
  );
  if (!tenants.length) { console.log('Could not find tenant'); return; }
  const tenantId = tenants[0].id;
  console.log('\n── Tenant ID ────────────────────────────────────────');
  console.log(' ' + tenantId);

  // 3. Test brand_contact_jobs table exists
  const { rows: tables } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name IN ('brand_contacts','brand_contact_jobs') ORDER BY table_name"
  );
  console.log('\n── Migration 043 tables ─────────────────────────────');
  tables.forEach(t => console.log(' ✓ ' + t.table_name));

  // 4. Run actual discovery on first brand
  const testBrand = brands[0];
  console.log(`\n── Running discoverContacts on "${testBrand.brand_name}" (${testBrand.website}) ─`);
  console.log(' This may take 20-60s (crawl + SMTP verification)...\n');

  try {
    const contacts = await discoverContacts(tenantId, testBrand.id);
    console.log(`── Result: ${contacts.length} contact(s) found ────────────────────`);
    contacts.forEach((c, i) => {
      console.log(`\n  [${i+1}] ${c.full_name || '(no name)'}`);
      console.log(`       Title:    ${c.job_title || '(none)'}`);
      console.log(`       Email:    ${c.email}`);
      console.log(`       Verified: ${c.email_verified}`);
      console.log(`       Source:   ${c.source_url}`);
    });
  } catch (err) {
    console.log(' Discovery error:', err.message);
  }

  await pool.end();
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
