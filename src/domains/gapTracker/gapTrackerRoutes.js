'use strict';

const { authenticate }  = require('../../middleware/authenticate');
const { getGapAnalysis } = require('./gapTrackerService');

async function gapTrackerRoutes(app) {
  app.get('/api/gap-tracker', { preHandler: authenticate }, async (req) => {
    const data = await getGapAnalysis(req.user.userId, req.user.tenantId);
    return { data };
  });
}

module.exports = gapTrackerRoutes;
