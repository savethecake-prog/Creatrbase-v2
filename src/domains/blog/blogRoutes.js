'use strict';

const { prisma } = require('../../lib/prisma');

const PAGE_SIZE = 12;

function requireAdminKey(request, reply) {
  const key = request.headers['x-admin-key'] || request.query.adminKey;
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return reply.code(401).send({ error: 'Unauthorised' });
  }
}

async function blogRoutes(app) {

  // ── Public endpoints ─────────────────────────────────────────────────────

  // GET /api/blog/posts — paginated published posts
  app.get('/api/blog/posts', async (request, reply) => {
    const { page = 1, category, limit = PAGE_SIZE } = request.query;
    const take   = Math.min(Number(limit), 50);
    const skip   = (Number(page) - 1) * take;

    const where = {
      status: 'published',
      ...(category ? { category: { slug: category } } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImageUrl: true,
          authorName: true,
          authorAvatar: true,
          readingTimeMin: true,
          publishedAt: true,
          featured: true,
          category: { select: { slug: true, name: true } },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return { posts, total, page: Number(page), pageSize: take };
  });

  // GET /api/blog/featured — up to 3 featured published posts
  app.get('/api/blog/featured', async (_request, _reply) => {
    const posts = await prisma.blogPost.findMany({
      where:   { status: 'published', featured: true },
      orderBy: { publishedAt: 'desc' },
      take:    3,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        authorName: true,
        readingTimeMin: true,
        publishedAt: true,
        category: { select: { slug: true, name: true } },
      },
    });
    return { posts };
  });

  // GET /api/blog/categories — all categories
  app.get('/api/blog/categories', async (_request, _reply) => {
    const categories = await prisma.blogCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { categories };
  });

  // GET /api/blog/posts/:slug — single post with full body
  app.get('/api/blog/posts/:slug', async (request, reply) => {
    const post = await prisma.blogPost.findFirst({
      where:  { slug: request.params.slug, status: 'published' },
      include: { category: { select: { slug: true, name: true } } },
    });
    if (!post) return reply.code(404).send({ error: 'Not found' });
    return { post };
  });

  // ── Admin endpoints (ADMIN_API_KEY required) ─────────────────────────────

  // POST /api/blog/posts — create draft or published post
  app.post('/api/blog/posts', async (request, reply) => {
    if (requireAdminKey(request, reply)) return;

    const {
      slug, title, excerpt, bodyHtml, bodyMarkdown,
      coverImageUrl, categoryId, authorName, authorAvatar,
      status = 'draft', featured = false, readingTimeMin, publishedAt,
    } = request.body;

    if (!slug || !title) {
      return reply.code(400).send({ error: 'slug and title are required' });
    }

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title,
        excerpt,
        bodyHtml,
        bodyMarkdown,
        coverImageUrl,
        categoryId: categoryId || null,
        authorName:  authorName || 'Creatrbase',
        authorAvatar,
        status,
        featured,
        readingTimeMin: readingTimeMin ? Number(readingTimeMin) : null,
        publishedAt:   status === 'published' ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
      },
    });
    return reply.code(201).send({ post });
  });

  // PATCH /api/blog/posts/:slug — update any field
  app.patch('/api/blog/posts/:slug', async (request, reply) => {
    if (requireAdminKey(request, reply)) return;

    const existing = await prisma.blogPost.findUnique({ where: { slug: request.params.slug } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const {
      title, excerpt, bodyHtml, bodyMarkdown,
      coverImageUrl, categoryId, authorName, authorAvatar,
      status, featured, readingTimeMin, publishedAt,
    } = request.body;

    const data = {};
    if (title          !== undefined) data.title          = title;
    if (excerpt        !== undefined) data.excerpt        = excerpt;
    if (bodyHtml       !== undefined) data.bodyHtml       = bodyHtml;
    if (bodyMarkdown   !== undefined) data.bodyMarkdown   = bodyMarkdown;
    if (coverImageUrl  !== undefined) data.coverImageUrl  = coverImageUrl;
    if (categoryId     !== undefined) data.categoryId     = categoryId || null;
    if (authorName     !== undefined) data.authorName     = authorName;
    if (authorAvatar   !== undefined) data.authorAvatar   = authorAvatar;
    if (featured       !== undefined) data.featured       = featured;
    if (readingTimeMin !== undefined) data.readingTimeMin = readingTimeMin ? Number(readingTimeMin) : null;

    if (status !== undefined) {
      data.status = status;
      if (status === 'published' && !existing.publishedAt) {
        data.publishedAt = publishedAt ? new Date(publishedAt) : new Date();
      }
    }
    if (publishedAt !== undefined) data.publishedAt = new Date(publishedAt);

    const post = await prisma.blogPost.update({
      where: { slug: request.params.slug },
      data,
    });
    return { post };
  });

  // DELETE /api/blog/posts/:slug — hard delete (admin only)
  app.delete('/api/blog/posts/:slug', async (request, reply) => {
    if (requireAdminKey(request, reply)) return;

    const existing = await prisma.blogPost.findUnique({ where: { slug: request.params.slug } });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    await prisma.blogPost.delete({ where: { slug: request.params.slug } });
    return reply.code(204).send();
  });
}

module.exports = blogRoutes;
