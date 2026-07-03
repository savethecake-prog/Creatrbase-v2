import { SERVICE_BASE } from './config';

/**
 * The agencies intake-form backend client (CB-KD-04 s.2; service /form/* behind
 * /agencies-svc). Field-shape convention: nested `answers` is canonical — POST /drafts
 * and PATCH /drafts/:id both send { answers } (PATCH also sends step). See the service
 * README "Public form backend": nested wins, PATCH is nested-only.
 */

async function req(method, path, body) {
  const res = await fetch(`${SERVICE_BASE}/form${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const formApi = {
  // step one: create the draft. answers carries fork_choice + agency_name.
  createDraft: (answers, extra = {}) => req('POST', '/drafts', { answers, ...extra }),
  // incremental step write. nested-only { step, answers }.
  patchDraft: (id, step, answers, extra = {}) => req('PATCH', `/drafts/${id}`, { step, answers, ...extra }),
  // resume from a magic token.
  resume: (token) => req('POST', '/resume', { token }),
  // final submit.
  submit: (id, extra = {}) => req('POST', `/drafts/${id}/submit`, extra),
  // pool preview interstitial. mix = platforms_counts rows.
  poolPreview: (mix) => req('POST', '/pool-preview', { mix }),
};
