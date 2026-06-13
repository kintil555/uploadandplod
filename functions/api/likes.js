// GET  /api/likes?key=<imageKey>  → { count, liked }
// POST /api/likes                 → toggle like { key } → { count, liked }

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ count: 0, liked: false });
  const url = new URL(request.url);
  const imageKey = url.searchParams.get('key');
  if (!imageKey) return json({ error: 'Parameter key diperlukan.' }, 400);
  const ip = getIp(request);
  const likeData = await getLikeData(env, imageKey);
  return json({ count: likeData.count, liked: likeData.ips.includes(ip) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ error: 'KV namespace belum dihubungkan.' }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Permintaan tidak valid.' }, 400); }

  const imageKey = (body.key || '').trim();
  if (!imageKey) return json({ error: 'Key gambar diperlukan.' }, 400);

  const ip       = getIp(request);
  const likeData = await getLikeData(env, imageKey);
  const alreadyLiked = likeData.ips.includes(ip);

  if (alreadyLiked) {
    likeData.ips   = likeData.ips.filter(i => i !== ip);
    likeData.count = Math.max(0, likeData.count - 1);
  } else {
    likeData.ips.push(ip);
    likeData.count += 1;
  }

  await env.IMAGE_KV.put(`likes:${imageKey}`, JSON.stringify(likeData));
  return json({ success: true, count: likeData.count, liked: !alreadyLiked });
}

async function getLikeData(env, imageKey) {
  const raw = await env.IMAGE_KV.get(`likes:${imageKey}`);
  return raw ? JSON.parse(raw) : { count: 0, ips: [] };
}

function getIp(request) {
  return request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-forwarded-for') ||
         'anon';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
