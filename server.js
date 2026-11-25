// Pokémon Notebook server: serves the notebook page and looks up live card data + prices.
// Node 18+, no dependencies. Optional env var POKEMONTCG_API_KEY (free at dev.pokemontcg.io).
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const KEY = process.env.POKEMONTCG_API_KEY || '';
const API = 'https://api.pokemontcg.io/v2/cards';

async function api(params) {
  const r = await fetch(API + '?' + new URLSearchParams(params), { headers: KEY ? { 'X-Api-Key': KEY } : {} });
  if (!r.ok) throw new Error('Price source error ' + r.status + ' (try again in a moment)');
  return (await r.json()).data;
}
function slim(c) {
  const prices = {}, p = (c.tcgplayer && c.tcgplayer.prices) || {};
  for (const k in p) if (p[k].market != null) prices[k] = p[k].market; // ungraded market price
  return {
    id: c.id, name: c.name, set: c.set.name, number: c.number + '/' + c.set.printedTotal,
    rarity: c.rarity || '', type: (c.types || [])[0] || c.supertype, hp: c.hp || '',
    img: c.images && c.images.small, prices
  };
}
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
};
const clean = s => String(s || '').replace(/["\\]/g, '').trim();

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname;
  try {
    if (p === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(__dirname, 'index.html'))); }
    if (p === '/api/search') {
      const q = clean(u.searchParams.get('q')), set = clean(u.searchParams.get('set')), num = clean(u.searchParams.get('number')).split('/')[0];
      if (!q) return send(res, 400, { error: 'Type a card name' });
      let query = 'name:"' + q + '*"';
      if (set) query += ' set.name:"' + set + '*"';
      if (num) query += ' number:' + num;
      return send(res, 200, (await api({ q: query, pageSize: 24, orderBy: '-set.releaseDate' })).map(slim));
    }
    if (p === '/api/cards') {           // refresh prices for known card ids
      const ids = clean(u.searchParams.get('ids')).split(',').filter(Boolean).slice(0, 40);
      if (!ids.length) return send(res, 200, []);
      return send(res, 200, (await api({ q: ids.map(i => 'id:' + i).join(' OR '), pageSize: 40 })).map(slim));
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log('Pokémon Notebook running on port ' + PORT));
