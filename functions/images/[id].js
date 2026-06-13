// GET /images/:id
// Menyajikan file gambar yang tersimpan di Workers KV.

export async function onRequestGet(context) {
  const { env, params } = context;
  const key = params.id;

  if (!env.IMAGE_KV) {
    return new Response('KV namespace belum dihubungkan ke project ini.', { status: 500 });
  }
  if (!key) {
    return new Response('Tidak ditemukan.', { status: 404 });
  }

  const { value, metadata } = await env.IMAGE_KV.getWithMetadata(key, { type: 'arrayBuffer' });
  if (!value) {
    return new Response('Gambar tidak ditemukan.', { status: 404 });
  }

  const contentType = (metadata && metadata.contentType) || 'application/octet-stream';

  return new Response(value, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
