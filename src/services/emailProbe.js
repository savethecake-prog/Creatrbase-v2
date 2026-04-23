'use strict';

// ─── Email probe service ──────────────────────────────────────────────────────
// SMTP verification using Node's built-in `net` and `dns` modules.
// No message is ever sent — only a RCPT TO handshake.
// No npm dependencies.
// ─────────────────────────────────────────────────────────────────────────────

const dns = require('dns').promises;
const net = require('net');

const EHLO_DOMAIN          = 'creatrbase.com';
const SMTP_CONNECT_TIMEOUT = 10_000; // ms
const SMTP_COMMAND_TIMEOUT = 5_000;  // ms

// ─── smtpHandshake ────────────────────────────────────────────────────────────
// Opens a TCP connection to mxHost:25.
// Protocol: wait for 220 → EHLO → MAIL FROM → RCPT TO → QUIT.
// Returns { code, message, durationMs }.

function smtpHandshake(mxHost, emailAddress) {
  return new Promise((resolve, reject) => {
    const startMs = Date.now();
    let settled   = false;
    let cmdTimer  = null;
    let buf       = '';
    let step      = 0; // 0 = waiting for banner, 1 = EHLO sent, 2 = MAIL FROM sent, 3 = RCPT TO sent

    const COMMANDS = [
      null,                                        // step 0: wait for 220 banner (no send)
      `EHLO ${EHLO_DOMAIN}\r\n`,                  // step 1: send after banner
      `MAIL FROM: <verify@${EHLO_DOMAIN}>\r\n`,   // step 2: send after EHLO
      `RCPT TO: <${emailAddress}>\r\n`,           // step 3: send after MAIL FROM
    ];

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(cmdTimer);
      socket.destroy();
      resolve({ ...result, durationMs: Date.now() - startMs });
    }

    function abort(err) {
      if (settled) return;
      settled = true;
      clearTimeout(cmdTimer);
      socket.destroy();
      reject(err);
    }

    function armTimer() {
      clearTimeout(cmdTimer);
      cmdTimer = setTimeout(() => abort(new Error('SMTP command timeout')), SMTP_COMMAND_TIMEOUT);
    }

    const socket = net.createConnection({ host: mxHost, port: 25 });
    socket.setTimeout(SMTP_CONNECT_TIMEOUT, () => abort(new Error('SMTP connect timeout')));
    socket.on('error', abort);
    socket.on('connect', armTimer);

    socket.on('data', (chunk) => {
      buf += chunk.toString('ascii');
      const lines = buf.split('\r\n');
      buf = lines.pop(); // retain any incomplete trailing line

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        // Multi-line SMTP response: intermediate lines have a dash in position 3
        if (line[3] === '-') continue;

        armTimer();

        if (step < 3) {
          // Steps 0-2: send next command
          if (code >= 400) {
            // Server rejected early (transient 4xx or permanent 5xx)
            socket.write('QUIT\r\n');
            finish({ code, message: line.slice(4) });
            return;
          }
          step++;
          socket.write(COMMANDS[step]);
        } else {
          // Step 3: RCPT TO response — this is the verdict
          socket.write('QUIT\r\n');
          finish({ code, message: line.slice(4) });
        }
      }
    });
  });
}

// ─── probeEmail ───────────────────────────────────────────────────────────────
// Main export.
//
// Returns one of:
//   { status: 'no_mx',    domain, durationMs }
//   { status: 'invalid',  domain, mxHost, smtpCode, smtpMessage, durationMs }
//   { status: 'unknown',  domain, mxHost?, smtpCode?, smtpMessage?, durationMs, error? }
//   { status: 'catch_all',domain, mxHost, smtpCode, catchAll: true, durationMs }
//   { status: 'verified', domain, mxHost, smtpCode, catchAll: false, durationMs }

async function probeEmail(email) {
  const atIdx = email.indexOf('@');
  if (atIdx < 1) return { status: 'invalid', error: 'malformed email', durationMs: 0 };

  const domain  = email.slice(atIdx + 1).toLowerCase();
  const startMs = Date.now();

  // ── 1. MX record lookup ───────────────────────────────────────────────────
  let mxRecords;
  try {
    mxRecords = await dns.resolveMx(domain);
  } catch (_) {
    mxRecords = [];
  }

  if (!mxRecords.length) {
    return { status: 'no_mx', domain, durationMs: Date.now() - startMs };
  }

  const mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;

  // ── 2. SMTP probe — target address ────────────────────────────────────────
  let result;
  try {
    result = await smtpHandshake(mxHost, email);
  } catch (err) {
    return {
      status:    'unknown',
      domain,
      mxHost,
      durationMs: Date.now() - startMs,
      error:     err.message,
    };
  }

  // Hard rejection: mailbox does not exist
  if (result.code === 550 || result.code === 551 || result.code === 553) {
    return {
      status:      'invalid',
      domain,
      mxHost,
      smtpCode:    result.code,
      smtpMessage: result.message,
      durationMs:  Date.now() - startMs,
    };
  }

  if (result.code !== 250) {
    return {
      status:      'unknown',
      domain,
      mxHost,
      smtpCode:    result.code,
      smtpMessage: result.message,
      durationMs:  Date.now() - startMs,
    };
  }

  // ── 3. Catch-all detection — probe a provably fake address ────────────────
  // If the fake address is also accepted → the domain accepts all recipients.
  // This is how Google Workspace and Microsoft 365 behave for enterprise brands.
  const fakeEmail     = `xverify_${Math.random().toString(36).slice(2, 10)}@${domain}`;
  let catchAllResult;
  try {
    catchAllResult = await smtpHandshake(mxHost, fakeEmail);
  } catch (_) {
    catchAllResult = { code: 421 }; // error → assume not catch-all (conservative)
  }

  const isCatchAll = catchAllResult.code === 250;

  return {
    status:      isCatchAll ? 'catch_all' : 'verified',
    catchAll:    isCatchAll,
    domain,
    mxHost,
    smtpCode:    result.code,
    smtpMessage: result.message,
    durationMs:  Date.now() - startMs,
  };
}

module.exports = { probeEmail };
