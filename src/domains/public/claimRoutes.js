'use strict';

const { authenticate } = require('../../middleware/authenticate');
const { getPrisma }    = require('../../lib/prisma');

async function claimRoutes(app) {

  // POST /api/public/claim — claim a public score card
  app.post('/api/public/claim', { preHandler: authenticate }, async (req, reply) => {
    const { scoreCardId } = req.body || {};

    if (!scoreCardId) {
      return reply.code(400).send({ error: 'scoreCardId is required' });
    }

    const prisma = getPrisma();

    const card = await prisma.publicScoreCard.findUnique({
      where: { id: scoreCardId },
    });

    if (!card) {
      return reply.code(404).send({ error: 'Score card not found' });
    }

    if (card.claimedByUserId) {
      return reply.code(409).send({ error: 'This score has already been claimed' });
    }

    await prisma.publicScoreCard.update({
      where: { id: scoreCardId },
      data: {
        claimedAt: new Date(),
        claimedByUserId: req.user.userId,
      },
    });

    return { success: true, scoreCardId };
  });

  // GET /api/public/claim/:scoreCardId — check claim status
  app.get('/api/public/claim/:scoreCardId', async (req, reply) => {
    const prisma = getPrisma();

    const card = await prisma.publicScoreCard.findUnique({
      where: { id: req.params.scoreCardId },
      select: { id: true, channelName: true, channelAvatarUrl: true, claimedAt: true, claimedByUserId: true },
    });

    if (!card) {
      return reply.code(404).send({ error: 'Score card not found' });
    }

    return {
      scoreCardId: card.id,
      channelName: card.channelName,
      channelAvatarUrl: card.channelAvatarUrl,
      isClaimed: !!card.claimedAt,
    };
  });
}

module.exports = { claimRoutes };
