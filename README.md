# Tips Kerja & CV

Situs statis untuk artikel cari kerja dan CV, toko template di Lynk.id, dan jasa website di Fiverr. Dikelola Yeyen Muhidin (Pati, Jawa Tengah).

Alamat yang direncanakan: `https://yeyenmuhidin.github.io/tips-kerja/`

Semua tautan di dalam situs bersifat relatif, jadi berkas ini bisa diunggah ke repositori `tips-kerja` tanpa mengubah menu.

## Struktur halaman

- `index.html` — beranda
- `artikel/index.html` — daftar artikel, plus pencarian di peramban
- `artikel/*.html` — satu berkas per artikel (ada tombol bagikan WhatsApp, Facebook, dan salin tautan)
- `generator-surat-lamaran.html` — merangkai surat lamaran di peramban; data tidak dikirim ke server
- `toko.html` — empat produk Lynk.id plus tautan jasa
- `jasa.html` — jasa website
- `tentang.html`, `kontak.html`, `kebijakan-privasi.html`
- `css/styles.css`, `js/nav.js`, `js/share.js`, `js/search.js`, `js/generator-surat.js`, `js/articles.json`, `img/`, `favicon.svg`
- `sitemap.xml`, `robots.txt`

Tidak ada buletin atau formulir langganan.

## Cara menambah artikel baru

Tidak perlu menjalankan skrip. Salin satu artikel yang sudah ada, lalu perbarui beberapa berkas.

1. Buat berkas baru di `artikel/`, misalnya `artikel/cara-menulis-ringkasan-cv.html`. Pakai huruf kecil, pisahkan kata dengan tanda minus.
2. Isi mengikuti artikel lama:
   - `title` dan `meta name="description"`
   - `link rel="canonical"` dan tag Open Graph (`og:url` mengarah ke URL artikel baru)
   - satu `h1` yang sama dengan judul
   - subjudul `h2` / `h3` berurutan
   - JSON-LD `Article` (judul, tanggal terbit, penulis Yeyen Muhidin)
   - tautan internal ke 2–3 artikel terkait di bagian “Baca juga”
   - kotak promo yang relevan ke produk di `toko.html` atau ke `jasa.html` (secara alami, jangan memaksa)
   - biarkan `<div class="ad-slot" …>` yang sudah ada; jangan diisi iklan palsu
3. Tulis 800–1.200 kata, bahasa Indonesia yang jelas, tanpa angka atau kutipan yang mengada-ada.
4. Tambahkan kartu artikel di:
   - `artikel/index.html`
   - `index.html` (bagian Artikel terbaru; taruh yang paling baru di depan)
5. Tambahkan URL lengkap ke `sitemap.xml`.
6. Dari 1–2 artikel lama yang temanya dekat, tambahkan tautan ke artikel baru di “Baca juga”.
7. Tambahkan entri di `js/articles.json` (judul, deskripsi, tanggal, slug) agar pencarian di daftar artikel ikut terbarui.

Tanggal di halaman daftar dan di dalam artikel harus sama.

## Iklan (AdSense)

Kotak `.ad-slot` sengaja kosong dan disembunyikan di CSS. Jangan menaruh gambar “ruang iklan” palsu.

Jika AdSense sudah disetujui:

1. Tambahkan class `ads-enabled` pada tag `<html>` di setiap halaman yang akan menayangkan iklan, atau cukup di templat halaman artikel, toko, dan beranda.
2. Tempel unit iklan resmi Google di dalam `div.ad-slot`.
3. Perbarui `kebijakan-privasi.html` (tanggal dan bagian cookie/iklan) agar sesuai keadaan baru.


## Penghitung pengunjung

Setiap halaman memuat cuplikan Google Analytics 4 (Measurement ID `G-C25Q0B5VDX`) di bagian `<head>` untuk menghitung kunjungan. Jangan menggandakan cuplikan itu. Data di generator surat lamaran tetap hanya diproses di peramban, tidak dikirim ke Analytics. Penjelasan untuk pengunjung ada di `kebijakan-privasi.html`.

## Unggah

Salin isi folder (termasuk subfolder) ke repositori GitHub `tips-kerja`, atau pakai folder datar `yeyen-site-upload` / arsip zip yang disiapkan bersama situs ini. Jangan unggah folder `shots/`; itu hanya bukti tampilan.
