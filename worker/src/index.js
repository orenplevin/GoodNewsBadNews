// worker/src/index.js
export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      const stored = await env.HEADLINES_STORE.get('headlines', { type: 'json' });
      const headlines = stored ?? [];
      return new Response(JSON.stringify(headlines), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const data = await request.json();
      await env.HEADLINES_STORE.put('headlines', JSON.stringify(data));
      return new Response('Saved', { status: 201 });
    }

    return new Response('Method not allowed', { status: 405 });
  }
};

