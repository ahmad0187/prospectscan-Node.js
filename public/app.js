// ProspectScan dashboard (vanilla JS).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const open = new Set();
let job = null;
let timer = null;

fetch('/api/health').then((r) => r.json()).then((h) => {
  $('writer').textContent = h.emailWriter === 'claude' ? 'emails: Claude' : 'emails: template (no API key)';
});

try {
  const saved = JSON.parse(localStorage.getItem('prospectscan-sender') || '{}');
  for (const k of ['sender', 'company', 'offer']) if (saved[k]) $(k).value = saved[k];
} catch { /* storage unavailable */ }

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const urls = $('urls').value.split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean);
  const body = { urls, senderName: $('sender').value, senderCompany: $('company').value || undefined, offer: $('offer').value };
  try { localStorage.setItem('prospectscan-sender', JSON.stringify({ sender: body.senderName, company: body.senderCompany, offer: body.offer })); } catch {}
  $('go').disabled = true; $('go').textContent = 'Scanning…';
  open.clear();
  const res = await fetch('/api/audits', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    alert((data.issues || [data.error]).join('\n'));
    $('go').disabled = false; $('go').textContent = 'Scan websites';
    return;
  }
  $('export').href = `/api/audits/${data.id}/export.csv`;
  poll(data.id);
});

async function poll(id) {
  clearTimeout(timer);
  job = await (await fetch(`/api/audits/${id}`)).json();
  render();
  if (job.status !== 'done') timer = setTimeout(() => poll(id), 700);
  else { $('go').disabled = false; $('go').textContent = 'Scan websites'; $('export').hidden = false; }
}

function ring(score, grade) {
  const c = 2 * Math.PI * 15.9;
  return `<div class="ring ${grade}"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9"/><circle class="v" cx="18" cy="18" r="15.9" stroke-dasharray="${(score / 100) * c} ${c}"/></svg><span>${score}</span></div>`;
}

function render() {
  const { done, total } = job.progress;
  $('progress').hidden = false;
  $('bar').style.width = `${(done / total) * 100}%`;
  $('ptext').textContent = job.status === 'done' ? `Scanned ${total} site${total > 1 ? 's' : ''}` : `Scanning ${done}/${total}…`;

  const rows = job.rows.filter((r) => r.result).sort((a, b) => (b.result.ok - a.result.ok) || (b.result.score - a.result.score));
  const count = (g) => rows.filter((r) => r.result.ok && r.result.grade === g).length;
  $('summary').hidden = !rows.length;
  $('summary').innerHTML = `<span class="chip hot"><b>${count('hot')}</b> hot</span><span class="chip warm"><b>${count('warm')}</b> warm</span><span class="chip cool"><b>${count('cool')}</b> cool</span>` +
    (rows.some((r) => !r.result.ok) ? `<span class="chip"><b>${rows.filter((r) => !r.result.ok).length}</b> skipped</span>` : '');
  $('list').innerHTML = rows.map(card).join('') +
    job.rows.filter((r) => !r.result).map((r) => `<div class="card skipped"><div class="head"><div class="who"><div class="url">${esc(r.input)}</div><div class="meta">${r.status === 'running' ? 'Auditing…' : 'Queued'}</div></div></div></div>`).join('');
}

function card(row, i) {
  const r = row.result;
  const key = r.url;
  if (!r.ok) {
    return `<div class="card skipped"><div class="head"><div class="who"><div class="name">${esc(r.url)}</div><div class="meta">Skipped: ${esc(r.skippedReason)}</div></div></div></div>`;
  }
  const top = r.findings.slice(0, 4).map((f) => `<span class="pill">${esc(f.title)}</span>`).join('');
  const contact = [...r.emails.slice(0, 2), ...r.phones.slice(0, 1)].map(esc).join('<br>') || 'no contact found';
  const isOpen = open.has(key) || (open.size === 0 && i === 0 && job.status === 'done');
  if (isOpen) open.add(key);
  const body = !isOpen ? '' : `<div class="body">
    <div><h4>${r.findings.length} findings</h4>${r.findings.map((f) => `
      <div class="finding"><i class="dot ${f.severity}"></i><div><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></div><span class="pts">+${f.points}</span></div>`).join('') || '<p class="meta">Nothing to fix. A well-built site.</p>'}
      <div class="meta" style="margin-top:10px">${esc(r.facts.tech.platform || 'Custom site')} · loaded in ${(r.facts.loadMs / 1000).toFixed(1)}s${r.facts.tech.booking.length ? ' · booking: ' + esc(r.facts.tech.booking.join(', ')) : ''}${r.facts.tech.chat.length ? ' · chat: ' + esc(r.facts.tech.chat.join(', ')) : ''}</div></div>
    <div><h4>Draft email</h4>${row.email ? `
      <div class="meta">Written by ${row.email.writer === 'claude' ? 'Claude' : 'template'} · to ${esc(r.emails[0] || 'no email found')}</div>
      <div class="email"><div class="subject">${esc(row.email.subject)}</div>\n${esc(row.email.body)}</div>
      <button class="btn" data-copy="${i}">Copy email</button>` : '<p class="meta">No email drafted.</p>'}</div>
  </div>`;
  return `<div class="card"><div class="head" data-key="${esc(key)}">${ring(r.score, r.grade)}
    <div class="who"><div class="name">${esc(r.business || new URL(r.url).hostname)} <span class="grade ${r.grade}">${r.grade.toUpperCase()}</span></div>
      <div class="url">${esc(r.url)}</div><div class="pills">${top}</div></div>
    <div class="contact">${contact}</div></div>${body}</div>`;
}

$('list').addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const rows = job.rows.filter((r) => r.result).sort((a, b) => (b.result.ok - a.result.ok) || (b.result.score - a.result.score));
    const em = rows[Number(copy.dataset.copy)].email;
    try { await navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; }
    return;
  }
  const head = e.target.closest('[data-key]');
  if (head) { const k = head.dataset.key; open.has(k) ? open.delete(k) : open.add(k); render(); }
});
