// GET /api/list → { images: [...] }
// Setiap item: { key, url, uploaded, size, name, likes }

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV) return json({ images: [] });

  try {
    const listed = await env.IMAGE_KV.list({ limit: 1000 });
    const origin = new URL(request.url).origin;

    // Filter hanya kunci gambar (bukan comments:/likes: prefix)
    const imageKeys = listed.keys.filter(k =>
      !k.name.startsWith('comments:') && !k.name.startsWith('likes:')
    );

    // Ambil likes count untuk semua gambar secara paralel
    const likePromises = imageKeys.map(k =>
      env.IMAGE_KV.get(`likes:${k.name}`)
        .then(raw => raw ? JSON.parse(raw).count : 0)
        .catch(() => 0)
    );
    const likeCounts = await Promise.all(likePromises);

    const images = imageKeys
      .map((k, i) => ({
        key:      k.name,
        url:      `${origin}/images/${k.name}`,
        uploaded: k.metadata && k.metadata.uploaded,
        size:     k.metadata && k.metadata.size,
        name:     (k.metadata && k.metadata.name) || '',
        likes:    likeCounts[i],
      }))
      .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0))
      .slice(0, 24);

    return json({ images });
  } catch (err) {
    return json({ images: [], error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
