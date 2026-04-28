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
  lexiconCloud: document.querySelector('#lexicon-cloud'),
  filters: document.querySelector('#filters'),
  threadsGrid: document.querySelector('#threads-grid'),
  watchlist: document.querySelector('#watchlist'),
  dialog: document.querySelector('#thread-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  threadTemplate: document.querySelector('#thread-template'),
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function renderHero() {
  const { metadata, authors, threads } = state;
  els.lastUpdated.textContent = `updated ${formatDate(metadata.last_updated)}`;
  els.siteDescription.textContent = metadata.description;

  const stats = [
    { label: 'live threads', value: threads.length },
    { label: 'tracked minds', value: authors.length },
    { label: 'update rhythm', value: metadata.update_rhythm },
  ];

  els.heroStats.innerHTML = stats.map((stat) => `
    <div class="stat-chip">
      <strong>${stat.label}</strong>
      <span>${stat.value}</span>
    </div>
  `).join('');

  const metrics = [
    `Feeds: ${metadata.feed_backed_authors}`,
    `Watchlist-only: ${metadata.watchlist_only_authors}`,
    `Custom domain: ${metadata.domain}`,
  ];

  els.miniMetrics.innerHTML = metrics.map((text) => `<div class="metric-chip">${text}</div>`).join('');
  els.authorPills.innerHTML = authors.map((author) => `<div class="pill">${author.name}</div>`).join('');
}

function renderLexicon() {
  const counts = Object.fromEntries(
    state.lexicon.map((entry) => [
      entry.term,
      state.threads.filter((thread) => thread.lexicon.includes(entry.term)).length,
    ]),
  );

  els.lexiconCloud.innerHTML = state.lexicon.map((term) => `
    <button
      class="lex-term ${state.activeTerm === term.term ? 'active' : ''}"
      data-tone="${term.tone}"
      data-term="${term.term}"
      style="left:${term.left}%; top:${term.top}%; --duration:${term.duration}s; --delay:${term.delay}s;"
      title="${term.definition}"
    >
      <span>${term.term}</span>
      <strong>${counts[term.term] ?? 0}</strong>
    </button>
  `).join('');

  els.lexiconCloud.querySelectorAll('[data-term]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeTerm = state.activeTerm === button.dataset.term ? 'all' : button.dataset.term;
      renderLexicon();
      renderThreads();
    });
  });
}

function renderFilters() {
  const buttons = [
    { id: 'all', label: 'All minds' },
    ...state.authors.filter((author) => author.mode === 'feed').map((author) => ({
      id: slugify(author.name),
      label: author.name,
    })),
  ];

  els.filters.innerHTML = buttons.map((button) => `
    <button class="filter-chip ${button.id === state.activeAuthor ? 'active' : ''}" data-filter="${button.id}">
      ${button.label}
    </button>
  `).join('');

  els.filters.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeAuthor = button.dataset.filter;
      renderFilters();
      renderThreads();
    });
  });
}

function threadMatchesFilter(thread) {
  const authorMatch = state.activeAuthor === 'all' || slugify(thread.author) === state.activeAuthor;
  const termMatch = state.activeTerm === 'all' || thread.lexicon.includes(state.activeTerm);
  return authorMatch && termMatch;
}

function renderThreads() {
  const visibleThreads = state.threads.filter(threadMatchesFilter);
  if (!visibleThreads.length) {
    els.threadsGrid.innerHTML = '<div class="empty-state">No threads match this filter yet.</div>';
    return;
  }

  els.threadsGrid.innerHTML = '';
  visibleThreads.forEach((thread) => {
    const node = els.threadTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.thread-author').textContent = thread.author;
    node.querySelector('.thread-date').textContent = formatDate(thread.published_at);
    node.querySelector('.thread-title').textContent = thread.title;
    node.querySelector('.thread-excerpt').textContent = thread.excerpt;
    node.querySelector('.signal-badge').textContent = thread.signal_status;
    node.querySelector('.tag-row').innerHTML = thread.lexicon.map((term) => `<span class="term-chip">${term}</span>`).join('');
    node.querySelector('.ghost-button').addEventListener('click', () => openDialog(thread));
    node.addEventListener('click', (event) => {
      if (!event.target.closest('button')) openDialog(thread);
    });
    els.threadsGrid.appendChild(node);
  });
}

function renderWatchlist() {
  els.watchlist.innerHTML = state.authors.map((author) => `
    <article class="watch-card">
      <h4>${author.name}</h4>
      <p>${author.role}</p>
      <p>${author.reason_to_watch}</p>
    </article>
  `).join('');
}

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
        <div class="tag-row">${thread.lexicon.map((term) => `<span class="term-chip">${term}</span>`).join('')}</div>
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

els.dialog.addEventListener('click', (event) => {
  const card = event.target.closest('.dialog-card');
  if (!card) els.dialog.close();
});

document.querySelector('.close-button').addEventListener('click', () => els.dialog.close());

async function init() {
  const [metadata, authors, lexicon, threads] = await Promise.all([
    fetch('./data/site-metadata.json').then((res) => res.json()),
    fetch('./data/authors.json').then((res) => res.json()),
    fetch('./data/lexicon.json').then((res) => res.json()),
    fetch('./data/threads.json').then((res) => res.json()),
  ]);

  state.metadata = metadata;
  state.authors = authors;
  state.lexicon = lexicon;
  state.threads = threads.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  renderHero();
  renderLexicon();
  renderFilters();
  renderThreads();
  renderWatchlist();
}

init().catch((error) => {
  console.error(error);
  els.threadsGrid.innerHTML = '<div class="empty-state">The signal garden failed to load.</div>';
});
