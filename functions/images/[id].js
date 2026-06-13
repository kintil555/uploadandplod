// GET /images/:id               → serve image (inline)
// GET /images/:id?download=1    → force-download dengan nama file asli

export async function onRequestGet(context) {
  const { env, params, request } = context;
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
  const uploaderName = (metadata && metadata.name) || 'gambar';

  // Tentukan ekstensi dari contentType
  const extMap = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg',
  };
  const ext = extMap[contentType] || key.split('.').pop() || 'jpg';

  // Sanitize nama file untuk Content-Disposition
  const safeName = uploaderName.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  const filename = `${safeName}.${ext}`;

  const url = new URL(request.url);
  const isDownload = url.searchParams.get('download') === '1';

  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(value.byteLength),
    'Access-Control-Allow-Origin': '*',
  };

  if (isDownload) {
    // Force download dengan nama file yang benar
    headers['Content-Disposition'] = `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
  } else {
    // Inline tapi tetap kasih filename hint agar browser tahu ekstensinya
    headers['Content-Disposition'] = `inline; filename="${filename}"`;
  }

  return new Response(value, { headers });
}
