// POST /api/upload
// Form-data fields: file (File), name (string, wajib)

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg','image/png','image/gif',
  'image/webp','image/avif','image/svg+xml',
]);

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.IMAGE_KV)
    return json({ error: 'KV namespace belum dihubungkan ke project ini.' }, 500);

  let formData;
  try { formData = await request.formData(); }
  catch { return json({ error: 'Permintaan tidak valid.' }, 400); }

  const name = (formData.get('name') || '').trim();
  if (!name) return json({ error: 'Nama pengunggah tidak boleh kosong.' }, 400);

  const file = formData.get('file');
  if (!file || typeof file === 'string')
    return json({ error: 'Tidak ada file yang diunggah.' }, 400);

  if (!ALLOWED_TYPES.has(file.type))
    return json({ error: 'Tipe file tidak didukung. Gunakan JPG, PNG, GIF, WEBP, AVIF, atau SVG.' }, 400);

  if (file.size > MAX_SIZE)
    return json({ error: 'Ukuran file maksimal 10MB.' }, 400);

  const buffer = await file.arrayBuffer();
  const ext    = extFromType(file.type);
  const key    = `${crypto.randomUUID()}.${ext}`;

  await env.IMAGE_KV.put(key, buffer, {
    metadata: {
      contentType: file.type,
      uploaded: new Date().toISOString(),
      size: buffer.byteLength,
      name,
    },
  });

  const origin = new URL(request.url).origin;
  return json({ success: true, key, url: `${origin}/images/${key}`, name });
}

function extFromType(type) {
  const map = {
    'image/jpeg':'jpg','image/png':'png','image/gif':'gif',
    'image/webp':'webp','image/avif':'avif','image/svg+xml':'svg',
  };
  return map[type] || 'bin';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
