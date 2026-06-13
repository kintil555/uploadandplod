# Kirim Gambar — Image Upload + Cloudflare Worker (Pages Functions + KV)

Website sederhana untuk upload gambar:
- dari penyimpanan (drag & drop / pilih file), atau
- dari link (gambar diunduh ulang lalu disimpan, jadi link hasil tetap awet).

Setiap gambar disimpan di **Cloudflare Workers KV** dan disajikan lewat
**Cloudflare Pages Functions** (ini adalah Worker — Pages Functions berjalan
di Workers runtime yang sama). KV dipilih karena gratis, tidak perlu
mengaktifkan billing/R2, dan cukup untuk situs upload skala kecil-menengah.
Frontend-nya HTML/CSS/JS biasa, tanpa build step, jadi tinggal di-push ke
GitHub dan dihubungkan ke Cloudflare Pages.

## Struktur project

```
image-upload/
├── public/
│   └── index.html          # halaman utama (UI upload + galeri)
├── functions/
│   ├── api/
│   │   ├── upload.js        # POST /api/upload  -> simpan file dari device
│   │   ├── link.js           # POST /api/link    -> unduh & simpan dari URL
│   │   └── list.js            # GET  /api/list    -> daftar gambar terbaru
│   └── images/
│       └── [id].js            # GET  /images/:id  -> sajikan gambar dari KV
├── wrangler.toml
└── .gitignore
```

## Langkah 1 — Push ke GitHub

1. Buat repository baru di GitHub (boleh public atau private).
2. Di komputer kamu, masuk ke folder `image-upload/` lalu jalankan:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: kirim gambar"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```

## Langkah 2 — Buat KV namespace di Cloudflare

1. Login ke [dashboard Cloudflare](https://dash.cloudflare.com).
2. Buka **Workers & Pages** → menu samping **KV** (atau **Storage & Databases → KV**).
3. Klik **Create a namespace**, beri nama misalnya `kirim-gambar-images` →
   **Add**.
4. Tidak perlu mengisi/menambahkan apa pun ke dalamnya secara manual —
   namespace yang kosong ini akan diisi otomatis oleh fungsi upload.

## Langkah 3 — Hubungkan repo GitHub ke Cloudflare Pages

1. Di dashboard Cloudflare, buka **Workers & Pages** → **Create application** →
   tab **Pages** → **Connect to Git**.
2. Pilih repository yang baru di-push tadi.
3. Pada bagian **Build settings**:
   - **Framework preset**: `None`
   - **Build command**: *(kosongkan)*
   - **Build output directory**: `public`
4. Klik **Save and Deploy**. Pertama kali deploy ini akan jalan tapi upload
   belum berfungsi karena `IMAGE_KV` belum di-binding — lanjut ke langkah 4,
   lalu redeploy.

## Langkah 4 — Hubungkan KV namespace ke project Pages

1. Buka project Pages yang baru dibuat → **Settings** → **Functions**.
2. Scroll ke **KV namespace bindings** → **Add binding**.
3. Isi:
   - **Variable name**: `IMAGE_KV` (harus sama persis, ini dipakai di kode)
   - **KV namespace**: pilih `kirim-gambar-images` (namespace dari langkah 2)
4. **Save**.
5. Buka tab **Deployments** → pilih deployment terakhir → **Retry deployment**
   (atau push commit baru) supaya binding terbaca.

## Langkah 5 — Selesai 🎉

Buka URL project Pages kamu (contoh: `https://kirim-gambar.pages.dev`).
- Tab **Dari Perangkat**: drag & drop atau klik untuk pilih gambar.
- Tab **Dari Link**: tempel URL gambar, klik **Ambil & simpan**.
- Link hasil otomatis berbentuk `https://domain-kamu/images/<id>.<ext>`
  dan langsung muncul di galeri di bawahnya.

### Opsional: domain sendiri

Di **Settings** → **Custom domains**, tambahkan domain milikmu sendiri
agar link gambar terlihat lebih rapi.

### Pengujian lokal (opsional)

Kalau punya Node.js + Wrangler CLI:

```bash
npm install -g wrangler
wrangler kv namespace create kirim-gambar-images
# salin "id" yang muncul ke wrangler.toml, lalu:
wrangler pages dev public
```

## Catatan & batasan KV

- **Batas ukuran upload**: 10MB per gambar (bisa diubah lewat konstanta
  `MAX_SIZE` di `functions/api/upload.js` dan `functions/api/link.js`,
  maksimal 25MB karena itu limit value KV).
- **Total storage gratis**: 1GB. Kalau situs ramai dan butuh lebih dari itu,
  ganti ke Cloudflare R2 (tidak banyak yang berubah — cuma ganti
  `env.IMAGE_KV.put/get/list` jadi `env.IMAGE_BUCKET.put/get/list` ala R2 API).
- **Batas tulis gratis**: 1.000 operasi tulis (upload) per hari, dan 100.000
  pembacaan per hari. Untuk situs pribadi/komunitas kecil biasanya cukup.
- Tipe file yang didukung: JPG, PNG, GIF, WEBP, AVIF, SVG.
- Karena ini situs publik tanpa login, siapa saja yang punya akses ke URL bisa
  mengunggah. Jika perlu dibatasi, tambahkan autentikasi sederhana (misalnya
  cek header/password) di `functions/api/upload.js` dan `functions/api/link.js`.
