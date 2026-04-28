# philosophy.luciana.digital

A weekly-updating philosophy-forward signal garden for Luciana.

## Concept

This site treats interesting thinkers as **living lexicon entries** instead of a standard blog roll.
Each weekly refresh pulls the latest public writing from selected authors and renders them as:

- floating philosophy terms
- thread-like thought cards
- a watchlist of interesting souls worth following

Primary design goal: **philosophical atmosphere without academic deadness**.

## Structure

```text
site/
  index.html
  styles.css
  app.js
  CNAME
  data/
    site-metadata.json
    authors.json
    lexicon.json
    threads.json
scripts/
  update_weekly_threads.py
.github/workflows/
  weekly-curation.yml
  deploy-pages.yml
```

## Local preview

```bash
cd /Users/lucianama/philosophy-luciana-digital
python3 -m http.server 8787 -d site
```

Then open `http://localhost:8787`.

## Weekly refresh

```bash
python3 scripts/update_weekly_threads.py
```

The updater fetches the most recent public RSS items for authors with feeds, infers lexicon tags, refreshes `site/data/threads.json`, and updates `site/data/site-metadata.json`.

## Notes

- `site/CNAME` is set to `philosophy.luciana.digital`.
- Two authors are tracked as **watchlist-only** profiles for now because their highest-signal public surfaces are not easy RSS targets.
- GitHub Pages deployment is wired via Actions; DNS still needs to point the custom domain at GitHub Pages if not already configured.
