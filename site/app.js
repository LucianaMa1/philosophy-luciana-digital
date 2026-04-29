const state = {
  activeAuthor: 'all',
  activeTerm: 'all',
  threads: [],
  authors: [],
  lexicon: [],
  metadata: null,
};

const els = {
  lastUpdated: document.querySelector('#last-updated'),
  siteDescription: document.querySelector('#site-description'),
  heroStats: document.querySelector('#hero-stats'),
  miniMetrics: document.querySelector('#mini-metrics'),
  authorPills: document.querySelector('#author-pills'),
  lexiconScene: document.querySelector('#lexicon-scene'),
  lexiconCloud: document.querySelector('#lexicon-cloud'),
  filters: document.querySelector('#filters'),
  threadsGrid: document.querySelector('#threads-grid'),
  watchlist: document.querySelector('#watchlist'),
  dialog: document.querySelector('#thread-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  threadTemplate: document.querySelector('#thread-template'),
  depthField: document.querySelector('#depth-field'),
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ── DEPTH FIELD ──────────────────────────────────────────────────────────────
// Generates giant ghost text at various Z depths behind the whole page.
// The parent .depth-field has perspective: 1400px, so translateZ creates
// real perspective foreshortening — far words shrink naturally.

function initDepthField() {
  if (!els.depthField) return;

  const words = [
    // "close" words — small font, high Z → appear near-sized
    { term: 'meaning',      x:  4,  y: 12,  z: -120, size: '7vw',  rot: -3, color: 'var(--rose)',   opacity: 0.042, dur: 24, delay: 0   },
    { term: 'agency',       x: 60,  y:  5,  z: -160, size: '6vw',  rot:  4, color: 'var(--amber)',  opacity: 0.048, dur: 20, delay: 3.2 },
    // "mid" words
    { term: 'judgment',     x:  6,  y: 54,  z: -420, size: '15vw', rot: -2, color: 'var(--violet)', opacity: 0.032, dur: 27, delay: 1.5 },
    { term: 'care',         x: 54,  y: 60,  z: -360, size: '13vw', rot:  5, color: 'var(--teal)',   opacity: 0.036, dur: 22, delay: 5.1 },
    { term: 'honesty',      x: 24,  y: 74,  z: -310, size: '11vw', rot: -4, color: 'var(--violet)', opacity: 0.04,  dur: 29, delay: 2.0 },
    // "far" words — large font, deep Z → perspective shrinks them to mid-size
    { term: 'leverage',     x: 40,  y: 22,  z: -720, size: '24vw', rot:  2, color: 'var(--amber)',  opacity: 0.022, dur: 33, delay: 4.0 },
    { term: 'coordination', x: 68,  y: 44,  z: -620, size: '19vw', rot: -1, color: 'var(--teal)',   opacity: 0.026, dur: 31, delay: 7.3 },
    { term: 'incentives',   x: 12,  y: 30,  z: -840, size: '28vw', rot:  3, color: 'var(--rose)',   opacity: 0.018, dur: 36, delay: 6.0 },
    { term: 'institutions', x: 58,  y: 78,  z: -530, size: '17vw', rot: -5, color: 'var(--amber)',  opacity: 0.03,  dur: 28, delay: 9.1 },
  ];

  els.depthField.innerHTML = words.map((w) => `
    <div
      class="depth-word"
      style="
        left: ${w.x}%;
        top:  ${w.y}%;
        font-size: ${w.size};
        color: ${w.color};
        opacity: ${w.opacity};
        --z: ${w.z}px;
        --rot: ${w.rot}deg;
        --dur: ${w.dur}s;
        --delay: ${w.delay}s;
      "
      aria-hidden="true"
    >${w.term}</div>
  `).join('');
}

// ── LEXICON MOUSE PARALLAX ───────────────────────────────────────────────────
// Tracks mouse position and shifts each lexicon term by an amount proportional
// to its --depth value. Closer terms (depth > 0) shift more; far terms less.
// This fakes Z-parallax without needing CSS preserve-3d (which breaks overflow).

function initLexiconParallax() {
  if (!els.lexiconCloud) return;

  let mx = 0, my = 0;   // normalized -1..1
  let cx = 0, cy = 0;   // smoothed current values
  let rafId;

  document.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function tick() {
    cx += (mx - cx) * 0.055;
    cy += (my - cy) * 0.055;

    els.lexiconCloud.querySelectorAll('.lex-term').forEach((term) => {
      const depth  = parseFloat(term.dataset.depth) || 0;   // -1..1
      const ox = cx * depth * 14;
      const oy = cy * depth *  9;
      term.style.setProperty('--px', `${ox}px`);
    });

    rafId = requestAnimationFrame(tick);
  }
  tick();
}

// ── CARD 3D TILT ─────────────────────────────────────────────────────────────
// Applies per-card perspective tilt on mousemove, reset on mouseleave.

function addCardTilt(card) {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
    const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
    const rx = dy * -5;
    const ry = dx *  5;
    card.style.transform  = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
    card.style.boxShadow  = `${-ry * 3}px ${rx * 2}px 50px rgba(0,0,0,0.55), 0 40px 80px rgba(0,0,0,0.4)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '';
  });
}

// ── RENDER HERO ──────────────────────────────────────────────────────────────

function renderHero() {
  const { metadata, authors, threads } = state;
  els.lastUpdated.textContent = `updated ${formatDate(metadata.last_updated)}`;
  els.siteDescription.textContent = metadata.description;

  const stats = [
    { label: 'live threads',   value: threads.length },
    { label: 'tracked minds',  value: authors.length },
    { label: 'update rhythm',  value: metadata.update_rhythm },
  ];

  els.heroStats.innerHTML = stats.map((s) => `
    <div class="stat-chip">
      <strong>${s.label}</strong>
      <span>${s.value}</span>
    </div>
  `).join('');

  const metrics = [
    `Feeds: ${metadata.feed_backed_authors}`,
    `Watchlist-only: ${metadata.watchlist_only_authors}`,
    `Domain: ${metadata.domain}`,
  ];

  els.miniMetrics.innerHTML = metrics.map((t) => `<div class="metric-chip">${t}</div>`).join('');
  els.authorPills.innerHTML = authors.map((a) => `<div class="pill">${a.name}</div>`).join('');
}

// ── RENDER LEXICON ───────────────────────────────────────────────────────────
// Each term gets a depth tier that drives:
//   --scale   visual size (closer = bigger)
//   --blur    focus (closer = sharper)
//   --opacity brightness (closer = brighter)
//   data-depth parallax factor fed to initLexiconParallax (-1..1)

function renderLexicon() {
  const counts = Object.fromEntries(
    state.lexicon.map((e) => [
      e.term,
      state.threads.filter((t) => t.lexicon.includes(e.term)).length,
    ]),
  );

  // Depth tiers: index 0 = furthest, 4 = closest
  const depths = [
    { scale: 0.88, blur: 1.8, opacity: 0.60, parallax: -0.9 },
    { scale: 0.93, blur: 0.9, opacity: 0.73, parallax: -0.5 },
    { scale: 1.00, blur: 0,   opacity: 0.88, parallax:  0   },
    { scale: 1.06, blur: 0,   opacity: 0.96, parallax:  0.6 },
    { scale: 1.12, blur: 0,   opacity: 1.00, parallax:  1.0 },
  ];

  const assignments = [2, 4, 1, 3, 0, 3, 1, 4, 2]; // one per lexicon entry

  els.lexiconCloud.innerHTML = state.lexicon.map((term, i) => {
    const d = depths[assignments[i % assignments.length]];
    return `
      <button
        class="lex-term ${state.activeTerm === term.term ? 'active' : ''}"
        data-tone="${term.tone}"
        data-term="${term.term}"
        data-depth="${d.parallax}"
        style="
          left: ${term.left}%;
          top:  ${term.top}%;
          --duration: ${term.duration}s;
          --delay: ${term.delay}s;
          --scale: ${d.scale};
          --blur: ${d.blur}px;
          --opacity: ${d.opacity};
          --px: 0px;
        "
        title="${term.definition}"
      >
        <span>${term.term}</span>
        <strong>${counts[term.term] ?? 0}</strong>
      </button>
    `;
  }).join('');

  els.lexiconCloud.querySelectorAll('[data-term]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTerm = state.activeTerm === btn.dataset.term ? 'all' : btn.dataset.term;
      renderLexicon();
      renderThreads();
    });
  });
}

// ── RENDER FILTERS ───────────────────────────────────────────────────────────

function renderFilters() {
  const buttons = [
    { id: 'all', label: 'All minds' },
    ...state.authors
      .filter((a) => a.mode === 'feed')
      .map((a) => ({ id: slugify(a.name), label: a.name })),
  ];

  els.filters.innerHTML = buttons.map((b) => `
    <button class="filter-chip ${b.id === state.activeAuthor ? 'active' : ''}" data-filter="${b.id}">
      ${b.label}
    </button>
  `).join('');

  els.filters.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeAuthor = btn.dataset.filter;
      renderFilters();
      renderThreads();
    });
  });
}

// ── RENDER THREADS ───────────────────────────────────────────────────────────

function threadMatchesFilter(thread) {
  const authorMatch = state.activeAuthor === 'all' || slugify(thread.author) === state.activeAuthor;
  const termMatch   = state.activeTerm   === 'all' || thread.lexicon.includes(state.activeTerm);
  return authorMatch && termMatch;
}

function renderThreads() {
  const visible = state.threads.filter(threadMatchesFilter);

  if (!visible.length) {
    els.threadsGrid.innerHTML = '<div class="empty-state">No threads match this filter yet.</div>';
    return;
  }

  els.threadsGrid.innerHTML = '';

  visible.forEach((thread, idx) => {
    const node = els.threadTemplate.content.firstElementChild.cloneNode(true);

    node.querySelector('.thread-author').textContent  = thread.author;
    node.querySelector('.thread-date').textContent    = formatDate(thread.published_at);
    node.querySelector('.thread-title').textContent   = thread.title;
    node.querySelector('.thread-excerpt').textContent = thread.excerpt;
    node.querySelector('.signal-badge').textContent   = thread.signal_status;
    node.querySelector('.tag-row').innerHTML = thread.lexicon
      .map((t) => `<span class="term-chip">${t}</span>`).join('');

    // Stagger the card-appear animation
    node.style.setProperty('--stagger', `${idx * 0.06}s`);

    node.querySelector('.ghost-button').addEventListener('click', () => openDialog(thread));
    node.addEventListener('click', (e) => { if (!e.target.closest('button')) openDialog(thread); });

    addCardTilt(node);
    els.threadsGrid.appendChild(node);
  });
}

// ── RENDER WATCHLIST ─────────────────────────────────────────────────────────

function renderWatchlist() {
  els.watchlist.innerHTML = state.authors.map((a) => `
    <article class="watch-card">
      <h4>${a.name}</h4>
      <p>${a.role}</p>
      <p>${a.reason_to_watch}</p>
    </article>
  `).join('');
}

// ── DIALOG ───────────────────────────────────────────────────────────────────

function openDialog(thread) {
  els.dialogContent.innerHTML = `
    <div class="dialog-grid">
      <div>
        <p class="section-kicker">${thread.author}</p>
        <h3>${thread.title}</h3>
        <p class="thread-copy">${thread.excerpt}</p>
      </div>
      <div class="dialog-meta">
        <div class="meta-card">
          <div class="meta-label">published</div>
          <strong>${formatDate(thread.published_at)}</strong>
        </div>
        <div class="meta-card">
          <div class="meta-label">source</div>
          <strong>${thread.source_label}</strong>
        </div>
        <div class="meta-card">
          <div class="meta-label">signal</div>
          <strong>${thread.signal_status}</strong>
        </div>
      </div>
      <div>
        <p class="section-kicker">thread fragments</p>
        <div class="tag-row">${thread.lexicon.map((t) => `<span class="term-chip">${t}</span>`).join('')}</div>
        <ul class="rules">
          ${thread.thread.map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </div>
      <div class="dialog-links">
        <a href="${thread.url}" target="_blank" rel="noreferrer">Read source</a>
        <a href="${thread.author_url}" target="_blank" rel="noreferrer">Author home</a>
      </div>
    </div>
  `;
  els.dialog.showModal();
}

els.dialog.addEventListener('click', (e) => {
  if (!e.target.closest('.dialog-card')) els.dialog.close();
});

document.querySelector('.close-button').addEventListener('click', () => els.dialog.close());

// ── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  const [metadata, authors, lexicon, threads] = await Promise.all([
    fetch('./data/site-metadata.json').then((r) => r.json()),
    fetch('./data/authors.json').then((r) => r.json()),
    fetch('./data/lexicon.json').then((r) => r.json()),
    fetch('./data/threads.json').then((r) => r.json()),
  ]);

  state.metadata = metadata;
  state.authors  = authors;
  state.lexicon  = lexicon;
  state.threads  = threads.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  renderHero();
  renderLexicon();
  renderFilters();
  renderThreads();
  renderWatchlist();

  // 3D effects — init after DOM is populated
  initDepthField();
  initLexiconParallax();
}

init().catch((err) => {
  console.error(err);
  els.threadsGrid.innerHTML = '<div class="empty-state">The signal garden failed to load.</div>';
});
