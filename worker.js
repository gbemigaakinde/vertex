export default {
  async fetch(request, env) {

    // Health check
    if (request.method === 'GET') {
      return new Response('Vertex Cloudflare Worker is working!', { status: 200 });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/ai') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return jsonError('Invalid JSON body.', 400);
      }

      const { provider, payload } = body;

      if (!provider || !payload) {
        return jsonError('Missing provider or payload.', 400);
      }

      // ── Groq ──────────────────────────────────────────────
      if (provider === 'groq') {
        const groqKey = env.GROQ_API_KEY;
        if (!groqKey) return jsonError('Groq API key not configured.', 500);

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': 'Bearer ' + groqKey,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(payload),
        });

        const groqData = await groqRes.json();
        return new Response(JSON.stringify(groqData), {
          status:  groqRes.status,
          headers: corsJsonHeaders(),
        });
      }

      // ── Gemini ────────────────────────────────────────────
      if (provider === 'gemini') {
        const geminiKey = env.GEMINI_API_KEY;
        if (!geminiKey) return jsonError('Gemini API key not configured.', 500);

        const { model, ...geminiBody } = payload;
        const geminiModel = model || 'gemini-3.7-flash';
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                          geminiModel + ':generateContent?key=' + geminiKey;

        const geminiRes = await fetch(geminiUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(geminiBody),
        });

        const geminiData = await geminiRes.json();
        return new Response(JSON.stringify(geminiData), {
          status:  geminiRes.status,
          headers: corsJsonHeaders(),
        });
      }

      // ── OpenRouter ────────────────────────────────────────
      if (provider === 'openrouter') {
        const orKey = env.OR_API_KEY;
        if (!orKey) return jsonError('OpenRouter API key not configured.', 500);

        const siteUrl  = 'https://vertex-tutorial.vercel.app';
        const siteName = 'Vertex Tutorial CBT';

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Authorization': 'Bearer ' + orKey,
            'HTTP-Referer':  siteUrl,
            'X-Title':       siteName,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify(payload),
        });

        const orData = await orRes.json();
        return new Response(JSON.stringify(orData), {
          status:  orRes.status,
          headers: corsJsonHeaders(),
        });
      }

      return jsonError('Unknown provider: ' + provider, 400);
    }

    return new Response('Not found.', { status: 404 });
  },
};

function corsJsonHeaders() {
  return {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
  };
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status:  status,
    headers: corsJsonHeaders(),
  });
}
