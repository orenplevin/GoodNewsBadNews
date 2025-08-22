import os
import json
import time
import hashlib
from datetime import datetime, timedelta, timezone
import nltk

import feedparser
from dateutil import parser as dateparser

# NLTK VADER setup
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Ensure VADER lexicon is present
try:
    nltk.data.find('vader_lexicon')
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
    """Classify sentiment using VADER"""
    scores = sia.polarity_scores(text or '')
    compound = scores.get('compound', 0.0)
    if compound >= 0.05:
        label = 'positive'
    elif compound <= -0.05:
        label = 'negative'
    else:
        label = 'neutral'
    
    return {
        'label': label,
        'compound': compound,
        'scores': scores
    }

def classify_topic(text: str) -> str:
    """Classify article topic based on keywords"""
    text_lower = (text or '').lower()
    
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            return topic
    
    return DEFAULT_TOPIC

def generate_article_id(title: str, url: str) -> str:
    """Generate unique ID for article"""
    return hashlib.md5(f"{title}#{url}".encode()).hexdigest()

def parse_date(date_str):
    """Parse various date formats"""
    if not date_str:
        return datetime.now(timezone.utc)
    
    try:
        # Try parsing with dateutil
        dt = dateparser.parse(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except:
        return datetime.now(timezone.utc)

def fetch_rss_feeds():
    """Fetch articles from all RSS feeds"""
    articles = []
    
    for feed_config in FEEDS:
        print(f"Fetching {feed_config['name']}...")
        
        try:
            feed = feedparser.parse(feed_config['url'])
            
            for entry in feed.entries:
                # Extract article data
                title = entry.get('title', '')
                url = entry.get('link', '')
                published = parse_date(entry.get('published'))
                summary = entry.get('summary', '') or entry.get('description', '')
                
                # Skip if essential data missing
                if not title or not url:
                    continue
                
                # Combine title and summary for sentiment analysis
                full_text = f"{title}. {summary}"
                
                # Classify sentiment and topic
                sentiment = classify_sentiment(full_text)
                topic = classify_topic(full_text)
                
                article = {
                    'id': generate_article_id(title, url),
                    'title': title,
                    'url': url,
                    'source': feed_config['name'],
                    'published': published.isoformat(),
                    'sentiment': sentiment['label'],
                    'sentiment_score': sentiment['compound'],
                    'topic': topic,
                    'summary': summary
                }
                
                articles.append(article)
                
        except Exception as e:
            print(f"Error fetching {feed_config['name']}: {e}")
            continue
    
    return articles

def load_existing_articles():
    """Load existing articles from raw data file"""
    articles = []
    
    if os.path.exists(RAW_PATH):
        try:
            with open(RAW_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        articles.append(json.loads(line))
        except Exception as e:
            print(f"Error loading existing articles: {e}")
    
    return articles

def save_articles(articles):
    """Save articles to raw data file"""
    os.makedirs(os.path.dirname(RAW_PATH), exist_ok=True)
    
    with open(RAW_PATH, 'w', encoding='utf-8') as f:
        for article in articles:
            f.write(json.dumps(article) + '\n')

def filter_recent_articles(articles, hours=24):
    """Filter articles from last N hours"""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    recent = []
    for article in articles:
        try:
            pub_date = datetime.fromisoformat(article['published'])
            if pub_date >= cutoff:
                recent.append(article)
        except:
            continue
    
    return recent

def generate_statistics(articles):
    """Generate statistics from articles"""
    if not articles:
        return {
            'totals': {'positive': 0, 'neutral': 0, 'negative': 0},
            'by_publication': [],
            'by_topic': [],
            'sample_headlines': []
        }
    
    # Overall sentiment counts
    sentiment_counts = {'positive': 0, 'neutral': 0, 'negative': 0}
    for article in articles:
        sentiment_counts[article['sentiment']] += 1
    
    # By publication
    pub_stats = {}
    for article in articles:
        source = article['source']
        if source not in pub_stats:
            pub_stats[source] = {'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        
        pub_stats[source][article['sentiment']] += 1
        pub_stats[source]['count'] += 1
    
    by_publication = [
        {'source': source, **stats}
        for source, stats in pub_stats.items()
    ]
    by_publication.sort(key=lambda x: x['count'], reverse=True)
    
    # By topic
    topic_stats = {}
    for article in articles:
        topic = article['topic']
        if topic not in topic_stats:
            topic_stats[topic] = {'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        
        topic_stats[topic][article['sentiment']] += 1
        topic_stats[topic]['count'] += 1
    
    by_topic = [
        {'topic': topic, **stats}
        for topic, stats in topic_stats.items()
    ]
    by_topic.sort(key=lambda x: x['count'], reverse=True)
    
    # Sample headlines (mix of sentiments, recent first)
    sample_headlines = sorted(articles, key=lambda x: x['published'], reverse=True)[:20]
    
    return {
        'totals': sentiment_counts,
        'by_publication': by_publication,
        'by_topic': by_topic,
        'sample_headlines': [
            {
                'title': a['title'],
                'url': a['url'],
                'source': a['source'],
                'published': a['published'],
                'sentiment': a['sentiment']
            }
            for a in sample_headlines
        ]
    }

def generate_history_data(articles):
    """Generate daily sentiment history for the last 7 days"""
    history = []
    
    for i in range(ROLLING_DAYS):
        day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        day_articles = [
            a for a in articles
            if day_start <= datetime.fromisoformat(a['published']) < day_end
        ]
        
        sentiment_counts = {'positive': 0, 'neutral': 0, 'negative': 0}
        for article in day_articles:
            sentiment_counts[article['sentiment']] += 1
        
        history.append({
            'date': day_start.strftime('%Y-%m-%d'),
            **sentiment_counts
        })
    
    return list(reversed(history))

def main():
    """Main execution function"""
    print("🔄 Fetching news articles...")
    
    # Fetch new articles
    new_articles = fetch_rss_feeds()
    print(f"📰 Fetched {len(new_articles)} new articles")
    
    # Load existing articles
    existing_articles = load_existing_articles()
    print(f"📚 Loaded {len(existing_articles)} existing articles")
    
    # Combine and deduplicate
    all_articles = existing_articles.copy()
    existing_ids = {a['id'] for a in existing_articles}
    
    for article in new_articles:
        if article['id'] not in existing_ids:
            all_articles.append(article)
    
    print(f"📊 Total unique articles: {len(all_articles)}")
    
    # Save all articles
    save_articles(all_articles)
    
    # Generate latest dashboard data (last 24 hours)
    recent_articles = filter_recent_articles(all_articles, hours=24)
    print(f"🕐 Recent articles (24h): {len(recent_articles)}")
    
    latest_stats = generate_statistics(recent_articles)
    
    # Generate history data (last 7 days)
    week_articles = filter_recent_articles(all_articles, hours=24*ROLLING_DAYS)
    history_data = generate_history_data(week_articles)
    
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Save latest data
    latest_output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'window_hours': 24,
        **latest_stats
    }
    
    with open(LATEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(latest_output, f, indent=2)
    
    # Save history data
    history_output = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'history': history_data
    }
    
    with open(HISTORY_PATH, 'w', encoding='utf-8') as f:
        json.dump(history_output, f, indent=2)
    
    print(f"✅ Dashboard data updated!")
    print(f"📈 Sentiment distribution: {latest_stats['totals']}")

if __name__ == "__main__":
    main()
