'use strict';
require('dotenv').config();
const { getPrisma } = require('../src/lib/prisma');

getPrisma()
  .creatorPlatformProfile
  .findMany({ select: { id: true, platform: true, platformUsername: true } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .then(() => process.exit(0));
