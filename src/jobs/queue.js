'use strict';

// ─── Bull queue instances ─────────────────────────────────────────────────────
// Single queue for all data-collection jobs. Job type is set via job.name.
// Workers call queue.process('job-name', handler) to subscribe.
// ─────────────────────────────────────────────────────────────────────────────

const Bull = require('bull');

let _dataCollectionQueue;

function getDataCollectionQueue() {
  if (!_dataCollectionQueue) {
    _dataCollectionQueue = new Bull('data-collection', {
      redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      defaultJobOptions: {
        attempts:  3,
        backoff:   { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,  // keep last 100 completed jobs for visibility
        removeOnFail:     200,
      },
    });
  }
  return _dataCollectionQueue;
}

module.exports = { getDataCollectionQueue };
