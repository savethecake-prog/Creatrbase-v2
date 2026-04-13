'use strict';

// ─── Prisma client singleton ──────────────────────────────────────────────────
// One PrismaClient instance for the lifetime of the process.
// Re-using is critical — each new PrismaClient opens a connection pool.
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client');

let _prisma;

function getPrisma() {
  if (!_prisma) {
    _prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
  }
  return _prisma;
}

module.exports = { getPrisma };
