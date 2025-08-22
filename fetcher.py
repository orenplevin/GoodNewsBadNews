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
main()
