// GET /api/list
// Mengambil daftar gambar terbaru dari R2 untuk ditampilkan di galeri.

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.IMAGE_BUCKET) {
    return json({ images: [] });
  }

  try {
    const listed = await env.IMAGE_BUCKET.list({ limit: 100 });
    const origin = new URL(request.url).origin;

    const images = listed.objects
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
      .slice(0, 24)
      .map((obj) => ({
        key: obj.key,
        url: `${origin}/images/${obj.key}`,
        uploaded: obj.uploaded,
        size: obj.size,
      }));

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
