'use strict';

// ─── Creator tag routes ───────────────────────────────────────────────────────
//
//   GET    /api/creator/tags          → list tracked tags with effectiveness
//   POST   /api/creator/tags          → add a tag (free-form or brand registry)
//   DELETE /api/creator/tags/:id      → remove a tracked tag
//   GET    /api/brands/search?q=      → search brand registry for tag suggestions
// ─────────────────────────────────────────────────────────────────────────────

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');
const { getPool }      = require('../../db/pool');

async function resolveCreator(userId, tenantId) {
  const prisma = getPrisma();
  return prisma.creator.findFirst({
    where:  { userId, tenantId },
    select: { id: true, tenantId: true },
  });
}

async function tagRoutes(app) {

  // ── GET /api/creator/tags ────────────────────────────────────────────────

  app.get('/api/creator/tags', { preHandler: authenticate }, async (req, reply) => {
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT
         ct.id,
         ct.tag,
         ct.brand_id,
         b.brand_name,
         ct.detection_count,
         ct.last_detected_at,
         ct.effectiveness_score,
         ct.confidence,
         ct.created_at
       FROM creator_tags ct
       LEFT JOIN brands b ON b.id = ct.brand_id
       WHERE ct.creator_id = $1
       ORDER BY ct.detection_count DESC, ct.created_at DESC`,
      [creator.id]
    );

    return { tags: rows };
  });

  // ── POST /api/creator/tags ───────────────────────────────────────────────

  app.post('/api/creator/tags', { preHandler: authenticate }, async (req, reply) => {
    const { tag, brandId } = req.body ?? {};

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      return reply.code(400).send({ error: 'tag is required' });
    }

    const normalised = tag.trim().toLowerCase();
    if (normalised.length > 100) {
      return reply.code(400).send({ error: 'Tag must be 100 characters or fewer' });
    }

    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const pool = getPool();

    // Validate brandId if provided
    if (brandId) {
      const { rows } = await pool.query('SELECT id FROM brands WHERE id = $1', [brandId]);
      if (rows.length === 0) return reply.code(400).send({ error: 'Brand not found' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO creator_tags (tenant_id, creator_id, tag, brand_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tag, brand_id, detection_count, effectiveness_score, confidence, created_at`,
        [creator.tenantId, creator.id, normalised, brandId ?? null]
      );
      return { tag: rows[0] };
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: `You're already tracking the tag "${normalised}"` });
      }
      throw err;
    }
  });

  // ── DELETE /api/creator/tags/:id ─────────────────────────────────────────

  app.delete('/api/creator/tags/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params;
    const creator = await resolveCreator(req.user.userId, req.user.tenantId);
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });

    const pool = getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM creator_tags WHERE id = $1 AND creator_id = $2`,
      [id, creator.id]
    );

    if (rowCount === 0) return reply.code(404).send({ error: 'Tag not found' });
    return { ok: true };
  });

  // ── GET /api/brands/tag-search?q= ───────────────────────────────────────
  // Returns brand registry suggestions for the tag input

  app.get('/api/brands/tag-search', { preHandler: authenticate }, async (req, reply) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return { brands: [] };

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, brand_name, brand_slug, category
       FROM brands
       WHERE brand_name ILIKE $1 OR brand_slug ILIKE $1
       ORDER BY brand_name
       LIMIT 10`,
      [`%${q}%`]
    );

    return { brands: rows };
  });
}

module.exports = tagRoutes;
