# Kirim Gambar — Image Upload + Cloudflare Worker (Pages Functions)

Website sederhana untuk upload gambar:
- dari penyimpanan (drag & drop / pilih file), atau
- dari link (gambar diunduh ulang lalu disimpan, jadi link hasil tetap awet).

Setiap gambar disimpan di **Cloudflare R2** dan disajikan lewat **Cloudflare Pages Functions**
(ini adalah Worker — Pages Functions berjalan di Workers runtime yang sama).
Frontend-nya HTML/CSS/JS biasa, tanpa build step, jadi tinggal di-push ke GitHub
dan dihubungkan ke Cloudflare Pages.

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
│       └── [id].js            # GET  /images/:id  -> sajikan gambar dari R2
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

## Langkah 2 — Buat R2 bucket di Cloudflare

1. Login ke [dashboard Cloudflare](https://dash.cloudflare.com).
2. Buka menu **R2 Object Storage** → **Create bucket**.
3. Beri nama, misalnya `kirim-gambar-images`, lalu **Create bucket**.
4. (Tidak perlu mengatur akses publik — gambar disajikan lewat Worker/Function
   di `/images/:id`, jadi bucket boleh tetap private.)

## Langkah 3 — Hubungkan repo GitHub ke Cloudflare Pages

1. Di dashboard Cloudflare, buka **Workers & Pages** → **Create application** →
   tab **Pages** → **Connect to Git**.
2. Pilih repository yang baru di-push tadi.
3. Pada bagian **Build settings**:
   - **Framework preset**: `None`
   - **Build command**: *(kosongkan)*
   - **Build output directory**: `public`
4. Klik **Save and Deploy**. Pertama kali deploy ini akan gagal/parsial karena
   `IMAGE_BUCKET` belum di-binding — lanjut ke langkah 4, lalu redeploy.

## Langkah 4 — Hubungkan R2 bucket ke project Pages

1. Buka project Pages yang baru dibuat → **Settings** → **Functions**.
2. Scroll ke **R2 bucket bindings** → **Add binding**.
3. Isi:
   - **Variable name**: `IMAGE_BUCKET` (harus sama persis, ini dipakai di kode)
   - **R2 bucket**: pilih `kirim-gambar-images` (bucket dari langkah 2)
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
wrangler pages dev public
```

Wrangler akan membaca `wrangler.toml` dan membuat binding R2 lokal secara otomatis.

## Catatan

- Batas ukuran upload: 10MB per gambar (bisa diubah lewat konstanta `MAX_SIZE`
  di `functions/api/upload.js` dan `functions/api/link.js`).
- Tipe file yang didukung: JPG, PNG, GIF, WEBP, AVIF, SVG.
- Karena ini situs publik tanpa login, siapa saja yang punya akses ke URL bisa
  mengunggah. Jika perlu dibatasi, tambahkan autentikasi sederhana (misalnya
  cek header/password) di `functions/api/upload.js` dan `functions/api/link.js`.
