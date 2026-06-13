// GET /api/list
// Mengambil daftar gambar terbaru dari Workers KV untuk ditampilkan di galeri.

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.IMAGE_KV) {
    return json({ images: [] });
  }

  try {
    const listed = await env.IMAGE_KV.list({ limit: 1000 });
    const origin = new URL(request.url).origin;

    const images = listed.keys
      .map((k) => ({
        key: k.name,
        url: `${origin}/images/${k.name}`,
        uploaded: k.metadata && k.metadata.uploaded,
        size: k.metadata && k.metadata.size,
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
