const state = {
  activeAuthor: 'all',
  activeTerm:   'all',
  threads:  [],
  authors:  [],
  lexicon:  [],
  metadata: null,
};

const els = {
  lastUpdated:  document.querySelector('#last-updated'),
  heroStats:    document.querySelector('#hero-stats'),
  lexiconCloud: document.querySelector('#lexicon-cloud'),
  filters:      document.querySelector('#filters'),
  threadsGrid:  document.querySelector('#threads-grid'),
  watchlist:    document.querySelector('#watchlist'),
  dialog:       document.querySelector('#thread-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  depthField:   document.querySelector('#depth-field'),
};

const formatDate = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ── DEPTH FIELD ──────────────────────────────────────────────────────────────
// Ghost words at different Z depths in a CSS perspective container.
// Pure white at very low opacity — texture, not decoration.

function initDepthField() {
  if (!els.depthField) return;

  const words = [
    { term: 'meaning',      x:  4,  y: 12,  z: -120, size: '7vw',  rot: -3, opacity: 0.028, dur: 24, delay: 0   },
    { term: 'agency',       x: 60,  y:  5,  z: -160, size: '6vw',  rot:  4, opacity: 0.032, dur: 20, delay: 3.2 },
    { term: 'judgment',     x:  6,  y: 54,  z: -420, size: '15vw', rot: -2, opacity: 0.022, dur: 27, delay: 1.5 },
    { term: 'care',         x: 54,  y: 60,  z: -360, size: '13vw', rot:  5, opacity: 0.024, dur: 22, delay: 5.1 },
    { term: 'honesty',      x: 24,  y: 74,  z: -310, size: '11vw', rot: -4, opacity: 0.026, dur: 29, delay: 2.0 },
    { term: 'leverage',     x: 40,  y: 22,  z: -720, size: '24vw', rot:  2, opacity: 0.014, dur: 33, delay: 4.0 },
    { term: 'coordination', x: 68,  y: 44,  z: -620, size: '19vw', rot: -1, opacity: 0.017, dur: 31, delay: 7.3 },
    { term: 'incentives',   x: 12,  y: 30,  z: -840, size: '28vw', rot:  3, opacity: 0.011, dur: 36, delay: 6.0 },
    { term: 'institutions', x: 58,  y: 78,  z: -530, size: '17vw', rot: -5, opacity: 0.02,  dur: 28, delay: 9.1 },
  ];

  els.depthField.innerHTML = words.map((w) => `
    <div
      class="depth-word"
      style="
        left: ${w.x}%;
        top:  ${w.y}%;
        font-size: ${w.size};
        opacity: ${w.opacity};
        --z: ${w.z}px;
        --rot: ${w.rot}deg;
        --dur: ${w.dur}s;
        --delay: ${w.delay}s;
      "
    >${w.term}</div>
  `).join('');
}

// ── RENDER HERO ──────────────────────────────────────────────────────────────

function renderHero() {
  const { metadata, authors, threads } = state;
  els.lastUpdated.textContent = `updated ${formatDate(metadata.last_updated)}`;

  const stats = [
    { label: 'live threads',  value: threads.length },
    { label: 'tracked minds', value: authors.length },
    { label: 'update rhythm', value: metadata.update_rhythm },
  ];

  els.heroStats.innerHTML = stats.map((s) => `
    <div class="stat-chip">
      <strong>${s.label}</strong>
      <span>${s.value}</span>
    </div>
  `).join('');
}

// ── RENDER LEXICON ───────────────────────────────────────────────────────────
// Words rendered at font sizes proportional to their thread frequency.
// Largest word = most threads. Creates a natural typographic hierarchy.

function renderLexicon() {
  const counts = Object.fromEntries(
    state.lexicon.map((e) => [
      e.term,
      state.threads.filter((t) => t.lexicon.includes(e.term)).length,
    ]),
  );

  const maxCount = Math.max(...Object.values(counts), 1);
  const minSize  = 1.8;   // rem
  const maxSize  = 6.0;   // rem

  els.lexiconCloud.innerHTML = state.lexicon.map((term) => {
    const count  = counts[term.term] ?? 0;
    const size   = (minSize + (count / maxCount) * (maxSize - minSize)).toFixed(2);
    const active = state.activeTerm === term.term;

    return `
      <button
        class="lex-word${active ? ' active' : ''}"
        data-term="${term.term}"
        style="font-size: ${size}rem"
        title="${term.definition}"
      >${term.term}<sup class="lex-count">${count}</sup></button>
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
    <button class="filter-chip${b.id === state.activeAuthor ? ' active' : ''}" data-filter="${b.id}">
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
// Editorial table layout: author column | content | date+signal
// Each row inverts to white-on-black on hover.

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

  els.threadsGrid.innerHTML = visible.map((thread, idx) => `
    <article
      class="thread-row"
      style="--stagger: ${(idx * 0.05).toFixed(2)}s"
      data-idx="${idx}"
    >
      <div class="tr-author">${thread.author}</div>

      <div class="tr-body">
        <h3 class="tr-title">${thread.title}</h3>
        <p class="tr-excerpt">${thread.excerpt}</p>
        <div class="tr-tags">
          ${thread.lexicon.map((t) => `<span class="term-chip">${t}</span>`).join('')}
        </div>
      </div>

      <div class="tr-meta">
        <span class="tr-date">${formatDate(thread.published_at)}</span>
        <span class="tr-signal">${thread.signal_status}</span>
      </div>
    </article>
  `).join('');

  // Bind click to open dialog
  els.threadsGrid.querySelectorAll('.thread-row').forEach((row) => {
    const thread = visible[parseInt(row.dataset.idx, 10)];
    row.addEventListener('click', () => openDialog(thread));
  });
}

// ── RENDER WATCHLIST ─────────────────────────────────────────────────────────

function renderWatchlist() {
  els.watchlist.innerHTML = state.authors.map((a) => `
    <article class="soul-card">
      <div class="soul-name">${a.name}</div>
      <p class="soul-role">${a.role}</p>
      <p class="soul-reason">${a.reason_to_watch}</p>
    </article>
  `).join('');
}

// ── DIALOG ───────────────────────────────────────────────────────────────────

function openDialog(thread) {
  els.dialogContent.innerHTML = `
    <div style="display:grid; gap:24px;">
      <div>
        <p class="dialog-kicker">${thread.author} · ${thread.source_label}</p>
        <h2 class="dialog-title">${thread.title}</h2>
        <p class="dialog-excerpt">${thread.excerpt}</p>
      </div>

      <div class="dialog-meta">
        <div class="meta-cell">
          <div class="meta-label">published</div>
          <div class="meta-value">${formatDate(thread.published_at)}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-label">signal</div>
          <div class="meta-value">${thread.signal_status}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-label">source</div>
          <div class="meta-value">${thread.source_label}</div>
        </div>
      </div>

      <div>
        <p class="frag-label">Thread fragments</p>
        <ul class="thread-frags">
          ${thread.thread.map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </div>

      <div class="dialog-tags">
        ${thread.lexicon.map((t) => `<span class="term-chip">${t}</span>`).join('')}
      </div>

      <div class="dialog-links">
        <a href="${thread.url}" class="dialog-link" target="_blank" rel="noreferrer">
          Read source ↗
        </a>
        <a href="${thread.author_url}" class="dialog-link" target="_blank" rel="noreferrer">
          Author home ↗
        </a>
      </div>
    </div>
  `;
  els.dialog.showModal();
}

els.dialog.addEventListener('click', (e) => {
  if (!e.target.closest('.dialog-inner')) els.dialog.close();
});

document.querySelector('.close-btn').addEventListener('click', () => els.dialog.close());

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
  initDepthField();
}

init().catch((err) => {
  console.error(err);
  els.threadsGrid.innerHTML = '<div class="empty-state">The signal garden failed to load.</div>';
});
