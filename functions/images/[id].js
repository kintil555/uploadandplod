// GET /images/:id
// Menyajikan file gambar yang tersimpan di R2.

export async function onRequestGet(context) {
  const { env, params } = context;
  const key = params.id;

  if (!env.IMAGE_BUCKET) {
    return new Response('Bucket R2 belum dihubungkan ke project ini.', { status: 500 });
  }
  if (!key) {
    return new Response('Tidak ditemukan.', { status: 404 });
  }

  const object = await env.IMAGE_BUCKET.get(key);
  if (!object) {
    return new Response('Gambar tidak ditemukan.', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
