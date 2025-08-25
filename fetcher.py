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
ALL_HEADLINES_PATH = os.path.join(OUTPUT_DIR, 'all_headlines.json')  # New file for all headlines

# RSS feeds organized by region
FEEDS = [
    # North America
    {"name": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml", "region": "Global"},
    {"name": "CNN", "url": "http://rss.cnn.com/rss/edition.rss", "region": "North America"},
    {"name": "Reuters", "url": "https://feeds.reuters.com/reuters/topNews", "region": "Global"},
    {"name": "AP News", "url": "https://feeds.apnews.com/apf-topnews", "region": "North America"},
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml", "region": "North America"},
    {"name": "CBS News", "url": "https://www.cbsnews.com/latest/rss/main", "region": "North America"},
    {"name": "ABC News", "url": "https://abcnews.go.com/abcnews/topstories", "region": "North America"},
    {"name": "Fox News", "url": "http://feeds.foxnews.com/foxnews/latest", "region": "North America"},
    {"name": "NBC News", "url": "http://feeds.nbcnews.com/nbcnews/public/news", "region": "North America"},
    {"name": "USA Today", "url": "http://rssfeeds.usatoday.com/usatoday-NewsTopStories", "region": "North America"},
    {"name": "Wall Street Journal", "url": "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "region": "North America"},
    {"name": "New York Times", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "region": "North America"},
    {"name": "Washington Post", "url": "http://feeds.washingtonpost.com/rss/world", "region": "North America"},
    {"name": "CBC News", "url": "https://www.cbc.ca/cmlink/rss-world", "region": "North America"},
    {"name": "Toronto Star", "url": "https://www.thestar.com/feeds.articles.news.world.rss", "region": "North America"},
    
    # Europe
    {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss", "region": "Europe"},
    {"name": "Financial Times", "url": "https://www.ft.com/?format=rss", "region": "Europe"},
    {"name": "The Times", "url": "https://www.thetimes.co.uk/rss", "region": "Europe"},
    {"name": "Independent", "url": "https://www.independent.co.uk/rss", "region": "Europe"},
    {"name": "Telegraph", "url": "https://www.telegraph.co.uk/rss.xml", "region": "Europe"},
    {"name": "Sky News", "url": "http://feeds.skynews.com/feeds/rss/world.xml", "region": "Europe"},
    {"name": "Euronews", "url": "https://www.euronews.com/rss", "region": "Europe"},
    {"name": "Deutsche Welle", "url": "https://rss.dw.com/xml/rss-en-all", "region": "Europe"},
    {"name": "France 24", "url": "https://www.france24.com/en/rss", "region": "Europe"},
    {"name": "RT News", "url": "https://www.rt.com/rss/news/", "region": "Europe"},
    {"name": "Sputnik News", "url": "https://sputniknews.com/export/rss2/archive/index.xml", "region": "Europe"},
    {"name": "Irish Times", "url": "https://www.irishtimes.com/cmlink/news-1.1319192", "region": "Europe"},
    
    # Asia-Pacific
    {"name": "Al Jazeera English", "url": "https://www.aljazeera.com/xml/rss/all.xml", "region": "Middle East"},
    {"name": "South China Morning Post", "url": "https://www.scmp.com/rss/91/feed", "region": "Asia-Pacific"},
    {"name": "Japan Times", "url": "https://www.japantimes.co.jp/rss/feed/news", "region": "Asia-Pacific"},
    {"name": "The Hindu", "url": "https://www.thehindu.com/news/national/?service=rss", "region": "Asia-Pacific"},
    {"name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "region": "Asia-Pacific"},
    {"name": "Straits Times", "url": "https://www.straitstimes.com/news/singapore/rss.xml", "region": "Asia-Pacific"},
    {"name": "Australian Broadcasting Corporation", "url": "https://www.abc.net.au/news/feed/51120/rss.xml", "region": "Asia-Pacific"},
    {"name": "New Zealand Herald", "url": "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/1/", "region": "Asia-Pacific"},
    {"name": "Korean Herald", "url": "http://www.koreaherald.com/rss/020701000000.xml", "region": "Asia-Pacific"},
    {"name": "Channel News Asia", "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "region": "Asia-Pacific"},
    
    # Middle East & Africa
    {"name": "Jerusalem Post", "url": "https://www.jpost.com/rss/rssfeedsheadlines.aspx", "region": "Middle East"},
    {"name": "Haaretz", "url": "https://www.haaretz.com/srv/haaretz-com-news-feed", "region": "Middle East"},
    {"name": "Middle East Eye", "url": "https://www.middleeasteye.net/rss", "region": "Middle East"},
    {"name": "Times of Israel", "url": "https://www.timesofisrael.com/feed/", "region": "Middle East"},
    {"name": "Daily News Egypt", "url": "https://dailynewsegypt.com/feed/", "region": "Middle East"},
    {"name": "News24 South Africa", "url": "https://www.news24.com/arc/outboundfeeds/rss/?outputType=xml", "region": "Africa"},
    {"name": "AllAfrica", "url": "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", "region": "Africa"},
    {"name": "Daily Nation Kenya", "url": "https://nation.africa/kenya/rss", "region": "Africa"},
    
    # South America
    {"name": "Buenos Aires Herald", "url": "https://www.buenosairesherald.com/rss", "region": "South America"},
    {"name": "Brazil News", "url": "https://rss.cnn.com/rss/edition_americas.rss", "region": "South America"},
    
    # Business & Tech (Global)
    {"name": "CNBC", "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html", "region": "Business"},
    {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/markets/news.rss", "region": "Business"},
    {"name": "MarketWatch", "url": "http://feeds.marketwatch.com/marketwatch/topstories/", "region": "Business"},
    {"name": "Forbes", "url": "https://www.forbes.com/news/index.xml", "region": "Business"},
    {"name": "TechCrunch", "url": "http://feeds.feedburner.com/TechCrunch/", "region": "Technology"},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "region": "Technology"},
    {"name": "Wired", "url": "https://www.wired.com/feed/rss", "region": "Technology"},
    {"name": "Ars Technica", "url": "http://feeds.arstechnica.com/arstechnica/index", "region": "Technology"},
    {"name": "Engadget", "url": "https://www.engadget.com/rss.xml", "region": "Technology"},
    {"name": "Mashable", "url": "http://feeds.mashable.com/Mashable", "region": "Technology"},
    
    # Sports (Global)
    {"name": "ESPN", "url": "https://www.espn.com/espn/rss/news", "region": "Sports"},
    {"name": "Sports Illustrated", "url": "https://www.si.com/rss/si_topstories.rss", "region": "Sports"},
    {"name": "BBC Sport", "url": "http://feeds.bbci.co.uk/sport/rss.xml", "region": "Sports"},
    {"name": "Sky Sports", "url": "http://www.skysports.com/rss/12040", "region": "Sports"},
]

TOPIC_KEYWORDS = {
    'Politics': ['election', 'president', 'parliament', 'congress', 'minister', 'policy', 'politic', 'government', 'senate', 'vote'],
    'Business': ['market', 'stocks', 'earnings', 'profit', 'merger', 'economy', 'inflation', 'startup', 'ipo', 'trading', 'finance'],
    'Tech': ['ai', 'artificial intelligence', 'iphone', 'android', 'microsoft', 'google', 'apple', 'meta', 'openai', 'software', 'chip', 'semiconductor', 'startup', 'tech'],
    'Sports': ['match', 'game', 'tournament', 'league', 'world cup', 'olympic', 'goal', 'coach', 'player', 'team', 'football', 'basketball', 'tennis'],
    'Health': ['covid', 'cancer', 'vaccine', 'health', 'disease', 'nhs', 'virus', 'medical', 'hospital', 'doctor'],
    'Science': ['research', 'study', 'space', 'nasa', 'astronomy', 'physics', 'biology', 'climate', 'environment'],
    'Entertainment': ['movie', 'film', 'celebrity', 'music', 'box office', 'tv', 'netflix', 'streaming', 'hollywood'],
    'World': ['ukraine', 'gaza', 'israel', 'middle east', 'eu', 'china', 'russia', 'africa', 'asia', 'europe', 'america', 'war', 'conflict'],
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
        print(f"Fetching {feed_config['name']} ({feed_config['region']})...")
        
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
                    'region': feed_config['region'],
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
                        article = json.loads(line)
                        # Add region if missing (for backward compatibility)
                        if 'region' not in article:
                            article['region'] = 'Global'
                        articles.append(article)
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
            'by_region': [],
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
        region = article.get('region', 'Global')
        if source not in pub_stats:
            pub_stats[source] = {
                'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0, 'region': region
            }
        
        pub_stats[source][article['sentiment']] += 1
        pub_stats[source]['count'] += 1
    
    by_publication = [
        {'source': source, **stats}
        for source, stats in pub_stats.items()
    ]
    by_publication.sort(key=lambda x: x['count'], reverse=True)
    
    # By region
    region_stats = {}
    for article in articles:
        region = article.get('region', 'Global')
        if region not in region_stats:
            region_stats[region] = {'positive': 0, 'neutral': 0, 'negative': 0, 'count': 0}
        
        region_stats[region][article['sentiment']] += 1
        region_stats[region]['count'] += 1
    
    by_region = [
        {'region': region, **stats}
        for region, stats in region_stats.items()
    ]
    by_region.sort(key=lambda x: x['count'], reverse=True)
    
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
    
    # Sample headlines for main dashboard (limit to 100 for performance)
    sample_headlines = sorted(articles, key=lambda x: x['published'], reverse=True)[:100]
    
    return {
        'totals': sentiment_counts,
        'by_publication': by_publication,
        'by_region': by_region,
        'by_topic': by_topic,
        'sample_headlines': [
            {
                'title': a['title'],
                'url': a['url'],
                'source': a['source'],
                'region': a.get('region', 'Global'),
                'published': a['published'],
                'sentiment': a['sentiment']
            }
            for a in sample_headlines
        ]
    }

def save_all_headlines(articles):
    """Save ALL recent headlines to separate file for the headlines editor"""
    all_headlines = sorted(articles, key=lambda x: x['published'], reverse=True)
    
    headlines_data = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'count': len(all_headlines),
        'headlines': [
            {
                'title': a['title'],
                'url': a['url'],
                'source': a['source'],
                'region': a.get('region', 'Global'),
                'published': a['published'],
                'sentiment': a['sentiment'],
                'topic': a['topic'],
                'summary': a.get('summary', '')[:200] + '...' if a.get('summary', '') else ''
            }
            for a in all_headlines
        ]
    }
    
    with open(ALL_HEADLINES_PATH, 'w', encoding='utf-8') as f:
        json.dump(headlines_data, f, indent=2)
    
    print(f"📰 Saved {len(all_headlines)} headlines to all_headlines.json")

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
    
    # Save ALL recent headlines for the headlines editor
    save_all_headlines(recent_articles)
    
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
    print(f"🌍 Regions covered: {len(latest_stats['by_region'])}")

if __name__ == "__main__":
    main()
