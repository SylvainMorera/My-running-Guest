// Fonction Cloudflare Workers : relais minimal entre My Running Lab et l'API Strava.
// Rôle : garder le secret client Strava hors du navigateur (échange et renouvellement des jetons OAuth)
// et relayer la lecture de la liste des activités. Elle ne stocke rien.
//
// Variables à définir dans Cloudflare (voir LISEZMOI.md) :
//   STRAVA_CLIENT_ID      identifiant de l'application Strava (variable)
//   STRAVA_CLIENT_SECRET  secret de l'application Strava (secret chiffré, jamais dans le code)
//   ALLOWED_ORIGIN        adresse de l'outil, ex. https://moncompte.github.io (plusieurs : séparées par des virgules)

const STRAVA = 'https://www.strava.com';
// L'adresse d'échange des jetons est citée sous deux formes ; la seconde est essayée si la première répond 404.
const URLS_JETON = [STRAVA + '/oauth/token', STRAVA + '/api/v3/oauth/token'];
const ENTETES_LIMITES = 'X-RateLimit-Limit, X-RateLimit-Usage, X-ReadRateLimit-Limit, X-ReadRateLimit-Usage';

function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}

async function demanderJetons(env, params, cors) {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return json({ erreur: 'Fonction mal configurée : STRAVA_CLIENT_ID ou STRAVA_CLIENT_SECRET manquant.' }, 500, cors);
  const corps = new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params });
  let rep = null;
  for (const url of URLS_JETON) {
    rep = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corps.toString() });
    if (rep.status !== 404) break;
  }
  const d = await rep.json().catch(() => ({}));
  if (!rep.ok) return json({ erreur: 'Strava a refusé la demande de jeton.', statut: rep.status, detail: d.message || null }, rep.status === 400 || rep.status === 401 ? 401 : 502, cors);
  // On ne renvoie que ce dont l'outil a besoin (jamais le secret).
  return json({
    access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at,
    athlete: d.athlete ? { id: d.athlete.id, firstname: d.athlete.firstname || null } : null
  }, 200, cors);
}

export default {
  async fetch(request, env) {
    const origine = request.headers.get('Origin') || '';
    const autorisees = String(env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!autorisees.includes(origine)) return json({ erreur: 'Origine non autorisée.' }, 403, {});
    const cors = {
      'Access-Control-Allow-Origin': origine, 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Expose-Headers': ENTETES_LIMITES, 'Access-Control-Max-Age': '600'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    try {
      if (url.pathname === '/token' && request.method === 'POST') {
        const { code } = await request.json().catch(() => ({}));
        if (typeof code !== 'string' || !/^[\w.-]{1,200}$/.test(code)) return json({ erreur: 'Code d\'autorisation manquant ou invalide.' }, 400, cors);
        return demanderJetons(env, { code, grant_type: 'authorization_code' }, cors);
      }
      if (url.pathname === '/refresh' && request.method === 'POST') {
        const { refresh_token } = await request.json().catch(() => ({}));
        if (typeof refresh_token !== 'string' || !/^[\w.-]{1,200}$/.test(refresh_token)) return json({ erreur: 'Jeton de renouvellement manquant ou invalide.' }, 400, cors);
        return demanderJetons(env, { refresh_token, grant_type: 'refresh_token' }, cors);
      }
      if (url.pathname === '/activities' && request.method === 'GET') {
        const auth = request.headers.get('Authorization') || '';
        if (!/^Bearer [\w.-]{1,200}$/.test(auth)) return json({ erreur: 'Jeton d\'accès manquant.' }, 401, cors);
        const q = new URLSearchParams();
        for (const k of ['after', 'before', 'page', 'per_page']) {
          const v = url.searchParams.get(k);
          if (v === null) continue;
          if (!/^\d{1,12}$/.test(v)) return json({ erreur: 'Paramètre ' + k + ' invalide.' }, 400, cors);
          q.set(k, v);
        }
        const rep = await fetch(STRAVA + '/api/v3/athlete/activities?' + q.toString(), { headers: { Authorization: auth } });
        const h = { 'Content-Type': 'application/json; charset=utf-8', ...cors };
        for (const nom of ENTETES_LIMITES.split(', ')) { const v = rep.headers.get(nom); if (v) h[nom] = v; }
        return new Response(await rep.text(), { status: rep.status, headers: h });
      }
      return json({ erreur: 'Adresse inconnue.' }, 404, cors);
    } catch (e) {
      return json({ erreur: 'Strava injoignable depuis la fonction.' }, 502, cors);
    }
  }
};
