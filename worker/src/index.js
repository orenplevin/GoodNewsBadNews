// Fixed Cloudflare Worker - worker/src/index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200,
        headers: corsHeaders 
      });
    }

    try {
      // Handle /api/headlines route specifically
      if (url.pathname === '/api/headlines' || url.pathname.startsWith('/api/headlines')) {
        if (request.method === 'GET') {
          return await handleGetHeadlines(env, corsHeaders);
        } else if (request.method === 'POST') {
          return await handleSaveHeadlines(request, env, corsHeaders);
        }
      }
      
      // Fallback for other routes
      return new Response('Not Found', { 
        status: 404, 
        headers: corsHeaders 
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  }
};

async function handleGetHeadlines(env, corsHeaders) {
  try {
    // Try to get headlines from KV storage
    const stored = await env.HEADLINES_STORE.get('all_headlines', { type: 'json' });
    
    if (stored && stored.headlines) {
      // Return in the format expected by headlines-editor.js
      return new Response(JSON.stringify(stored), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Return empty structure if no data
      return new Response(JSON.stringify({
        generated_at: new Date().toISOString(),
        count: 0,
        headlines: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error getting headlines:', error);
    return new Response(JSON.stringify({ error: 'Failed to load headlines' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSaveHeadlines(request, env, corsHeaders) {
  try {
    const headlinesArray = await request.json();
    
    // Validate that we received an array
    if (!Array.isArray(headlinesArray)) {
      return new Response(JSON.stringify({ error: 'Expected array of headlines' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create the data structure expected by the frontend
    const dataToStore = {
      generated_at: new Date().toISOString(),
      count: headlinesArray.length,
      headlines: headlinesArray
    };

    // Save to KV storage
    await env.HEADLINES_STORE.put('all_headlines', JSON.stringify(dataToStore));
    
    // Also generate and save updated dashboard statistics
    const stats = generateStats(headlinesArray);
    const latestStats = {
      generated_at: dataToStore.generated_at,
      window_hours: 24,
      ...stats
    };
    
    await env.HEADLINES_STORE.put('latest_stats', JSON.stringify(latestStats));
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully saved ${headlinesArray.length} headlines`,
      count: headlinesArray.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error saving headlines:', error);
    return new Response(JSON.stringify({ error: 'Failed to save headlines' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function generateStats(headlines) {
  if (!headlines || headlines.length === 0) {
    return {
      totals: { positive: 0, neutral: 0, negative: 0 },
      by_publication: [],
      by_region: [],
      by_topic: [],
      sample_headlines: []
    };
  }

  // Count sentiments
  const sentiment_counts = { positive: 0, neutral: 0, negative: 0 };
  const pub_stats = {};
  const region_stats = {};
  const topic_stats = {};
  
  headlines.forEach(article => {
    // Count sentiments
    if (article.sentiment) {
      sentiment_counts[article.sentiment] = (sentiment_counts[article.sentiment] || 0) + 1;
    }
    
    // By publication
    const source = article.source || 'Unknown';
    const region = article.region || 'Global';
    if (!pub_stats[source]) {
      pub_stats[source] = { positive: 0, neutral: 0, negative: 0, count: 0, region };
    }
    if (article.sentiment) {
      pub_stats[source][article.sentiment]++;
    }
    pub_stats[source].count++;
    
    // By region
    if (!region_stats[region]) {
      region_stats[region] = { positive: 0, neutral: 0, negative: 0, count: 0 };
    }
    if (article.sentiment) {
      region_stats[region][article.sentiment]++;
    }
    region_stats[region].count++;
    
    // By topic
    const topic = article.topic || 'Other';
    if (!topic_stats[topic]) {
      topic_stats[topic] = { positive: 0, neutral: 0, negative: 0, count: 0 };
    }
    if (article.sentiment) {
      topic_stats[topic][article.sentiment]++;
    }
    topic_stats[topic].count++;
  });
  
  return {
    totals: sentiment_counts,
    by_publication: Object.entries(pub_stats).map(([source, stats]) => ({
      source, ...stats
    })).sort((a, b) => b.count - a.count),
    by_region: Object.entries(region_stats).map(([region, stats]) => ({
      region, ...stats
    })).sort((a, b) => b.count - a.count),
    by_topic: Object.entries(topic_stats).map(([topic, stats]) => ({
      topic, ...stats
    })).sort((a, b) => b.count - a.count),
    sample_headlines: headlines.slice(0, 100).map(a => ({
      title: a.title,
      url: a.url,
      source: a.source,
      region: a.region || 'Global',
      published: a.published,
      sentiment: a.sentiment
    }))
  };
}
