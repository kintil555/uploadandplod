// POST /api/link
// Body JSON: { "url": "https://..." }
// Mengunduh gambar dari URL yang diberikan dan menyimpannya ke R2,
// sehingga link hasil tetap aktif walau URL aslinya berubah/hilang.

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.IMAGE_BUCKET) {
    return json({ error: 'Bucket R2 belum dihubungkan ke project ini.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Permintaan tidak valid.' }, 400);
  }

  const sourceUrl = (body && body.url || '').trim();
  if (!sourceUrl) {
    return json({ error: 'Link gambar tidak boleh kosong.' }, 400);
  }

  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return json({ error: 'Link tidak valid.' }, 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json({ error: 'Link harus menggunakan http atau https.' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KirimGambarBot/1.0)' },
    });
  } catch {
    return json({ error: 'Gagal mengambil gambar dari link tersebut.' }, 400);
  }

  if (!upstream.ok) {
    return json({ error: `Gagal mengambil gambar (status ${upstream.status}).` }, 400);
  }

  const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'Link tersebut bukan gambar yang didukung (JPG, PNG, GIF, WEBP, AVIF, SVG).' }, 400);
  }

  const contentLength = upstream.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_SIZE) {
    return json({ error: 'Ukuran gambar maksimal 10MB.' }, 400);
  }

  // Baca ke buffer supaya bisa dicek ukurannya sebelum disimpan,
  // untuk kasus server asal tidak mengirim content-length.
  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_SIZE) {
    return json({ error: 'Ukuran gambar maksimal 10MB.' }, 400);
  }
  if (buffer.byteLength === 0) {
    return json({ error: 'Gambar dari link tersebut kosong.' }, 400);
  }

  const ext = extFromType(contentType);
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.IMAGE_BUCKET.put(key, buffer, {
    httpMetadata: { contentType },
  });

  const origin = new URL(request.url).origin;
  return json({ success: true, key, url: `${origin}/images/${key}` });
}

function extFromType(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  return map[type] || 'bin';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
