'use strict';

const { getDataCollectionQueue } = require('../queue');
const { runCreatorEconomyDigest } = require('../../agents/newsletter/creator-economy-digest');
const { runAIForCreatorsDigest } = require('../../agents/newsletter/ai-for-creators-digest');

function startNewsletterDigestWorkers() {
  const queue = getDataCollectionQueue();

  // Creator Economy Digest: Mondays 8am UK (UTC+1 in BST = 7am UTC)
  queue.add('creatorEconomyDigest', {}, {
    repeat: { cron: '0 7 * * 1' },
    jobId: 'creatorEconomyDigest-recurring',
  });

  queue.process('creatorEconomyDigest', async () => {
    await runCreatorEconomyDigest();
  });

  // AI for Creators Digest: Thursdays 8am UK
  queue.add('aiForCreatorsDigest', {}, {
    repeat: { cron: '0 7 * * 4' },
    jobId: 'aiForCreatorsDigest-recurring',
  });

  queue.process('aiForCreatorsDigest', async () => {
    await runAIForCreatorsDigest();
  });

  console.log('[newsletterDigests] workers registered (Mon 8am, Thu 8am UK)');
}

module.exports = { startNewsletterDigestWorkers };
