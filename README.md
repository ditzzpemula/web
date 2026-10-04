# GreenCloud Auto SA-MP

Auto-create server SA-MP melalui Pterodactyl Application API.

## Konfigurasi

1. Install Node.js 18+.
2. Copy `.env.example` menjadi `.env`.
3. Isi `PTERODACTYL_API_KEY`.
4. Jangan pernah memasukkan API key ke `public/index.html`.
5. Pastikan allocation pada Node 1 tersedia untuk port 7000-7777.
6. Jalankan:

```bash
npm install
npm start
```

Website berjalan di port 3000.

## Konfigurasi yang sudah disiapkan

- Panel: https://greencloud.biz.id
- Node ID: 1
- Nest ID: 5
- Egg ID: 15 (SAMP)
- RAM: 2048 MB
- Disk: 2048 MB
- CPU: 100%
- Port range: 7000-7777

## Reverse proxy

Gunakan Nginx/Cloudflare untuk meneruskan domain/subdomain ke `127.0.0.1:3000`.

## Penting

Application API Key harus memiliki izin yang cukup untuk membuat user dan server. Untuk keamanan, gunakan key khusus dan jangan kirim key tersebut melalui chat atau commit ke GitHub.

Jika Pterodactyl mengembalikan error tentang allocation/location, isi `LOCATION_ID` di `.env` dengan ID Location pada panel.
