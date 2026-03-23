// signal.js — 40NORTH SIGNAL Frontend Logic

const BRIDGE_URL = 'https://40nor-bridge.vercel.app/api';

// ── Pipeline stages for deal modal ──────────────────────────────────────────
const PIPELINES = {
  '6523be54891cd887cb3cbdce': {
    name: '40XFORTY Pipeline',
    stages: [
      { id: 'p85v0k5pcsqi3lkrnj87esa', name: 'Contacted' },
      { id: 'd9ab8bce-c013-4c20-9be3-6ae46c4a1f9c', name: 'Responded' },
      { id: 'b7626c39-d802-4dd1-aa04-1d83f341eaa2', name: 'Discovery Call' },
      { id: '2497b576-8a15-452c-afa2-cbf8fdbcb390', name: 'Proposal Sent' },
    ],
  },
  '69c01b06d99baa6703032c04': {
    name: '40Live OTT',
    stages: [
      { id: 'lekmq8ib7um1xaw80bbmmsj', name: 'Contacted' },
      { id: 'y2o5s0ltz8w1fathxbe7hp4', name: 'Discovery Call' },
      { id: 'q950frcz5sts3ahvlv0h5rb', name: 'Demo Given' },
      { id: 'q8doatme8tr2cp6rpal67nh', name: 'Proposal Sent' },
    ],
  },
};

// ── State ───────────────────────────────────────────────────────────────────
let currentCampaignId = null;
let currentNotionDbId = null;
let currentEmailContact = null;
let currentDealContact = null;

// ── Bridge API ──────────────────────────────────────────────────────────────
async function bridgeCall(endpoint, action, data = {}) {
  const secret = localStorage.getItem('signal_bridge_secret');
  if (!secret) {
    showSettingsModal('Bridge secret required');
    return null;
  }
  try {
    const res = await fetch(`${BRIDGE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, action, ...data }),
    });
    const rawText = await res.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('API response not JSON:', rawText.slice(0, 500));
      toast(`API returned invalid JSON (${res.status}): ${rawText.slice(0, 150)}`, 'error');
      return null;
    }
    if (!res.ok) {
      toast(json.error || `API error: ${res.status}`, 'error');
      return null;
    }
    return json;
  } catch (e) {
    toast(`Network error: ${e.message}`, 'error');
    return null;
  }
}

// ── View Router ─────────────────────────────────────────────────────────────
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${viewId}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === viewId);
  });
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-view]');
  if (link) {
    e.preventDefault();
    const view = link.dataset.view;
    showView(view);
    if (view === 'dashboard') loadDashboard();
    if (view === 'queue') loadQueue();
  }
});

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  showView(hash);
  if (hash === 'dashboard') loadDashboard();
  if (hash === 'queue') loadQueue();
});

// ── Toast Notifications ─────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Settings ────────────────────────────────────────────────────────────────
function showSettingsModal(msg) {
  document.getElementById('settings-modal').style.display = 'flex';
  document.getElementById('settings-secret').value = localStorage.getItem('signal_bridge_secret') || '';
  if (msg) toast(msg, 'error');
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
  const secret = document.getElementById('settings-secret').value.trim();
  if (!secret) { toast('Secret cannot be empty', 'error'); return; }
  localStorage.setItem('signal_bridge_secret', secret);
  closeSettings();
  toast('Settings saved');
  loadDashboard();
}

// ── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  if (!localStorage.getItem('signal_bridge_secret')) {
    showSettingsModal('Enter your Bridge secret to get started');
    return;
  }
  const result = await bridgeCall('signal-campaign', 'listCampaigns');
  if (!result) return;

  const campaigns = result.campaigns || [];

  // KPIs
  const totalOrgs = campaigns.reduce((s, c) => s + (c.orgsFound || 0), 0);
  const totalContacts = campaigns.reduce((s, c) => s + (c.contactsFound || 0), 0);
  const totalEmails = campaigns.reduce((s, c) => s + (c.emailsFound || 0), 0);
  document.getElementById('kpi-campaigns').textContent = campaigns.length;
  document.getElementById('kpi-orgs').textContent = totalOrgs;
  document.getElementById('kpi-contacts').textContent = totalContacts;
  document.getElementById('kpi-emails').textContent = totalEmails;

  // Campaign list
  const listEl = document.getElementById('campaign-list');
  if (campaigns.length === 0) {
    listEl.innerHTML = `<div class="empty-state">
      <h3>No campaigns yet</h3>
      <p>Create your first campaign to start prospecting</p>
      <a href="#new-campaign" class="btn btn-primary" data-view="new-campaign">+ New Campaign</a>
    </div>`;
    return;
  }

  listEl.innerHTML = `<div class="campaign-grid">${campaigns.map(c => `
    <div class="campaign-card" onclick="openCampaign('${c.id}', '${c.notionDbId}')">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <h4>${esc(c.name)}</h4>
        <span class="badge badge-${(c.status || 'draft').toLowerCase()}">${esc(c.status)}</span>
      </div>
      <div class="meta">
        <span>${esc(c.sector)}</span>
        <span>${c.orgsFound || 0} orgs</span>
        <span>${c.contactsFound || 0} contacts</span>
        <span>${c.emailsFound || 0} emails</span>
      </div>
    </div>
  `).join('')}</div>`;
}

function esc(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// ── Campaign Detail ─────────────────────────────────────────────────────────
async function openCampaign(campaignId, notionDbId) {
  currentCampaignId = campaignId;
  currentNotionDbId = notionDbId;
  showView('campaign-detail');

  document.getElementById('detail-title').textContent = 'Loading...';
  document.getElementById('detail-kpis').innerHTML = '';
  document.getElementById('detail-orgs').innerHTML = '<p style="color:var(--muted)">Loading organisations...</p>';

  // Get campaign info
  const campResult = await bridgeCall('signal-campaign', 'getCampaign', { campaignId });
  if (!campResult) return;
  const c = campResult.campaign;
  document.getElementById('detail-title').textContent = c.name || 'Campaign';

  document.getElementById('detail-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-value">${c.orgsFound || 0}</div><div class="kpi-label">Orgs</div></div>
    <div class="kpi"><div class="kpi-value">${c.contactsFound || 0}</div><div class="kpi-label">Contacts</div></div>
    <div class="kpi"><div class="kpi-value">${c.emailsFound || 0}</div><div class="kpi-label">Emails</div></div>
    <div class="kpi"><div class="kpi-value">${c.outreachSent || 0}</div><div class="kpi-label">Outreach Sent</div></div>
  `;

  // Get orgs from the campaign DB
  if (!notionDbId) {
    document.getElementById('detail-orgs').innerHTML = '<p style="color:var(--muted)">No database linked — campaign may still be in draft</p>';
    return;
  }

  // Query the campaign Notion DB for org pages
  const orgsResult = await bridgeCall('signal-contacts', 'getQueue', { campaignId });
  if (!orgsResult) return;

  // Group contacts by org
  const byOrg = {};
  for (const contact of (orgsResult.contacts || [])) {
    if (!byOrg[contact.orgName]) byOrg[contact.orgName] = [];
    byOrg[contact.orgName].push(contact);
  }

  const orgNames = Object.keys(byOrg);
  if (orgNames.length === 0) {
    document.getElementById('detail-orgs').innerHTML = '<div class="empty-state"><h3>No contacts found yet</h3><p>Run the campaign or wait for processing to complete</p></div>';
    return;
  }

  document.getElementById('detail-orgs').innerHTML = orgNames.map(orgName => {
    const contacts = byOrg[orgName];
    return `<div class="org-block">
      <h4>${esc(orgName)}</h4>
      <div class="org-meta">
        <span>${contacts.length} contact${contacts.length !== 1 ? 's' : ''}</span>
      </div>
      ${contacts.map(ct => `
        <div class="contact-row">
          <div class="contact-info">
            <div class="contact-name">${esc(ct.contactName)}</div>
            <div class="contact-role">${esc(ct.role || '')}</div>
            <div class="contact-email">${ct.email ? esc(ct.email) : '<span style="color:var(--red)">No email</span>'}</div>
          </div>
          <div class="contact-actions">
            ${ct.email ? `<button class="btn btn-green btn-sm" onclick='openEmailModal(${JSON.stringify(ct).replace(/'/g, "&#39;")})'>Email</button>` : ''}
            <button class="btn btn-amber btn-sm" onclick='openDealModal(${JSON.stringify(ct).replace(/'/g, "&#39;")})'>Deal</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  }).join('');
}

// ── Start Campaign ──────────────────────────────────────────────────────────
async function startCampaign() {
  const name = document.getElementById('campaign-name').value.trim();
  const sector = document.getElementById('campaign-sector').value;
  const icp = document.getElementById('campaign-icp').value.trim();

  if (!name) { toast('Campaign name required', 'error'); return; }
  if (!icp) { toast('ICP prompt required', 'error'); return; }

  showView('running');
  updateProgress('Starting pipeline...', 0);
  document.getElementById('org-results').innerHTML = '';

  const startResult = await bridgeCall('signal-run', 'start', {
    campaignName: name, icpPrompt: icp, sector,
  });

  if (!startResult?.orgs) {
    updateProgress('Failed to start campaign', 0);
    toast('Campaign start failed — check ICP prompt', 'error');
    return;
  }

  const { campaignId, notionDbId, orgs, icpParsed } = startResult;
  const total = orgs.length;
  updateProgress(`Found ${total} organisations. Processing...`, 5);

  const results = [];
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    updateProgress(`Processing ${i + 1}/${total}: ${org.name}...`, 10 + (i / total) * 80, org.name);

    const orgResult = await bridgeCall('signal-run', 'processOrg', {
      orgName: org.name,
      website: org.website,
      league: org.league,
      sport: sector,
      notionDbId,
      campaignId,
      icpParsed,
    });

    if (orgResult) {
      results.push(orgResult);
      appendOrgResult(orgResult);
    } else {
      results.push({ orgName: org.name, contactsFound: 0, emailsFound: 0, outreachGenerated: 0 });
      appendOrgResult({ orgName: org.name, contactsFound: 0, emailsFound: 0, error: true });
    }
  }

  // Finalize
  updateProgress('Finalising...', 92);
  const totalContacts = results.reduce((s, r) => s + (r.contactsFound || 0), 0);
  const totalEmails = results.reduce((s, r) => s + (r.emailsFound || 0), 0);

  await bridgeCall('signal-run', 'finalize', {
    campaignId,
    stats: {
      orgsProcessed: orgs.length,
      contactsFound: totalContacts,
      emailsFound: totalEmails,
      outreachGenerated: totalContacts,
    },
  });

  updateProgress('Complete!', 100);
  toast(`Campaign complete: ${totalContacts} contacts, ${totalEmails} emails`);

  setTimeout(() => openCampaign(campaignId, notionDbId), 2000);
}

async function saveDraft() {
  const name = document.getElementById('campaign-name').value.trim();
  const sector = document.getElementById('campaign-sector').value;
  const icp = document.getElementById('campaign-icp').value.trim();
  if (!name) { toast('Campaign name required', 'error'); return; }

  const result = await bridgeCall('signal-campaign', 'createCampaign', { name, icpPrompt: icp, sector });
  if (result) {
    toast('Draft saved');
    showView('dashboard');
    loadDashboard();
  }
}

// ── Progress Helpers ────────────────────────────────────────────────────────
function updateProgress(status, percent, currentOrg) {
  document.getElementById('progress-status').textContent = status;
  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-current').textContent = currentOrg || '';
}

function appendOrgResult(r) {
  const container = document.getElementById('org-results');
  const el = document.createElement('div');
  el.className = 'org-result';
  const emailClass = r.emailsFound > 0 ? 'has-email' : 'no-email';
  el.innerHTML = `
    <span class="org-name">${esc(r.orgName)}</span>
    <span class="org-stats">
      <span>${r.contactsFound || 0} contacts</span>
      <span class="${emailClass}">${r.emailsFound || 0} emails</span>
      ${r.error ? '<span style="color:var(--red)">error</span>' : ''}
    </span>
  `;
  container.appendChild(el);
}

// ── Outreach Queue ──────────────────────────────────────────────────────────
async function loadQueue() {
  const result = await bridgeCall('signal-contacts', 'getQueue');
  if (!result) return;

  const contacts = result.contacts || [];
  const el = document.getElementById('queue-content');

  if (contacts.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>No contacts in queue</h3><p>Run a campaign to populate the outreach queue</p></div>';
    return;
  }

  el.innerHTML = `<table class="queue-table">
    <thead><tr>
      <th>Contact</th><th>Org</th><th>Role</th><th>Email</th><th>Priority</th><th>Actions</th>
    </tr></thead>
    <tbody>${contacts.map(ct => `<tr>
      <td>${esc(ct.contactName)}</td>
      <td>${esc(ct.orgName)}</td>
      <td style="color:var(--muted)">${esc(ct.role || '')}</td>
      <td style="color:${ct.email ? 'var(--teal)' : 'var(--red)'}">${ct.email ? esc(ct.email) : 'N/A'}</td>
      <td><span class="badge badge-${ct.priority === 'Primary' ? 'complete' : ct.priority === 'Secondary' ? 'running' : 'draft'}">${esc(ct.priority || '')}</span></td>
      <td>
        ${ct.email ? `<button class="btn btn-green btn-sm" onclick='openEmailModal(${JSON.stringify(ct).replace(/'/g, "&#39;")})'>Email</button>` : ''}
        <button class="btn btn-amber btn-sm" onclick='openDealModal(${JSON.stringify(ct).replace(/'/g, "&#39;")})'>Deal</button>
      </td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── Email Modal ─────────────────────────────────────────────────────────────
function openEmailModal(contact) {
  currentEmailContact = contact;
  document.getElementById('email-modal').style.display = 'flex';
  document.getElementById('email-to').value = contact.email || '';

  // Parse subject and body from outreach draft
  const draft = contact.outreachDraft || '';
  const lines = draft.split('\n');
  let subject = '';
  let body = draft;

  // If first line looks like a subject line
  if (lines.length > 2 && lines[1].trim() === '') {
    subject = lines[0].replace(/^Subject:\s*/i, '');
    body = lines.slice(2).join('\n');
  }

  document.getElementById('email-subject').value = subject || `${contact.orgName} — 40Live OTT`;
  document.getElementById('email-body').value = body;
}

function closeEmailModal() {
  document.getElementById('email-modal').style.display = 'none';
  currentEmailContact = null;
}

async function sendEmailDraft() {
  const to = document.getElementById('email-to').value.trim();
  const subject = document.getElementById('email-subject').value.trim();
  const body = document.getElementById('email-body').value.trim();
  if (!to || !body) { toast('Email and body required', 'error'); return; }

  const toName = currentEmailContact?.contactName?.split(' — ')[0] || '';
  const result = await bridgeCall('ms365-mail', 'createDraft', {
    to, toName, subject, body: body.replace(/\n/g, '<br>'), bodyType: 'HTML',
  });

  if (result) {
    toast('Draft saved to Outlook');
    // Mark outreach sent in Notion
    if (currentEmailContact?.notionPageId) {
      await bridgeCall('signal-contacts', 'markOutreachSent', {
        contactPageId: currentEmailContact.notionPageId,
        channel: 'email',
      });
    }
    closeEmailModal();
  }
}

// ── Deal Modal ──────────────────────────────────────────────────────────────
function openDealModal(contact) {
  currentDealContact = contact;
  document.getElementById('deal-modal').style.display = 'flex';
  document.getElementById('deal-name').value = `${contact.orgName} — 40Live OTT`;
  updateStages();
}

function closeDealModal() {
  document.getElementById('deal-modal').style.display = 'none';
  currentDealContact = null;
}

function updateStages() {
  const pipelineId = document.getElementById('deal-pipeline').value;
  const pipeline = PIPELINES[pipelineId];
  const stageSelect = document.getElementById('deal-stage');
  stageSelect.innerHTML = (pipeline?.stages || []).map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');
}

async function createDeal() {
  const dealName = document.getElementById('deal-name').value.trim();
  const pipelineId = document.getElementById('deal-pipeline').value;
  const stageId = document.getElementById('deal-stage').value;
  if (!dealName) { toast('Deal name required', 'error'); return; }

  // Create deal via claude-bridge
  const deal = await bridgeCall('claude-bridge', 'createDeal', {
    dealName, pipelineId,
  });

  if (deal?.dealId) {
    // Update stage
    await bridgeCall('claude-bridge', 'updateDealStage', {
      dealId: deal.dealId, stageId,
    });
    toast(`Deal created: ${dealName}`);
    closeDealModal();
  }
}

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  showView(hash);
  if (hash === 'dashboard') loadDashboard();
  if (hash === 'queue') loadQueue();
  updateStages();
});
