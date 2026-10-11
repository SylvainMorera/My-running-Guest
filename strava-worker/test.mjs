// Tests de la fonction relais, sans réseau : l'API Strava est remplacée par une fausse réponse.
// node strava-worker/test.mjs
import worker from './worker.js';
const env = { STRAVA_CLIENT_ID: '123', STRAVA_CLIENT_SECRET: 'SECRET-DE-TEST', ALLOWED_ORIGIN: 'https://exemple.github.io' };
const appels = [];
globalThis.fetch = async (url, opts = {}) => {
  appels.push({ url: String(url), opts });
  if (String(url).endsWith('/oauth/token')) {
    return new Response(JSON.stringify({ access_token: 'acc1', refresh_token: 'ref1', expires_at: 2000000000, athlete: { id: 42, firstname: 'Test', city: 'X' } }), { status: 200 });
  }
  if (String(url).includes('/api/v3/athlete/activities')) {
    return new Response('[{"id":1}]', { status: 200, headers: { 'X-ReadRateLimit-Usage': '1,1' } });
  }
  return new Response('{}', { status: 404 });
};
const req = (chemin, init = {}, origine = 'https://exemple.github.io') => new Request('https://w.example' + chemin, { ...init, headers: { Origin: origine, ...(init.headers || {}) } });
let ok = 0, ko = 0;
async function t(nom, f) { try { if (await f()) { ok++; console.log('OK    ' + nom); } else { ko++; console.log('ÉCHEC ' + nom); } } catch (e) { ko++; console.log('ÉCHEC ' + nom + ' — ' + e); } }

await t('Origine non autorisée -> 403, Strava non appelé', async () => { const n = appels.length; const r = await worker.fetch(req('/token', { method: 'POST', body: '{"code":"abc"}' }, 'https://pirate.example'), env); return r.status === 403 && appels.length === n; });
await t('Pré-vol CORS -> 204 avec l\'origine autorisée', async () => { const r = await worker.fetch(req('/token', { method: 'OPTIONS' }), env); return r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === 'https://exemple.github.io'; });
await t('Échange du code : secret envoyé à Strava, jamais renvoyé au navigateur', async () => {
  const r = await worker.fetch(req('/token', { method: 'POST', body: '{"code":"abc"}' }), env);
  const corps = await r.text(), envoi = appels[appels.length - 1];
  return r.status === 200 && !corps.includes('SECRET-DE-TEST') && !corps.includes('city') && JSON.parse(corps).refresh_token === 'ref1' &&
    envoi.opts.body.includes('client_secret=SECRET-DE-TEST') && envoi.opts.body.includes('grant_type=authorization_code') && envoi.opts.body.includes('code=abc');
});
await t('Renouvellement : grant_type=refresh_token', async () => { const r = await worker.fetch(req('/refresh', { method: 'POST', body: '{"refresh_token":"ref1"}' }), env); return r.status === 200 && appels[appels.length - 1].opts.body.includes('grant_type=refresh_token'); });
await t('Code invalide -> 400', async () => (await worker.fetch(req('/token', { method: 'POST', body: '{"code":"a b"}' }), env)).status === 400);
await t('Activités : paramètres relayés, jeton transmis, limites exposées', async () => {
  const r = await worker.fetch(req('/activities?after=1767225600&page=2&per_page=100', { headers: { Authorization: 'Bearer acc1' } }), env);
  const a = appels[appels.length - 1];
  return r.status === 200 && a.url === 'https://www.strava.com/api/v3/athlete/activities?after=1767225600&page=2&per_page=100' && a.opts.headers.Authorization === 'Bearer acc1' && r.headers.get('X-ReadRateLimit-Usage') === '1,1';
});
await t('Activités : paramètre non numérique -> 400', async () => (await worker.fetch(req('/activities?after=abc', { headers: { Authorization: 'Bearer acc1' } }), env)).status === 400);
await t('Activités sans jeton -> 401', async () => (await worker.fetch(req('/activities'), env)).status === 401);
await t('Secret absent de la configuration -> 500 explicite', async () => (await worker.fetch(req('/token', { method: 'POST', body: '{"code":"abc"}' }), { ...env, STRAVA_CLIENT_SECRET: '' })).status === 500);
console.log(`\n${ok} / ${ok + ko} tests réussis`);
process.exit(ko ? 1 : 0);
