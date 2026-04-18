'use strict';

/**
 * Listmonk API client.
 * Wraps the Listmonk REST API for subscriber and campaign management.
 * Requires LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN env vars.
 */
class ListmonkClient {
  constructor() {
    this.baseUrl = process.env.LISTMONK_URL || 'http://localhost:9000';
    this.auth = Buffer.from(
      `${process.env.LISTMONK_API_USER || 'admin'}:${process.env.LISTMONK_API_TOKEN || ''}`
    ).toString('base64');
  }

  async _request(method, path, body) {
    const url = `${this.baseUrl}/api${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Listmonk API error: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /**
   * Subscribe an email to one or more lists.
   * @param {string} email
   * @param {string[]} listUUIDs - Listmonk list UUIDs
   * @returns {object} subscriber record
   */
  async subscribe(email, listUUIDs) {
    return this._request('POST', '/subscribers', {
      email,
      name: '',
      status: 'enabled',
      lists: listUUIDs.map(uuid => ({ uuid })),
      preconfirm_subscriptions: false,
    });
  }

  /**
   * Unsubscribe an email from all lists.
   */
  async unsubscribe(subscriberId) {
    return this._request('PUT', `/subscribers/${subscriberId}`, {
      status: 'blocklisted',
    });
  }

  /**
   * Get subscriber by email.
   */
  async getSubscriberByEmail(email) {
    const data = await this._request('GET', `/subscribers?query=subscribers.email='${encodeURIComponent(email)}'&per_page=1`);
    return data.data?.results?.[0] || null;
  }

  /**
   * Create a campaign draft in Listmonk.
   * @returns {object} campaign record with id
   */
  async createDraft({ name, subject, lists, fromEmail, body, altbody, templateId, tags }) {
    return this._request('POST', '/campaigns', {
      name: name || subject,
      subject,
      lists: lists || [],
      from_email: fromEmail || 'hello@creatrbase.com',
      content_type: 'richtext',
      body: body || '',
      altbody: altbody || '',
      template_id: templateId || undefined,
      tags: tags || [],
      type: 'regular',
      status: 'draft',
    });
  }

  /**
   * Schedule a campaign for sending.
   */
  async scheduleCampaign(campaignId, sendAt) {
    return this._request('PUT', `/campaigns/${campaignId}/status`, {
      status: sendAt ? 'scheduled' : 'running',
      send_at: sendAt || undefined,
    });
  }

  /**
   * Get campaigns (drafts, sent, etc).
   */
  async getCampaigns({ status, perPage = 20, page = 1 } = {}) {
    let path = `/campaigns?per_page=${perPage}&page=${page}&order_by=created_at&order=desc`;
    if (status) path += `&status=${status}`;
    return this._request('GET', path);
  }

  /**
   * Get a single campaign by ID.
   */
  async getCampaign(campaignId) {
    return this._request('GET', `/campaigns/${campaignId}`);
  }

  /**
   * Get all lists.
   */
  async getLists() {
    return this._request('GET', '/lists');
  }
}

let _client;
function getListmonkClient() {
  if (!_client) _client = new ListmonkClient();
  return _client;
}

module.exports = { ListmonkClient, getListmonkClient };
