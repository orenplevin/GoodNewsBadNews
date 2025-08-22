# News Sentiment Dashboard — MVP (Free Stack, English, Public)

This is a complete, free-to-run starter you can deploy **publicly** on GitHub Pages. It:

* Fetches headlines from multiple English-language RSS feeds (no API keys).
* Classifies sentiment with **VADER** (free, great for short texts).
* Buckets by **publication** and **topic** (simple keyword rules).
* Saves rolling **7 days** of headlines and builds a **public dashboard** (HTML + Chart.js) showing:

  * Overall positive / neutral / negative
  * By publication
  * By topic
  * Trend over the last 7 days

You can fork this and later embed the public dashboard in your own site.

---

## Quick Start (no servers, no paid services)

1. **Create a new GitHub repo** (empty, public).
2. Add these files with the exact paths shown below.
3. Commit & push to `main`.
4. In GitHub → **Settings → Pages**: set **Source** = *Deploy from a branch*, **Branch** = `main`, **Folder** = `/docs`. Save.
5. The dashboard will be live at: `https://<your-user>.github.io/<repo>/` after the first successful push.
6. GitHub Actions will run **every 30 minutes**, fetch fresh headlines, score sentiment, and update the dashboard.

> Tip: You can run locally first with `python fetcher.py` to generate the data files, then open `docs/index.html` in your browser.

---

## File: `requirements.txt`

```txt
feedparser==6.0.11
nltk==3.9.1
python-dateutil==2.9.0.post0
```

---

## File: `fetcher.py`

```python
import os
import json
import time
import hashlib
from datetime import datetime, timedelta, timezone

import feedparser
from dateutil import parser as dateparser

# NLTK VADER setup
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer

# Ensure VADER lexicon is present
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon')

sia = SentimentIntensityAnalyzer()

# --- Configuration ---
ROLLING_DAYS = 7
OUTPUT_DIR = os.path.join('docs', 'data')
RAW_PATH = os.path.join('data', 'raw.jsonl')
LATEST_PATH = os.path.join(OUTPUT_DIR, 'latest.json')
HISTORY_PATH = os.path.join(OUTPUT_DIR, 'history.json')

# RSS feeds (English)
FEEDS = [
    {"name": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"name": "Reuters", "url": "https://feeds.reuters.com/reuters/topNews"},
    {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss"},
    {"name": "CNN", "url": "http://rss.cnn.com/rss/edition.rss"},
    {"name": "AP News", "url": "https://feeds.apnews.com/apf-topnews"},
    {"name": "Al Jazeera English", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"name": "CNBC", "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html"},
    {"name": "Financial Times", "url": "https://www.ft.com/?format=rss"},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml"},
    {"name": "TechCrunch", "url": "http://feeds.feedburner.com/TechCrunch/"},
    {"name": "ESPN", "url": "https://www.espn.com/espn/rss/news"},
]

TOPIC_KEYWORDS = {
    'Politics': ['election', 'president', 'parliament', 'congress', 'minister', 'policy', 'politic'],
    'Business': ['market', 'stocks', 'earnings', 'profit', 'merger', 'economy', 'inflation', 'startup'],
    'Tech': ['ai', 'artificial intelligence', 'iphone', 'android', 'microsoft', 'google', 'apple', 'meta', 'openai', 'software', 'chip', 'semiconductor'],
    'Sports': ['match', 'game', 'tournament', 'league', 'world cup', 'olympic', 'goal', 'coach'],
    'Health': ['covid', 'cancer', 'vaccine', 'health', 'disease', 'nhs', 'virus', 'medical'],
    'Science': ['research', 'study', 'space', 'nasa', 'astronomy', 'physics', 'biology'],
    'Entertainment': ['movie', 'film', 'celebrity', 'music', 'box office', 'tv', 'netflix'],
    'World': ['ukraine', 'gaza', 'israel', 'middle east', 'eu', 'china', 'russia', 'africa', 'asia', 'europe', 'america'],
}

DEFAULT_TOPIC = 'Other'


def classify_sentiment(text: str) -> dict:
    scores = sia.polarity_scores(text or '')
    compound = scores.get('compound', 0.0)
    if compound >= 0.05:
        label = 'positive'
    elif compound <= -0.05:
        label = 'negative'
    else:
        label = 'neutral'
    return {"label": label, "compound": compound}


def classify_topic(title: str) -> str:
    t = (title or '').lower()
    for topic, words in TOPIC_KEYWORDS.items():
        if any(w in t for w in words):
            return topic
    return DEFAULT_TOPIC


def parse_time(entry):
    # Try multiple time fields; fall back to now()
    for key in ('published', 'updated', 'created'):
        val = entry.get(key)
        if val:
            try:
                dt = dateparser.parse(val)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except Exception:
                pass
    # Feedparser sometimes gives struct_time at .published_parsed
    for key in ('published_parsed', 'updated_parsed'):
        val = entry.get(key)
        if val:
            try:
                dt = datetime.fromtimestamp(time.mktime(val), tz=timezone.utc)
                return dt
            except Exception:
                pass
    return datetime.now(timezone.utc)


def make_id(source: str, title: str, url: str) -> str:
    # Stable id to de-duplicate
    h = hashlib.sha1()
    h.update((source or '').encode('utf-8'))
    h.update((title or '').encode('utf-8'))
    h.update((url or '').encode('utf-8'))
    return h.hexdigest()


def ensure_dirs():
    os.makedirs('data', exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_raw():
    items = []
    if os.path.exists(RAW_PATH):
        with open(RAW_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    items.append(json.loads(line))
                except Exception:
                    pass
    return items


def save_raw(items):
    with open(RAW_PATH, 'w', encoding='utf-8') as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")


def fetch_all():
    collected = []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=ROLLING_DAYS)

    for feed in FEEDS:
        name = feed['name']
        url = feed['url']
        try:
            parsed = feedparser.parse(url)
            for e in parsed.entries:
                title = e.get('title', '').strip()
                link = e.get('link', '').strip()
                if not title or not link:
                    continue
                published = parse_time(e)
                if published < cutoff:
                    continue
                sid = make_id(name, title, link)
                sent = classify_sentiment(title)
                topic = classify_topic(title)
                item = {
                    'id': sid,
                    'source': name,
                    'title': title,
                    'url': link,
                    'published': published.isoformat(),
                    'topic': topic,
                    'sentiment': sent['label'],
                    'compound': sent['compound']
                }
                collected.append(item)
        except Exception as ex:
            # Skip broken feeds; continue gracefully
            print(f"Feed error for {name}: {ex}")
            continue

    return collected


def aggregate(items, window_hours=24):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=window_hours)
    window_items = [it for it in items if dateparser.parse(it['published']).astimezone(timezone.utc) >= window_start]

    totals = {'positive': 0, 'neutral': 0, 'negative': 0}
    by_pub = {}
    by_topic = {}

    for it in window_items:
        s = it['sentiment']
        totals[s] = totals.get(s, 0) + 1

        pub = it['source']
        if pub not in by_pub:
            by_pub[pub] = {'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        by_pub[pub][s] += 1
        by_pub[pub]['count'] += 1

        tp = it['topic']
        if tp not in by_topic:
            by_topic[tp] = {'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        by_topic[tp][s] += 1
        by_topic[tp]['count'] += 1

    # Build simple daily history for last 7 days
    history = []
    start_day = (now - timedelta(days=ROLLING_DAYS - 1)).date()
    days = [start_day + timedelta(days=i) for i in range(ROLLING_DAYS)]
    for d in days:
        day_start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        day_items = [it for it in items if day_start <= dateparser.parse(it['published']).astimezone(timezone.utc) < day_end]
        htot = {'date': d.isoformat(), 'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        for it in day_items:
            s = it['sentiment']
            htot[s] += 1
            htot['count'] += 1
        history.append(htot)

    # Sample a few latest headlines (limit 50)
    window_items_sorted = sorted(window_items, key=lambda x: x['published'], reverse=True)
    sample = [
        {k: it[k] for k in ('title', 'source', 'topic', 'sentiment', 'url', 'published')}
        for it in window_items_sorted[:50]
    ]

    latest = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'window_hours': window_hours,
        'totals': totals,
        'by_publication': [
            {'source': k, **v} for k, v in sorted(by_pub.items(), key=lambda kv: kv[0])
        ],
        'by_topic': [
            {'topic': k, **v} for k, v in sorted(by_topic.items(), key=lambda kv: kv[0])
        ],
        'sample_headlines': sample
    }

    return latest, history


def main():
    ensure_dirs()

    # Load & merge existing raw items
    existing = load_raw()
    existing_by_id = {it['id']: it for it in existing}

    # Fetch new items
    fresh = fetch_all()
    for it in fresh:
        existing_by_id.setdefault(it['id'], it)

    # Keep only last ROLLING_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=ROLLING_DAYS)
    pruned = [it for it in existing_by_id.values() if dateparser.parse(it['published']).astimezone(timezone.utc) >= cutoff]

    # Save raw store
    save_raw(pruned)

    # Aggregations
    latest, history = aggregate(pruned, window_hours=24)

    # Write outputs
    with open(LATEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)

    with open(HISTORY_PATH, 'w', encoding='utf-8') as f:
        json.dump({'generated_at': datetime.now(timezone.utc).isoformat(), 'history': history}, f, ensure_ascii=False, indent=2)

    print(f"Wrote {LATEST_PATH} and {HISTORY_PATH}. Total stored items: {len(pruned)}")


if __name__ == '__main__':
    main()
```

---

## File: `.github/workflows/sentiment.yml`

```yaml
name: Build Sentiment Dashboard

on:
  schedule:
    - cron: '*/30 * * * *'  # every 30 minutes
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run fetcher
        run: python fetcher.py

      - name: Commit and push changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -m "Update sentiment data [skip ci]" || echo "No changes to commit"
          git push
```

---

## File: `docs/index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>News Sentiment Dashboard (MVP)</title>
  <link rel="stylesheet" href="./styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <header class="topbar">
    <div class="brand">News Sentiment — Last 24h</div>
    <div class="meta" id="generatedAt"></div>
  </header>

  <main class="container">
    <section class="cards">
      <div class="card">
        <h3>Overall Sentiment</h3>
        <canvas id="overallChart"></canvas>
      </div>
      <div class="card">
        <h3>By Publication</h3>
        <div class="controls">
          <label for="pubSort">Sort by:</label>
          <select id="pubSort">
            <option value="count">Total</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <canvas id="pubChart"></canvas>
      </div>
      <div class="card">
        <h3>By Topic</h3>
        <canvas id="topicChart"></canvas>
      </div>
      <div class="card">
        <h3>7-Day Trend</h3>
        <canvas id="trendChart"></canvas>
      </div>
    </section>

    <section class="card">
      <h3>Latest Headlines (sample)</h3>
      <ul id="headlines" class="headlines"></ul>
    </section>
  </main>

  <footer class="footer">
    Built free with RSS + VADER + GitHub Pages. <a href="https://github.com/" target="_blank" rel="noopener">Source</a>
  </footer>

  <script src="./app.js"></script>
</body>
</html>
```

---

## File: `docs/app.js`

```javascript
async function fetchJSON(path) {
  const res = await fetch(path + '?_=' + Date.now());
  if (!res.ok) throw new Error('Failed to fetch ' + path);
  return await res.json();
}

function percent(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

function renderOverall(ctx, totals) {
  const total = (totals.positive || 0) + (totals.neutral || 0) + (totals.negative || 0);
  const data = {
    labels: [
      `Positive (${percent(totals.positive, total)}%)`,
      `Neutral (${percent(totals.neutral, total)}%)`,
      `Negative (${percent(totals.negative, total)}%)`
    ],
    datasets: [{
      data: [totals.positive, totals.neutral, totals.negative]
    }]
  };
  new Chart(ctx, { type: 'pie', data });
}

function renderBars(ctx, rows, labelKey, valueKeys, sortBy) {
  const sorted = [...rows].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0)).slice(0, 20);
  const labels = sorted.map(r => r[labelKey]);
  const datasets = valueKeys.map(k => ({ label: k, data: sorted.map(r => r[k] || 0) }));
  new Chart(ctx, { type: 'bar', data: { labels, datasets }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true }}}});
}

function renderTrend(ctx, history) {
  const labels = history.map(h => h.date);
  const datasets = ['positive', 'neutral', 'negative'].map(k => ({ label: k, data: history.map(h => h[k] || 0) }));
  new Chart(ctx, { type: 'line', data: { labels, datasets }, options: { responsive: true }});
}

function renderHeadlines(listEl, items) {
  listEl.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');
    li.className = 'headline';
    li.innerHTML = `
      <div class="tag ${it.sentiment}">${it.sentiment}</div>
      <a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>
      <div class="meta">${it.source} • ${new Date(it.published).toLocaleString()}</div>
    `;
    listEl.appendChild(li);
  });
}

(async function init() {
  try {
    const [latest, history] = await Promise.all([
      fetchJSON('./data/latest.json'),
      fetchJSON('./data/history.json')
    ]);

    document.getElementById('generatedAt').textContent = `Updated: ${new Date(latest.generated_at).toLocaleString()}`;

    // Overall
    renderOverall(document.getElementById('overallChart'), latest.totals);

    // By Publication (stacked)
    const pubSort = document.getElementById('pubSort');
    const makePub = () => renderBars(
      document.getElementById('pubChart'),
      latest.by_publication,
      'source',
      ['positive', 'neutral', 'negative'],
      pubSort.value
    );
    let pubChartEl = document.getElementById('pubChart');
    makePub();
    pubSort.addEventListener('change', () => {
      // Re-create canvas to avoid Chart.js instance overlap
      const parent = pubChartEl.parentElement;
      const canvas = document.createElement('canvas');
      parent.replaceChild(canvas, pubChartEl);
      pubChartEl = canvas;
      makePub();
    });

    // By Topic
    renderBars(
      document.getElementById('topicChart'),
      latest.by_topic,
      'topic',
      ['positive', 'neutral', 'negative'],
      'count'
    );

    // Trend 7 days
    renderTrend(document.getElementById('trendChart'), history.history);

    // Headlines
    renderHeadlines(document.getElementById('headlines'), latest.sample_headlines);
  } catch (e) {
    console.error(e);
    alert('Failed to load dashboard data.');
  }
})();
```

---

## File: `docs/styles.css`

```css
:root { --bg:#0f172a; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --pos:#16a34a; --neu:#6b7280; --neg:#dc2626; }
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;background:var(--bg);color:var(--text)}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#0b1220;border-bottom:1px solid #1f2937}
.brand{font-weight:700;font-size:18px}
.meta{color:var(--muted);font-size:14px}
.container{max-width:1200px;margin:24px auto;padding:0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.card{background:var(--card);border:1px solid #1f2937;border-radius:16px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,.2)}
.card h3{margin:0 0 12px 0;font-size:16px}
.controls{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.headlines{list-style:none;margin:0;padding:0}
.headline{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:8px;border-bottom:1px solid #1f2937}
.headline .tag{font-size:12px;padding:2px 8px;border-radius:999px;text-transform:capitalize}
.tag.positive{background:rgba(22,163,74,.15);color:var(--pos)}
.tag.neutral{background:rgba(107,114,128,.15);color:var(--neu)}
.tag.negative{background:rgba(220,38,38,.15);color:var(--neg)}
.footer{padding:20px;color:var(--muted);text-align:center}
```

---

## (Optional) Local Run Instructions

```bash
# 1) Create & activate a virtualenv (recommended)
python -m venv .venv && source .venv/bin/activate

# 2) Install deps
pip install -r requirements.txt

# 3) Run the fetcher to build data files
python fetcher.py

# 4) Open the dashboard locally
open docs/index.html  # (macOS) or start docs/index.html on Windows
```

---

## Notes, Limits & Next Steps

* **Free, simple sentiment**: VADER is rule-based. It’s solid for headlines, but not perfect (sarcasm/irony are hard). If you later want higher accuracy, switch to a small transformer model.
* **Topics** are keyword-based for now. You can upgrade to a classifier (zero-shot or fine-tuned) later.
* **Feeds**: We use a broad set of English RSS feeds. You can add/remove feeds in `FEEDS`.
* **Window**: The dashboard shows **last 24 hours** and a **7-day trend**. Adjust in `ROLLING_DAYS` / `aggregate()`.
* **Scaling**: If you need more than GitHub Pages + Actions, move storage to a free Postgres (e.g., Supabase) and expose a tiny API. For global coverage at scale, consider **GDELT** (free, includes a built-in tone metric) as a future data source.

---

## How to Embed Later

Once you’re happy with it, you can embed the dashboard in your own site with an `<iframe>` pointing to your GitHub Pages URL, or copy `docs/` into your site and point it at the generated JSON files.
