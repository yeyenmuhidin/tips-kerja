# Barang Berguna — situs rekomendasi Shopee

Situs tayang di: https://yeyenmuhidin.github.io/tips-kerja/barang-berguna/

Situs statis sederhana berisi rekomendasi barang untuk pekerja pabrik dan keluarga. Bahasa Indonesia. Belum diterbitkan: tunggu pratinjau dan persetujuan dulu.

Dibuat untuk Yeyen Muhidin (Pati).

## Isi folder

- `index.html` — halaman utama
- `styles.css` — tampilan
- `app.js` — membaca data produk
- `products.json` — **file yang kamu edit** untuk mengisi link affiliate
- Huruf Plus Jakarta Sans sudah tertanam di `styles.css` (gratis, lisensi SIL OFL)

Tidak ada harga, rating, jumlah penjualan, atau testimoni. Itu disengaja agar halaman ini jujur.

## Cara mengisi link affiliate

1. Daftar Shopee Affiliate dulu di aplikasi atau situs Shopee (pakai KTP sendiri).
2. Di dasbor affiliate, salin link produk atau kata kunci yang ingin kamu bagikan.
3. Buka file `products.json`.
4. Pada setiap produk, ganti tulisan ini:

   `"link": "#ISI-LINK-AFFILIATE"`

   menjadi misalnya:

   `"link": "https://s.shopee.co.id/tautan-affiliate-kamu"`

5. Jangan hapus tanda kutip. Jangan ubah koma di akhir baris, kecuali pada produk terakhir di dalam daftar.
6. Simpan file. Muat ulang halaman, lalu klik tombol **Cek di Shopee** untuk memastikan link-nya benar.

Kamu juga boleh mengubah `nama`, `deskripsi`, atau `ikon` (emoji). Field `warna` merupa warna latar ikon, misalnya `#FFE0C8`.

Tombol baru akan membuka tab baru setelah link diisi dengan alamat `http` atau `https`. Selama masih `#ISI-LINK-AFFILIATE`, tombol terlihat sebagai "belum diisi".

## Cara melihat di komputer

Jangan hanya klik `index.html` (daftar produk bisa gagal muncul). Jalankan server lokal di folder ini, contoh:

```bash
python3 -m http.server 8080
```

Lalu buka `http://127.0.0.1:8080` di peramban.

## Catatan

- Halaman ini berisi pengumuman affiliate. Jangan dihapus.
- Belum ada akun GitHub atau alamat situs publik. Tunggu persetujuan dulu sebelum diterbitkan.
- Tidak memakai layanan berbayar.
