'use strict';

const { getPrisma } = require('../lib/prisma');

const ADMIN_THRESHOLD = 100;

/**
 * Fastify preHandler hook.
 * Returns 404 (not 401) for non-admins to hide the admin surface entirely.
 * Must be used AFTER authenticate middleware.
 */
async function requireAdmin(req, reply) {
  if (!req.user?.userId) {
    return reply.code(404).type('text/html').send(cheeky404());
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { cfoAccessLevel: true },
  });

  if (!user || user.cfoAccessLevel < ADMIN_THRESHOLD) {
    return reply.code(404).type('text/html').send(cheeky404());
  }

  req.isAdmin = true;
}

function cheeky404() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>404</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;background:#FAF6EF;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;color:#1B1040}
    .wrap{text-align:center;max-width:480px;padding:40px}
    .geeza{font-size:120px;line-height:1;margin-bottom:24px}
    h1{font-family:'Lilita One',cursive;font-size:32px;margin-bottom:12px;letter-spacing:-0.01em}
    p{font-size:16px;color:#76688F;line-height:1.6;margin-bottom:32px}
    a{display:inline-block;padding:12px 28px;background:#1B1040;color:#FAF6EF;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px}
    a:hover{opacity:0.88}
    .cap{font-size:48px;margin-bottom:8px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="cap">🧢</div>
    <div class="geeza">🫣</div>
    <h1>Naughty naughty!</h1>
    <p>You're not meant to be here darlin'. This bit's for the gaffer only, innit. Jog on before someone notices.</p>
    <a href="/">Take me home</a>
  </div>
</body>
</html>`;
}

module.exports = { requireAdmin, ADMIN_THRESHOLD };
