'use strict';
require('dotenv').config();
const { getDataCollectionQueue } = require('../src/jobs/queue');

const platformProfileId = process.argv[2];
if (!platformProfileId) {
  console.error('Usage: node scripts/trigger-sync.js <platformProfileId>');
  process.exit(1);
}

const queue = getDataCollectionQueue();
queue.add('platform-sync', { platformProfileId })
  .then(() => {
    console.log(`Queued platform-sync for profile ${platformProfileId}`);
    process.exit(0);
  });
