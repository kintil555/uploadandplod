// GET /api/list?page=1&limit=12 → { images: [...], total, page, hasMore }
// Setiap item: { key, url, uploaded, size, name, likes }
// Optimasi: ambil likes hanya untuk gambar yang ditampilkan (bukan semua)

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ images: [], total: 0, page: 1, hasMore: false });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit  = Math.min(24, Math.max(1, parseInt(url.searchParams.get('limit') || '12')));
  const showNsfw = url.searchParams.get('nsfw') === '1';
  const origin = url.origin;

  try {
    const listed = await env.IMAGE_KV.list({ limit: 1000 });

    // Filter hanya kunci gambar (bukan comments:/likes: prefix)
    const imageKeys = listed.keys.filter(k =>
      !k.name.startsWith('comments:') && !k.name.startsWith('likes:')
    );

    // Sort by upload date (newest first) — metadata sudah ada, tidak perlu KV fetch lagi
    const sorted = imageKeys
      .map(k => ({
        key:      k.name,
        url:      `${origin}/images/${k.name}`,
        uploaded: k.metadata && k.metadata.uploaded,
        size:     k.metadata && k.metadata.size,
        name:     (k.metadata && k.metadata.name) || '',
        nsfw:     !!(k.metadata && k.metadata.nsfw),
      }))
      .filter(img => showNsfw || !img.nsfw)  // sembunyikan NSFW kalau toggle off
      .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));

    const total   = sorted.length;
    const start   = (page - 1) * limit;
    const end     = start + limit;
    const pageItems = sorted.slice(start, end);
    const hasMore = end < total;

    // Ambil likes HANYA untuk gambar di halaman ini (bukan semua)
    const likePromises = pageItems.map(img =>
      env.IMAGE_KV.get(`likes:${img.key}`)
        .then(raw => raw ? JSON.parse(raw).count : 0)
        .catch(() => 0)
    );
    const likeCounts = await Promise.all(likePromises);
    const images = pageItems.map((img, i) => ({ ...img, likes: likeCounts[i] }));

    return json({ images, total, page, hasMore });
  } catch (err) {
    return json({ images: [], total: 0, page: 1, hasMore: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
