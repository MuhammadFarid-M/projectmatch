/* ProjectMatch -- shared frontend helpers.
   Everything here is used by more than one page. Page-specific logic
   lives in a <script> at the bottom of that page. */

/* --- escaping ------------------------------------------------------------
   innerHTML executes whatever you hand it. Bios, notes and post
   descriptions are user input, so every interpolated value goes through
   esc(). This is the one thing a template engine was doing for you
   silently -- skip it and a profile with a <script> tag in the bio owns
   your demo. */
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const api = async (path, opts) => {
  const res = await fetch(path, opts);
  if (!res.ok && res.status !== 401) throw new Error(await res.text());
  return res.json();
};

const qs = k => new URLSearchParams(location.search).get(k);

/* --- nav ---------------------------------------------------------------- */
let ME = null;

async function injectNav() {
  const data = await api('/api/me');
  ME = data.logged_in ? data.user : null;
  const notes = data.notifications || 0;
  const waiting = data.pending_applications || 0;

  const links = ME
    ? `<a class="navbtn nav-discover" href="/index.html">Discover</a>
       <a class="navbtn nav-teams" href="/my-posts.html">My teams${waiting ? ` <span class="badge">${waiting}</span>` : ''}</a>
       <a class="navbtn nav-post" href="/create.html">Post a role</a>
       <a class="navbtn nav-activity" href="/invites.html">Activity${notes ? ` <span class="badge">${notes}</span>` : ''}</a>
       <span class="spacer"></span>
       <a class="navbtn nav-quiet" href="/profile.html">${esc(ME.name || 'Profile')}</a>
       <a href="/logout">Log out</a>`
    : `<a class="navbtn nav-discover" href="/index.html">Discover</a>
       <span class="spacer"></span>
       <a class="navbtn nav-quiet" href="/auth.html">Sign in</a>`;

  document.body.insertAdjacentHTML('afterbegin',
    `<nav><a class="brand" href="/">ProjectMatch</a>${links}</nav>`);
  return ME;
}

/* --- score helpers ------------------------------------------------------- */
const scoreClass = n => n >= 75 ? 'high' : n >= 45 ? '' : 'low';

function breakdownHtml(b, id) {
  if (!b) return '';
  const rows = Object.entries(b).map(([k, v]) => `
    <div class="bar-row">
      <span>${esc(k)}</span>
      <div class="bar"><span style="width:${v}%"></span></div>
      <span>${v}%</span>
    </div>`).join('');
  return `<button class="linkish" onclick="toggleBreakdown('${id}')">why this score?</button>
          <div class="breakdown" id="${id}">${rows}</div>`;
}

function toggleBreakdown(id) {
  const box = document.getElementById(id);
  if (!box) return;
  const open = box.classList.toggle('open');
  const chip = document.getElementById('sc-' + id);
  if (chip) {
    chip.classList.toggle('lit', open);
    chip.setAttribute('aria-expanded', open);
  }
}

/* --- coverage meter -------------------------------------------------------
   One segment per skill the slot asked for: solid where this person covers
   it, hollow where they don't. Reading the gap should not require reading
   a sentence. */
function coverageMeter(c) {
  const covered = c.covered || [], missing = c.missing || [];
  const total = covered.length + missing.length;
  if (!total) return '';
  const segs = [
    ...covered.map(s => `<span class="seg on" title="${esc(s)}"></span>`),
    ...missing.map(s => `<span class="seg off" title="missing: ${esc(s)}"></span>`)
  ].join('');
  return `
    <div class="meter" role="img"
         aria-label="covers ${covered.length} of ${total} skills this role asked for">
      <span class="segs">${segs}</span>
      <span class="meter-label">${covered.length}/${total} covered</span>
    </div>`;
}

/* --- candidate card (owner's ranked view) --------------------------------
   ctx = { postId, slotId } enables the invite button. Omit it and the card
   renders read-only, which is what you want anywhere that isn't the
   owner's own post. */
const CONTACT_LABELS = {
  'invited:pending':  'Invited — waiting on them',
  'invited:accepted': 'Invited · joined the team',
  'invited:declined': 'Invited · they declined',
  'applied:pending':  'They applied — see Applications',
  'applied:accepted': 'On the team',
  'applied:rejected': 'You passed on this one'
};

function inviteControl(c, ctx) {
  if (!ctx) return '';
  if (c.contact_state)
    return `<div class="meta"><strong>${esc(CONTACT_LABELS[c.contact_state] || c.contact_state)}</strong></div>`;
  return `
    <form method="POST" action="/invite" class="invite-form">
      <input type="hidden" name="post_id" value="${ctx.postId}">
      <input type="hidden" name="slot_id" value="${ctx.slotId}">
      <input type="hidden" name="user_id" value="${c.user_id}">
      <input type="text" name="note" maxlength="500"
        placeholder="Add a short message (optional)">
      <button>Send invite</button>
    </form>`;
}

function candidateCard(c, i, ctx) {
  const bid = `bd-${c.user_id}-${i}`;
  return `
  <div class="card">
    <div class="card-head">
      <div class="grow">
        <h3><a href="/user.html?id=${c.user_id}">${esc(c.name)}</a></h3>
        <div class="meta">${esc(c.role || '')} · ${esc(c.experience_level || '')} · ${esc(c.location || '')}</div>
        <p class="reason">${esc(c.reason)}</p>
      </div>
      <button type="button" class="score ${scoreClass(c.score)}" id="sc-${bid}"
        aria-expanded="false" aria-controls="${bid}"
        onclick="toggleBreakdown('${bid}')">${c.score}%</button>
    </div>
    ${coverageMeter(c)}
    <div class="tags">
      ${(c.covered || []).map(s => `<span class="tag must">${esc(s)}</span>`).join('')}
      ${(c.missing || []).map(s => `<span class="tag miss">${esc(s)}</span>`).join('')}
    </div>
    <div class="meta" style="margin-top:10px">
      ${c.github ? `<a href="${esc(c.github)}" target="_blank" rel="noopener">GitHub</a>` : ''}
      ${c.linkedin ? ` · <a href="${esc(c.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
    </div>
    ${c.best_project ? `<div class="meta" style="margin-top:8px">
      Closest past project: <strong>${esc(c.best_project.title)}</strong>
      ${c.best_project.outcome ? ` · ${esc(c.best_project.outcome)}` : ''}${c.best_project.duration ? ` · ${esc(c.best_project.duration)}` : ''}
      ${c.best_project.link ? ` · <a href="${esc(c.best_project.link)}" target="_blank" rel="noopener">see it</a>` : ''}
      ${(c.best_project.skills || []).length ? '<br>' + esc((c.best_project.skills || []).slice(0,4).join(', ')) : ''}
    </div>` : ''}
    ${breakdownHtml(c.breakdown, bid)}
    ${inviteControl(c, ctx)}
  </div>`;
}

/* --- post card (candidate's ranked feed / browse) ------------------------ */
function ownerLine(o) {
  if (!o) return '';
  const bits = [o.role, o.experience_level, o.location].filter(Boolean);
  return `
    <div class="poster">
      <span class="avatar" aria-hidden="true">${esc((o.name || '?').trim()[0] || '?')}</span>
      <div class="grow">
        <a href="/user.html?id=${o.id}">${esc(o.name)}</a>
        ${bits.length ? `<div class="meta">${esc(bits.join(' · '))}</div>` : ''}
      </div>
    </div>`;
}

function postCard(p) {
  const score = p.my_score ?? p.score;
  const reason = p.my_reason ?? p.reason;
  const id = p.post_id ?? p.id;
  const openRoles = (p.slots || []).filter(s => !s.filled_by).map(s => s.role);
  return `
  <div class="card">
    <div class="card-head">
      <div class="grow">
        <h3><a href="/post.html?id=${id}">${esc(p.title)}</a></h3>
        <div class="meta">
          ${esc(p.event_type || '')}
          ${p.starts_on ? ' · ' + esc(p.starts_on) : ''}
          ${p.location ? ' · ' + esc(p.location) : ''}
          ${p.remote_ok ? ' · remote ok' : ''}
        </div>
        ${reason ? `<p class="reason">${esc(reason)}</p>` : ''}
        <div class="tags">
          ${(p.role ? [p.role] : openRoles).map(r => `<span class="tag must">${esc(r)}</span>`).join('')}
          ${(p.domains || []).map(d => `<span class="tag">${esc(d)}</span>`).join('')}
        </div>
      </div>
      ${score != null ? `<span class="score ${scoreClass(score)}">${score}%</span>` : ''}
    </div>
    ${ownerLine(p.owner)}
  </div>`;
}

/* --- tag picker (used by profile + create) ------------------------------- */
function picker(name, options, selected = []) {
  const sel = new Set(selected);
  return `<div class="picker">${options.map(o => `
    <label><input type="checkbox" name="${esc(name)}" value="${esc(o)}"
      ${sel.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
}
