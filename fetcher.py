import os
import json
import time
import hashlib
import re
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
ALL_HEADLINES_PATH = os.path.join(OUTPUT_DIR, 'all_headlines.json')

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
    {"name": "CNBC", "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html", "region": "Global"},
    {"name": "Bloomberg", "url": "https://feeds.bloomberg.com/markets/news.rss", "region": "Global"},
    {"name": "MarketWatch", "url": "http://feeds.marketwatch.com/marketwatch/topstories/", "region": "Global"},
    {"name": "Forbes", "url": "https://www.forbes.com/news/index.xml", "region": "Global"},
    {"name": "TechCrunch", "url": "http://feeds.feedburner.com/TechCrunch/", "region": "Global"},
    {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "region": "Global"},
    {"name": "Wired", "url": "https://www.wired.com/feed/rss", "region": "Global"},
    {"name": "Ars Technica", "url": "http://feeds.arstechnica.com/arstechnica/index", "region": "Global"},
    {"name": "Engadget", "url": "https://www.engadget.com/rss.xml", "region": "Global"},
    {"name": "Mashable", "url": "http://feeds.mashable.com/Mashable", "region": "Global"},
    
    # Sports (Global)
    {"name": "ESPN", "url": "https://www.espn.com/espn/rss/news", "region": "Global"},
    {"name": "Sports Illustrated", "url": "https://www.si.com/rss/si_topstories.rss", "region": "Global"},
    {"name": "BBC Sport", "url": "http://feeds.bbci.co.uk/sport/rss.xml", "region": "Global"},
    {"name": "Sky Sports", "url": "http://www.skysports.com/rss/12040", "region": "Global"},
]

# Context-driven topic classification - focuses on WHAT is happening, not just words
TOPIC_CONTEXTS = {
    'Tech': {
        'product_actions': [
            r'\b(apple|google|microsoft|meta|amazon|netflix|tesla|nvidia|openai|anthropic)\s+(launches|releases|unveils|announces|introduces)\s+(?:new\s+)?(?:ai|app|device|software|platform|service|model|chip|processor)',
            r'\b(iphone|android|windows|ios|chrome|safari)\s+(?:gets|receives|adds|introduces)\s+(?:new\s+)?(?:feature|update|version)',
            r'\bai\s+(?:model|system|chatbot|assistant)\s+(?:can\s+now|breakthrough|development|launch)',
            r'\b(?:new|latest)\s+(?:smartphone|laptop|tablet|processor|graphics\s+card|chip)\s+(?:from|by|features)',
        ],
        'tech_events': [
            r'\b(?:software|app|platform|website|service)\s+(?:crashes?|down|outage|bug|vulnerability|hack)',
            r'\b(?:data\s+breach|cyber\s+attack|ransomware|malware)\s+(?:hits?|affects?|targets?)',
            r'\b(?:startup|tech\s+company)\s+(?:raises?|secures?)\s+\$[\d,]+\s*(?:million|billion)',
            r'\bcode|algorithm|programming|developer|software\s+engineer',
            r'\b(?:virtual|augmented)\s+reality\s+(?:headset|experience|game)',
        ],
        'innovation_patterns': [
            r'\bbreakthrough\s+in\s+(?:ai|artificial\s+intelligence|machine\s+learning|quantum\s+computing|robotics)',
            r'\b(?:scientists?|researchers?|engineers?)\s+(?:develop|create|build)\s+(?:new\s+)?(?:ai|robot|algorithm|chip|processor)',
            r'\b(?:autonomous|self-driving)\s+(?:car|vehicle|taxi)',
        ],
        'priority': 6
    },
    
    'Politics': {
        'electoral_actions': [
            r'\b(?:president|prime\s+minister|governor|mayor|senator|congressman|cm|chief\s+minister)\s+(?:wins?|loses?|defeats?|elected|inaugurates?|announces?)',
            r'\b(?:election|vote|ballot|poll|campaign)\s+(?:results?|victory|defeat|winner)',
            r'\b(?:parliament|congress|senate|assembly|legislature)\s+(?:passes?|rejects?|approves?|votes?\s+on)',
        ],
        'governmental_actions': [
            r'\b(?:government|administration|cabinet)\s+(?:announces?|plans?|proposes?|introduces?|implements?)',
            r'\b(?:policy|law|bill|legislation|regulation)\s+(?:passed|signed|proposed|introduced|enacted)',
            r'\b(?:minister|secretary|official)\s+(?:says?|announces?|declares?|resigns?|appointed)',
        ],
        'political_events': [
            r'\bpolitical\s+(?:crisis|scandal|corruption|investigation|protest)',
            r'\b(?:diplomatic|international)\s+(?:talks|negotiations|summit|meeting|relations)',
            r'\b(?:sanctions?|embargo|treaty|agreement)\s+(?:imposed|lifted|signed|broken)',
            r'\b(?:party|convention|political|pdp|nec)\s+(?:meets?|amid|uncertainty)',
        ],
        'priority': 9  # High priority
    },
    
    'Business': {
        'financial_actions': [
            r'\b(?:company|corporation|firm)\s+(?:reports?|posts?|announces?)\s+(?:quarterly|annual)?\s*(?:profit|loss|earnings|revenue)',
            r'\b(?:stock|shares?)\s+(?:rises?|falls?|jumps?|drops?|surges?|plunges?)\s+(?:\d+%|\d+\s+points?)',
            r'\b(?:merger|acquisition|buyout|deal)\s+(?:worth|valued\s+at)?\s*\$[\d,]+\s*(?:million|billion)',
            r'\b(?:ceo|cfo|executive|chairman)\s+(?:resigns?|fired|steps\s+down|appointed|hired)',
        ],
        'market_events': [
            r'\b(?:market|economy|inflation|recession|growth)\s+(?:rises?|falls?|recovers?|crashes?|slows?)',
            r'\b(?:federal\s+reserve|central\s+bank)\s+(?:raises?|cuts?|maintains?)\s+(?:interest\s+)?rates?',
            r'\b(?:unemployment|jobs|employment)\s+(?:rises?|falls?|increases?|decreases?)',
            r'\bipo\s+(?:launches?|debuts?|prices?\s+at)',
        ],
        'priority': 7
    },

    'Sports': {
        'game_results': [
            r'\b(?:team|player|athlete)\s+(?:wins?|loses?|defeats?|beats?)\s+(?:\d+-\d+|\w+\s+\d+-\d+)',
            r'\b(?:championship|tournament|final|match|game)\s+(?:victory|defeat|win|loss)',
            r'\b(?:scores?|goals?|points?|runs?)\s+(?:winning|decisive|final)',
        ],
        'sports_events': [
            r'\b(?:world\s+cup|olympics?|championship|playoffs?|finals?)\s+(?:begins?|starts?|ends?|victory)',
            r'\b(?:coach|manager|trainer)\s+(?:fired|hired|resigns?|appointed)',
            r'\b(?:player|athlete)\s+(?:injured|retires?|transfers?|signs?\s+contract)',
            r'\b(?:record|milestone)\s+(?:broken|achieved|reached|set)',
        ],
        'priority': 7
    },
    
    'Health': {
        'medical_developments': [
            r'\b(?:new|novel|experimental)\s+(?:treatment|cure|therapy|drug|vaccine)\s+(?:for|against|treats?)',
            r'\b(?:clinical\s+trial|study|research)\s+(?:shows?|finds?|reveals?|suggests?)',
            r'\b(?:fda|health\s+authority)\s+(?:approves?|rejects?|investigates?)',
            r'\b(?:outbreak|epidemic|pandemic)\s+(?:spreads?|contains?|under\s+control)',
        ],
        'health_events': [
            r'\b(?:virus|disease|infection)\s+(?:spreads?|mutates?|identified|discovered)',
            r'\b(?:hospital|healthcare|medical)\s+(?:crisis|shortage|emergency|breakthrough)',
            r'\b(?:vaccine|vaccination|immunization)\s+(?:campaign|rollout|mandatory|optional)',
        ],
        'priority': 8
    },
    
    'Science': {
        'research_discoveries': [
            r'\b(?:scientists?|researchers?)\s+(?:discover|find|identify|observe)\s+(?:new|first|rare)',
            r'\b(?:study|research|experiment)\s+(?:reveals?|shows?|demonstrates?|proves?)',
            r'\b(?:breakthrough|discovery|finding)\s+in\s+(?:physics|biology|chemistry|astronomy|medicine)',
            r'\b(?:space|mars|moon|planet|galaxy)\s+(?:mission|exploration|discovery|landing)',
        ],
        'scientific_events': [
            r'\b(?:climate|environment|global\s+warming)\s+(?:impact|effect|consequence|solution)',
            r'\b(?:nasa|spacex|esa)\s+(?:launches?|mission|rocket|spacecraft)',
            r'\b(?:renewable|clean)\s+energy\s+(?:breakthrough|development|project)',
        ],
        'priority': 6
    },
    
    'Entertainment': {
        'celebrity_events': [
            r'\b(?:actor|actress|singer|musician|celebrity)\s+(?:dies?|arrested|marries?|divorces?|pregnant)',
            r'\b(?:movie|film)\s+(?:premieres?|releases?|box\s+office|sequel|remake)',
            r'\b(?:album|song|single)\s+(?:releases?|debuts?|tops?\s+charts?|grammy|award)',
            r'\b(?:tv\s+show|series|netflix|streaming)\s+(?:cancelled|renewed|premieres?|finale)',
        ],
        'entertainment_industry': [
            r'\b(?:hollywood|film\s+industry|music\s+industry)\s+(?:strike|scandal|controversy)',
            r'\b(?:oscar|grammy|emmy|golden\s+globe)\s+(?:nominations?|winners?|ceremony)',
            r'\b(?:streaming|netflix|disney|hbo)\s+(?:new\s+shows?|cancels?|original\s+series)',
            r'\b(?:reality\s+tv|virgins.*tv|darlings)',
        ],
        'priority': 5
    },
    
    'World': {
        'international_relations': [
            r'\b(?:country|nation|government)\s+(?:declares?|announces?)\s+(?:war|peace|alliance|sanctions?)',
            r'\b(?:diplomatic|international)\s+(?:crisis|conflict|relations|negotiations|summit)',
            r'\b(?:treaty|agreement|accord)\s+(?:signed|broken|violated|negotiated)',
            r'\b(?:embassy|ambassador|foreign\s+minister)\s+(?:expelled|recalled|meeting)',
        ],
        'global_events': [
            r'\b(?:war|conflict|fighting|battle|strike|attack|killed|bombs?)\s+(?:in|between|over|escalates?|ends?)',
            r'\b(?:gaza|israel|military|officers|jihadists?|air\s+force)',
            r'\b(?:refugees?|humanitarian)\s+(?:crisis|aid|assistance|camp)',
            r'\b(?:terrorism|terrorist\s+attack|bombing|assassination)',
            r'\b(?:natural\s+disaster|earthquake|hurricane|flooding|wildfire)\s+(?:hits?|strikes?|devastates?)',
        ],
        'priority': 8
    },
    
    'Regional': {
        'regional_actions': [
            r'\b(state|province|county|region)\s+(government|legislature|assembly|plans)',
            r'\b(regional|statewide|provincial)\s+(election|policy|program)',
            r'\b(governor|premier|mayor)\s+(of|announces|elected)',
            r'\b(state|provincial)\s+(budget|law|regulation)',
            r'\bin\s+(california|texas|florida|ontario|quebec|bavaria|scotland)'
        ],
        'priority': 6
    },
    
    'Local': {
        'local_events': [
            r'\b(city|town|municipal)\s+(council|government|meeting)',
            r'\b(local|community)\s+(news|event|issue|concern)',
            r'\b(mayor|councilman|alderman)\s+(says|announces|elected)',
            r'\b(neighborhood|community)\s+(project|development|issue)',
            r'\b(municipal|city)\s+(budget|ordinance|permit)',
            r'\b(police|arrest|accused|crime)\s+(?:man|woman|person)',
            r'\b(?:school|education|millions.*out\s+of\s+school)',
            r'\b(?:dowry|wife|burning|alive)',
        ],
        'priority': 6
    }
}

# Enhanced region patterns for better context detection
REGION_PATTERNS = {
    'North America': {
        'countries': ['usa', 'united states', 'america', 'us', 'canada', 'mexico'],
        'cities': ['new york', 'los angeles', 'chicago', 'toronto', 'vancouver', 'mexico city', 'washington', 'boston', 'miami', 'seattle', 'montreal', 'ottawa'],
        'context_patterns': [
            r'\b(president|congress|senate|house)\s+(of|in)\s+(america|usa|us)',
            r'\b(canadian|american|mexican)\s+(government|prime minister|president)',
            r'\bin\s+(america|usa|canada|mexico|united states)'
        ]
    },
    'Europe': {
        'countries': ['uk', 'britain', 'england', 'france', 'germany', 'italy', 'spain', 'netherlands', 'belgium', 'sweden', 'norway', 'poland', 'ukraine', 'russia'],
        'cities': ['london', 'paris', 'berlin', 'rome', 'madrid', 'amsterdam', 'brussels', 'stockholm', 'oslo', 'warsaw', 'kiev', 'moscow'],
        'context_patterns': [
            r'\b(european|eu|brexit|schengen)',
            r'\b(prime minister|chancellor|president)\s+(of|in)\s+(uk|britain|france|germany)',
            r'\bin\s+(europe|eu|britain|france|germany|italy|spain)'
        ]
    },
    'Asia-Pacific': {
        'countries': ['china', 'japan', 'korea', 'india', 'australia', 'indonesia', 'thailand', 'vietnam', 'singapore', 'malaysia', 'philippines'],
        'cities': ['beijing', 'shanghai', 'tokyo', 'seoul', 'mumbai', 'delhi', 'sydney', 'melbourne', 'singapore', 'bangkok', 'manila'],
        'context_patterns': [
            r'\b(asian|chinese|japanese|korean|indian|australian)',
            r'\b(prime minister|president|emperor)\s+(of|in)\s+(china|japan|korea|india|australia)',
            r'\bin\s+(asia|china|japan|korea|india|australia|southeast asia)'
        ]
    },
    'Middle East': {
        'countries': ['israel', 'palestine', 'iran', 'iraq', 'syria', 'lebanon', 'jordan', 'saudi arabia', 'uae', 'turkey', 'egypt'],
        'cities': ['jerusalem', 'tel aviv', 'tehran', 'baghdad', 'damascus', 'beirut', 'amman', 'riyadh', 'dubai', 'istanbul', 'cairo'],
        'context_patterns': [
            r'\b(middle east|gaza|west bank|gulf)',
            r'\b(israeli|palestinian|iranian|iraqi|syrian|lebanese)',
            r'\bin\s+(israel|palestine|iran|iraq|syria|lebanon|middle east)'
        ]
    },
    'Africa': {
        'countries': ['south africa', 'nigeria', 'kenya', 'egypt', 'morocco', 'algeria', 'tunisia', 'ethiopia', 'ghana', 'zimbabwe'],
        'cities': ['cape town', 'johannesburg', 'lagos', 'nairobi', 'cairo', 'casablanca', 'algiers', 'tunis', 'addis ababa', 'accra'],
        'context_patterns': [
            r'\b(african|south african|nigerian|kenyan|egyptian)',
            r'\bin\s+(africa|south africa|nigeria|kenya|egypt|morocco)'
        ]
    },
    'South America': {
        'countries': ['brazil', 'argentina', 'chile', 'colombia', 'peru', 'venezuela', 'ecuador', 'bolivia', 'uruguay', 'paraguay'],
        'cities': ['sao paulo', 'rio de janeiro', 'buenos aires', 'santiago', 'bogota', 'lima', 'caracas', 'quito', 'montevideo'],
        'context_patterns': [
            r'\b(south american|brazilian|argentinian|chilean|colombian)',
            r'\bin\s+(south america|brazil|argentina|chile|colombia|peru)'
        ]
    }
}

def classify_sentiment_enhanced(title: str, summary: str = "") -> dict:
    """Enhanced sentiment classification with context awareness"""
    full_text = f"{title}. {summary}"
    
    # Get VADER scores
    scores = sia.polarity_scores(full_text)
    compound = scores.get('compound', 0.0)
    
    # Context-aware adjustments
    text_lower = full_text.lower()
    
    # Boost positive sentiment for certain contexts
    positive_boosters = [
        r'\b(breakthrough|success|victory|achievement|progress|improvement|recovery|growth)',
        r'\b(celebrates?|honors?|awards?|wins?|triumphs?)',
        r'\b(peace|agreement|resolution|solution|cure)'
    ]
    
    # Boost negative sentiment for certain contexts
    negative_boosters = [
        r'\b(crisis|disaster|tragedy|death|killing|war|conflict|attack)',
        r'\b(fails?|collapse|crash|scandal|corruption|fraud)',
        r'\b(emergency|urgent|critical|severe|devastating)'
    ]
    
    for pattern in positive_boosters:
        if re.search(pattern, text_lower):
            compound += 0.1
    
    for pattern in negative_boosters:
        if re.search(pattern, text_lower):
            compound -= 0.1
    
    # Classify based on adjusted compound score
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

def classify_topic_contextual(title: str, summary: str = "") -> str:
    """Classify topic based on contextual patterns - what is actually happening"""
    full_text = f"{title}. {summary}".lower()
    
    # Score each topic based on context matches
    topic_scores = {}
    
  for topic, patterns in TOPIC_CONTEXTS.items():
        score = 0
        priority = patterns.get('priority', 5)
        
        # Check all pattern categories for this topic
        for pattern_category, pattern_list in patterns.items():
            if pattern_category == 'priority':
                continue
                
            for pattern in pattern_list:
                matches = len(re.findall(pattern, full_text, re.IGNORECASE))
                if matches > 0:
                    # Weight by priority and pattern strength
                    score += matches * priority
        
        if score > 0:
            topic_scores[topic] = score
    
    # Return the highest scoring topic
    if topic_scores:
        best_topic = max(topic_scores.keys(), key=lambda x: topic_scores[x])
        return best_topic
    
    return 'Other'

def classify_topic_enhanced(title: str, summary: str = "") -> str:
    """Enhanced topic classification using contextual patterns only"""
    return classify_topic_contextual(title, summary)

def classify_region_enhanced(title: str, summary: str = "", source: str = "") -> str:
    """Enhanced region classification using context patterns"""
    full_text = f"{title} {summary} {source}".lower()
    
    scores = {}
    
    for region, patterns in REGION_PATTERNS.items():
        score = 0
        
        # Check context patterns (highest weight)
        for pattern in patterns['context_patterns']:
            if re.search(pattern, full_text, re.IGNORECASE):
                score += 5
        
        # Check countries (medium weight)
        for country in patterns['countries']:
            if country in full_text:
                score += 2
        
        # Check cities (lower weight)
        for city in patterns['cities']:
            if city in full_text:
                score += 1
        
        scores[region] = score
    
    # Return region with highest score
    if scores and max(scores.values()) > 0:
        return max(scores, key=scores.get)
    
    # Fallback to source-based region mapping
    source_lower = source.lower()
    if any(term in source_lower for term in ['cnn', 'fox', 'nbc', 'abc', 'cbs', 'npr', 'usa today', 'wall street', 'new york times', 'washington post']):
        return 'North America'
    elif any(term in source_lower for term in ['bbc', 'guardian', 'reuters', 'sky', 'telegraph', 'independent']):
        return 'Europe'
    elif any(term in source_lower for term in ['al jazeera', 'jerusalem post', 'haaretz']):
        return 'Middle East'
    elif any(term in source_lower for term in ['scmp', 'japan times', 'hindu', 'times of india']):
        return 'Asia-Pacific'
    
    return 'Global'

# Legacy function wrappers for compatibility
def classify_sentiment(text: str) -> dict:
    """Wrapper for legacy compatibility"""
    return classify_sentiment_enhanced(text)

def classify_topic(text: str) -> str:
    """Wrapper for legacy compatibility"""
    return classify_topic_enhanced(text)

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
                
                # Combine title and summary for analysis
                full_text = f"{title}. {summary}"
                
                # Enhanced classification
                sentiment = classify_sentiment_enhanced(full_text)
                topic = classify_topic_enhanced(title, summary)
                region = classify_region_enhanced(title, summary, feed_config['name'])
                
                article = {
                    'id': generate_article_id(title, url),
                    'title': title,
                    'url': url,
                    'source': feed_config['name'],
                    'region': region,  # Now uses enhanced classification
                    'published': published.isoformat(),
                    'sentiment': sentiment['label'],
                    'sentiment_score': sentiment['compound'],
                    'topic': topic,  # Now uses contextual classification
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
    print("🔄 Fetching news articles with contextual topic classification...")
    
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
    
    # Show topic distribution for debugging
    topic_counts = {}
    for article in recent_articles:
        topic = article['topic']
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
    
    print("📋 Topic distribution:")
    for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {topic}: {count}")
    
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
    
    print(f"✅ Enhanced dashboard data updated with contextual classification!")
    print(f"📈 Sentiment distribution: {latest_stats['totals']}")
    print(f"🌍 Regions covered: {len(latest_stats['by_region'])}")
    print(f"📋 Topics covered: {len(latest_stats['by_topic'])}")

if __name__ == "__main__":
    main()
