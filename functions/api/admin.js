// Admin API — hanya bisa diakses dengan ADMIN_SECRET yang di-set di env Cloudflare
// 
// Cara pakai dari browser console:
//   window._admin('set-nsfw', { key: 'abc.jpg', nsfw: true })
//   window._admin('delete', { key: 'abc.jpg' })
//   window._admin('set-name', { key: 'abc.jpg', name: 'Nama Baru' })
//   window._admin('set-comment-delete', { key: 'abc.jpg', commentId: 'uuid' })
//   window._admin('list-all', {})
//
// Endpoint: POST /api/admin
// Body: { secret, action, payload }

export async function onRequestPost(context) {
  const { request, env } = context;

  // ADMIN_SECRET wajib di-set di Cloudflare Pages env vars
  const ADMIN_SECRET = env.ADMIN_SECRET;
  if (!ADMIN_SECRET) {
    return json({ error: 'ADMIN_SECRET belum dikonfigurasi di environment.' }, 503);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Request tidak valid.' }, 400); }

  // Cek secret
  if (!body.secret || body.secret !== ADMIN_SECRET) {
    return json({ error: 'Akses ditolak.' }, 403);
  }

  if (!env.IMAGE_KV) return json({ error: 'KV namespace belum dihubungkan.' }, 500);

  const action  = body.action || '';
  const payload = body.payload || {};

  // ── SET NSFW FLAG ──────────────────────────────────────
  if (action === 'set-nsfw') {
    const { key, nsfw } = payload;
    if (!key) return json({ error: 'key diperlukan.' }, 400);

    const existing = await env.IMAGE_KV.getWithMetadata(key);
    if (!existing || existing.value === null) return json({ error: 'Gambar tidak ditemukan.' }, 404);

    const meta = { ...(existing.metadata || {}), nsfw: !!nsfw };
    // Re-put dengan metadata baru, content tidak berubah
    await env.IMAGE_KV.put(key, existing.value, { metadata: meta });
    return json({ success: true, key, nsfw: meta.nsfw });
  }

  // ── DELETE GAMBAR ──────────────────────────────────────
  if (action === 'delete') {
    const { key } = payload;
    if (!key) return json({ error: 'key diperlukan.' }, 400);
    await env.IMAGE_KV.delete(key);
    await env.IMAGE_KV.delete(`likes:${key}`);
    await env.IMAGE_KV.delete(`comments:${key}`);
    return json({ success: true, deleted: key });
  }

  // ── EDIT NAMA PENGUNGGAH ───────────────────────────────
  if (action === 'set-name') {
    const { key, name } = payload;
    if (!key || !name) return json({ error: 'key dan name diperlukan.' }, 400);

    const existing = await env.IMAGE_KV.getWithMetadata(key);
    if (!existing || existing.value === null) return json({ error: 'Gambar tidak ditemukan.' }, 404);

    const meta = { ...(existing.metadata || {}), name };
    await env.IMAGE_KV.put(key, existing.value, { metadata: meta });
    return json({ success: true, key, name });
  }

  // ── HAPUS KOMENTAR SPESIFIK ────────────────────────────
  if (action === 'delete-comment') {
    const { key, commentId } = payload;
    if (!key || !commentId) return json({ error: 'key dan commentId diperlukan.' }, 400);

    const raw = await env.IMAGE_KV.get(`comments:${key}`);
    const comments = raw ? JSON.parse(raw) : [];
    const filtered = comments.filter(c => c.id !== commentId);
    if (filtered.length === comments.length)
      return json({ error: 'Komentar tidak ditemukan.' }, 404);

    await env.IMAGE_KV.put(`comments:${key}`, JSON.stringify(filtered));
    return json({ success: true, deleted: commentId, remaining: filtered.length });
  }

  // ── HAPUS SEMUA KOMENTAR SATU GAMBAR ──────────────────
  if (action === 'clear-comments') {
    const { key } = payload;
    if (!key) return json({ error: 'key diperlukan.' }, 400);
    await env.IMAGE_KV.put(`comments:${key}`, JSON.stringify([]));
    return json({ success: true, cleared: key });
  }

  // ── LIST SEMUA GAMBAR (tanpa batas 24) ────────────────
  if (action === 'list-all') {
    const listed = await env.IMAGE_KV.list({ limit: 1000 });
    const origin = new URL(request.url).origin;
    const imageKeys = listed.keys.filter(k =>
      !k.name.startsWith('comments:') &&
      !k.name.startsWith('likes:') &&
      !k.name.startsWith('meta:')
    );
    const images = imageKeys.map(k => ({
      key:      k.name,
      url:      `${origin}/images/${k.name}`,
      uploaded: k.metadata && k.metadata.uploaded,
      name:     k.metadata && k.metadata.name,
      nsfw:     !!(k.metadata && k.metadata.nsfw),
    })).sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
    return json({ success: true, total: images.length, images });
  }

  // ── RESET LIKES SATU GAMBAR ────────────────────────────
  if (action === 'reset-likes') {
    const { key } = payload;
    if (!key) return json({ error: 'key diperlukan.' }, 400);
    await env.IMAGE_KV.put(`likes:${key}`, JSON.stringify({ count: 0, ips: [] }));
    return json({ success: true, key });
  }

  return json({ error: `Action tidak dikenal: ${action}` }, 400);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
