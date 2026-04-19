# Testing Checklist — POS Retail System

> Platform: Electron + SQLite | Tanggal dibuat: 2026-04-19
> Cara pakai: centang `[x]` setiap item yang sudah diuji. Catat hasil di kolom **Hasil**.

---

## 1. Autentikasi & Akses

| # | Skenario | Role | Hasil | Catatan |
|---|----------|------|-------|---------|
| 1.1 | Login dengan username & password benar | Owner | | |
| 1.2 | Login dengan username & password benar | Admin | | |
| 1.3 | Login dengan username & password benar | Kasir | | |
| 1.4 | Login dengan password salah — harus muncul pesan error | Semua | | |
| 1.5 | Login dengan username kosong — harus ditolak | Semua | | |
| 1.6 | Logout dari aplikasi — sesi berakhir, kembali ke halaman login | Semua | | |
| 1.7 | Menu/fitur terbatas sesuai role (kasir tidak bisa akses laporan keuangan, dll.) | Kasir | | |
| 1.8 | PIN entry (jika ada fitur PIN) — PIN benar bisa masuk | Semua | | |
| 1.9 | PIN entry — PIN salah ditolak | Semua | | |
| 1.10 | Tambah user baru dari halaman Settings | Owner | | |
| 1.11 | Edit user (ubah password, role) | Owner | | |
| 1.12 | Hapus user (tidak bisa hapus diri sendiri) | Owner | | |

---

## 2. Produk

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 2.1 | Tambah produk baru dengan semua field (nama, barcode, harga, stok, kategori) | | |
| 2.2 | Tambah produk — nama kosong harus ditolak | | |
| 2.3 | Tambah produk — barcode duplikat harus ditolak | | |
| 2.4 | Edit produk yang sudah ada | | |
| 2.5 | Hapus produk | | |
| 2.6 | Cari produk berdasarkan nama | | |
| 2.7 | Cari produk berdasarkan barcode | | |
| 2.8 | Scan barcode menggunakan scanner hardware | | |
| 2.9 | Cetak label barcode produk | | |
| 2.10 | Import produk via file Excel (.xlsx) | | |
| 2.11 | Import produk via file CSV | | |
| 2.12 | Import produk — file tidak valid harus muncul error | | |
| 2.13 | Notifikasi stok rendah muncul ketika stok di bawah minimum | | |
| 2.14 | Harga jual lebih besar dari harga beli | | |
| 2.15 | Diskon per item — diskon tersimpan dan terhitung benar | | |
| 2.16 | Filter produk berdasarkan kategori | | |

---

## 3. Kategori Produk

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 3.1 | Tambah kategori baru | | |
| 3.2 | Edit nama kategori | | |
| 3.3 | Hapus kategori — pastikan produk terkait tidak ikut terhapus | | |
| 3.4 | Kategori kosong/duplikat ditolak | | |

---

## 4. Transaksi Penjualan (Kasir)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 4.1 | Tambah item ke keranjang via pencarian nama | | |
| 4.2 | Tambah item ke keranjang via scan barcode | | |
| 4.3 | Ubah jumlah item di keranjang | | |
| 4.4 | Hapus item dari keranjang | | |
| 4.5 | Kosongkan seluruh keranjang | | |
| 4.6 | Terapkan diskon per item | | |
| 4.7 | Terapkan diskon keseluruhan transaksi | | |
| 4.8 | Bayar tunai — kembalian terhitung benar | | |
| 4.9 | Bayar dengan metode non-tunai (transfer/QRIS) | | |
| 4.10 | Bayar dengan piutang (kredit pelanggan) | | |
| 4.11 | Bayar lebih dari total — kembalian benar | | |
| 4.12 | Bayar kurang dari total — harus ditolak atau masuk piutang | | |
| 4.13 | Cetak struk setelah transaksi berhasil | | |
| 4.14 | Stok produk berkurang otomatis setelah transaksi | | |
| 4.15 | Transaksi dengan pelanggan terdaftar (nama pelanggan tercatat) | | |
| 4.16 | Transaksi tanpa pelanggan (umum/guest) | | |
| 4.17 | Transaksi dibatalkan sebelum pembayaran — stok tidak berubah | | |
| 4.18 | Produk stok 0 tidak bisa ditambah ke keranjang | | |

---

## 5. Pelanggan (Customers)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 5.1 | Tambah pelanggan baru | | |
| 5.2 | Edit data pelanggan | | |
| 5.3 | Hapus pelanggan | | |
| 5.4 | Cari pelanggan berdasarkan nama/nomor telepon | | |
| 5.5 | Riwayat transaksi pelanggan tampil benar | | |

---

## 6. Piutang (Receivables)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 6.1 | Piutang tercatat ketika transaksi kredit | | |
| 6.2 | Pembayaran piutang — saldo berkurang | | |
| 6.3 | Pelunasan piutang penuh — status berubah lunas | | |
| 6.4 | Daftar piutang menampilkan total yang benar | | |
| 6.5 | Piutang per pelanggan bisa dilihat | | |

---

## 7. Supplier

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 7.1 | Tambah supplier baru | | |
| 7.2 | Edit data supplier | | |
| 7.3 | Hapus supplier | | |
| 7.4 | Cari supplier | | |

---

## 8. Kas Harian & Shift

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 8.1 | Buka shift — input modal awal | | |
| 8.2 | Tutup shift — ringkasan penjualan tampil benar | | |
| 8.3 | Riwayat shift tersimpan | | |
| 8.4 | Kas masuk/keluar manual tercatat | | |
| 8.5 | Saldo kas akhir shift = modal + penjualan tunai - pengeluaran | | |

---

## 9. Laporan (Reports)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 9.1 | Laporan penjualan harian — data sesuai transaksi hari ini | | |
| 9.2 | Laporan penjualan per rentang tanggal | | |
| 9.3 | Laporan laba/rugi terhitung benar | | |
| 9.4 | Laporan stok produk — jumlah sesuai | | |
| 9.5 | Laporan per kasir | | |
| 9.6 | Grafik dashboard tampil (penjualan, dll.) | | |
| 9.7 | Filter laporan berdasarkan kategori produk | | |
| 9.8 | Export laporan (jika ada fitur export) | | |

---

## 10. Keuangan (Finance / Jurnal)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 10.1 | Jurnal keuangan otomatis terbuat setelah transaksi | | |
| 10.2 | Entri manual jurnal keuangan | | |
| 10.3 | Saldo debit/kredit seimbang | | |
| 10.4 | Laporan keuangan menampilkan data yang benar | | |

---

## 11. Pengaturan (Settings)

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 11.1 | Ubah nama toko — tersimpan dan tampil di struk | | |
| 11.2 | Ubah alamat/nomor telepon toko | | |
| 11.3 | Ubah logo toko (jika ada) | | |
| 11.4 | Setting pajak (PPN) — terapkan ke transaksi | | |
| 11.5 | Setting format struk | | |

---

## 12. Database & Backup

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 12.1 | Backup database manual — file tersimpan di folder backups/ | | |
| 12.2 | Restore database dari file backup | | |
| 12.3 | Data tidak hilang setelah restart aplikasi | | |
| 12.4 | Aplikasi tidak crash jika database kosong/baru | | |

---

## 13. UI / UX & Edge Cases

| # | Skenario | Hasil | Catatan |
|---|----------|-------|---------|
| 13.1 | Semua tombol merespons klik | | |
| 13.2 | Form validasi — field wajib tidak boleh kosong | | |
| 13.3 | Pesan sukses/error tampil dengan jelas | | |
| 13.4 | Loading state saat operasi berat (import, laporan) | | |
| 13.5 | Keyboard shortcut kasir berfungsi | | |
| 13.6 | Angka negatif pada stok/harga ditolak | | |
| 13.7 | Input angka sangat besar (overflow) ditangani | | |
| 13.8 | Aplikasi bisa di-minimize, maximize, close | | |
| 13.9 | Performa: 1000+ produk — halaman produk tidak lag | | |
| 13.10 | Performa: transaksi dengan 50+ item — kasir tidak lag | | |

---

## Ringkasan Progress

| Modul | Total | Lulus | Gagal | Belum Diuji |
|-------|-------|-------|-------|-------------|
| Autentikasi | 12 | | | |
| Produk | 16 | | | |
| Kategori | 4 | | | |
| Transaksi (Kasir) | 18 | | | |
| Pelanggan | 5 | | | |
| Piutang | 5 | | | |
| Supplier | 4 | | | |
| Kas & Shift | 5 | | | |
| Laporan | 8 | | | |
| Keuangan | 4 | | | |
| Pengaturan | 5 | | | |
| Database & Backup | 4 | | | |
| UI / Edge Cases | 10 | | | |
| **TOTAL** | **100** | | | |
