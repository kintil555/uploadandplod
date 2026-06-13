// GET  /api/comments?key=<imageKey>  → ambil komentar
// POST /api/comments                 → tambah komentar { key, name, comment }

const MAX_WORDS = 100;

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ comments: [] });
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Parameter key diperlukan.' }, 400);
  try {
    const raw = await env.IMAGE_KV.get(`comments:${key}`);
    return json({ comments: raw ? JSON.parse(raw) : [] });
  } catch {
    return json({ comments: [] });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ error: 'KV namespace belum dihubungkan.' }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Permintaan tidak valid.' }, 400); }

  const imageKey = (body.key || '').trim();
  const name     = (body.name || '').trim();
  const comment  = (body.comment || '').trim();

  if (!imageKey) return json({ error: 'Key gambar diperlukan.' }, 400);
  if (!name)     return json({ error: 'Nama tidak boleh kosong.' }, 400);
  if (!comment)  return json({ error: 'Komentar tidak boleh kosong.' }, 400);
  if (countWords(comment) > MAX_WORDS)
    return json({ error: `Komentar maksimal ${MAX_WORDS} kata.` }, 400);

  const raw      = await env.IMAGE_KV.get(`comments:${imageKey}`);
  const comments = raw ? JSON.parse(raw) : [];
  comments.push({ id: crypto.randomUUID(), name, comment, date: new Date().toISOString() });
  await env.IMAGE_KV.put(`comments:${imageKey}`, JSON.stringify(comments));
  return json({ success: true, comments });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
