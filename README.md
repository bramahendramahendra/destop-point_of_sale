# POS Retail - Step 1

Aplikasi Point of Sale (POS) Desktop untuk Toko Retail menggunakan Electron.

## Teknologi Stack
- **Electron** - Framework untuk aplikasi desktop
- **Vanilla JavaScript** - Tanpa framework frontend
- **SQLite (better-sqlite3)** - Database lokal
- **bcryptjs** - Enkripsi password

## Instalasi

### 1. Clone atau Download Project
```bash
cd pos-retail
```

### 2. Install Dependencies
```bash
npm install
```

Tunggu hingga semua package terinstall (Electron, better-sqlite3, bcryptjs)

## Menjalankan Aplikasi

### Mode Normal
```bash
npm start
```

### Mode Development (dengan DevTools)
```bash
npm run dev
```

## Login Default

Gunakan kredensial berikut untuk login pertama kali:

- **Username:** admin
- **Password:** admin123

## Fitur Step 1

### ✅ Yang Sudah Berfungsi:
- Login system dengan autentikasi
- Enkripsi password menggunakan bcrypt
- Dashboard dengan navbar dan sidebar
- Logout functionality
- Database SQLite otomatis terbuat
- Session management dengan localStorage
- Responsive UI

### 🚧 Status Development

- ✅ **STEP 1: Login & Dashboard Basic** - DONE
- ✅ **STEP 2: User Management** - DONE
- ✅ **STEP 3: Category & Product Management** - DONE
- ✅ **STEP 4: Kasir & Transaksi** - DONE
- ⏳ STEP 5: Finance - Coming Soon
- ⏳ STEP 6: Reports - Coming Soon

## Testing Step 1

Lakukan testing dengan langkah berikut:

1. ✅ Jalankan: `npm start`
2. ✅ Aplikasi Electron terbuka
3. ✅ Login page tampil dengan baik
4. ✅ Login dengan username: **admin**, password: **admin123**
5. ✅ Berhasil masuk ke dashboard
6. ✅ Navbar menampilkan nama "Administrator" dan role "owner"
7. ✅ Sidebar menu tersedia (menu lain disabled)
8. ✅ Klik tombol "Logout" → kembali ke login page
9. ✅ Coba login dengan password salah → muncul error message
10. ✅ File database `pos-retail.db` terbuat di root folder

## Testing Step 2

1. ✅ Login sebagai admin (admin/admin123)
2. ✅ Klik menu "Pengguna" di sidebar
3. ✅ Harus tampil halaman users dengan tabel (hanya ada user admin)
4. ✅ Klik "Tambah User Baru"
5. ✅ Isi form:
   - Username: kasir01
   - Nama Lengkap: Kasir Satu
   - Role: Kasir
   - Password: kasir123
   - Konfirmasi Password: kasir123
6. ✅ Klik "Simpan" → user baru muncul di tabel
7. ✅ Klik edit user kasir01 → form terisi otomatis
8. ✅ Ubah nama menjadi "Kasir Pertama", klik "Update" → perubahan tersimpan
9. ✅ Toggle status user → status berubah di tabel (badge hijau/merah)
10. ✅ Klik hapus user → muncul konfirmasi → user terhapus
11. ✅ Tambah user baru dengan role admin
12. ✅ Logout, login dengan user baru yang dibuat
13. ✅ Cek apakah menu "Pengguna" muncul sesuai role
14. ✅ Login sebagai kasir → menu "Pengguna" tidak muncul
15. ✅ Coba akses langsung users.html sebagai kasir → redirect ke dashboard

## Testing Step 3

1. ✅ Restart aplikasi (untuk init database baru)
2. ✅ Login dengan admin/admin123
3. ✅ Klik menu "Produk" di sidebar
4. ✅ Harus tampil tab "Produk" dan "Kategori"
5. ✅ Tab Kategori: Lihat 5 kategori sample
6. ✅ Tab Produk: Lihat 15 produk sample
7. ✅ Klik "Tambah Kategori" → Isi form → Simpan → Kategori baru muncul
8. ✅ Edit kategori → Update → Perubahan tersimpan
9. ✅ Hapus kategori yang tidak punya produk → Berhasil
10. ✅ Coba hapus kategori yang punya produk → Muncul error
11. ✅ Klik "Tambah Produk" → Isi form manual
12. ✅ Klik "Generate" barcode → Barcode otomatis terisi
13. ✅ Isi harga beli & jual → Margin % otomatis terhitung
14. ✅ Coba isi harga jual < harga beli → Muncul error validasi
15. ✅ Simpan produk → Produk baru muncul di tabel
16. ✅ Edit produk → Update → Perubahan tersimpan
17. ✅ Toggle status produk → Status berubah
18. ✅ Hapus produk → Konfirmasi → Produk terhapus
19. ✅ Search produk by nama/barcode → Filter berfungsi
20. ✅ Filter by kategori → Hanya produk kategori itu yang muncul
21. ✅ Filter "Stok Menipis" → Hanya produk dengan stok < min_stock
22. ✅ Lihat badge stok: merah (habis), kuning (menipis), hijau (aman)

## Testing Step 4

### Kasir Page:
1. ✅ Restart aplikasi (untuk init database baru dengan table transaksi)
2. ✅ Login sebagai kasir atau admin
3. ✅ Klik menu "Kasir"
4. ✅ Ketik nama produk di search → dropdown muncul dengan suggestions
5. ✅ Pilih produk dari dropdown → produk masuk ke cart
6. ✅ Scan barcode (ketik barcode + Enter) → produk masuk ke cart
7. ✅ Ubah qty dengan button +/- → qty berubah, subtotal update
8. ✅ Klik X untuk hapus item → item terhapus dari cart
9. ✅ Tambah beberapa produk ke cart
10. ✅ Klik toggle diskon → pilih % atau Rp
11. ✅ Isi nilai diskon 10% → diskon auto-calculate
12. ✅ Isi pajak 11% → pajak auto-calculate
13. ✅ Cek total akhir sudah benar
14. ✅ Tekan F8 atau klik "BAYAR" → modal pembayaran muncul
15. ✅ Input uang dibayar kurang dari total → warning muncul, button disabled
16. ✅ Input uang dibayar lebih dari total → kembalian auto-calculate
17. ✅ Klik "Proses Pembayaran" → transaksi tersimpan
18. ✅ Struk terbuka di window baru
19. ✅ Print dialog muncul otomatis
20. ✅ Print atau close struk
21. ✅ Kembali ke kasir → cart sudah kosong
22. ✅ Cek halaman Produk → stock berkurang sesuai qty yang dijual

### Transactions Page:
1. ✅ Klik menu "Transaksi"
2. ✅ Tampil tabel transaksi dengan data transaksi yang baru dibuat
3. ✅ Cek summary card: Total penjualan & jumlah transaksi
4. ✅ Filter by date range → transaksi terfilter
5. ✅ Search by kode transaksi → transaksi terfilter
6. ✅ Filter by kasir → transaksi terfilter
7. ✅ Filter by metode bayar → transaksi terfilter
8. ✅ Klik icon mata (👁️) → modal detail terbuka
9. ✅ Modal menampilkan semua info transaksi & items
10. ✅ Klik "Print Ulang" → struk terbuka di window baru
11. ✅ Login sebagai owner/admin
12. ✅ Klik "Void Transaksi" → konfirmasi muncul
13. ✅ Konfirmasi void → transaksi status jadi void
14. ✅ Cek halaman Produk → stock kembali (dikembalikan)
15. ✅ Kembali ke Transaksi → status transaksi jadi "Void" (badge merah)

### Keyboard Shortcuts:
1. ✅ Tekan F2 → focus ke input search produk
2. ✅ Tekan F8 → modal pembayaran terbuka (jika cart ada isi)
3. ✅ Tekan F9 → draft tersimpan
4. ✅ Tekan ESC → konfirmasi batal transaksi muncul

### Stock Mutations:
1. ✅ Setiap transaksi penjualan → stock berkurang
2. ✅ Setiap void transaksi → stock dikembalikan
3. ✅ Stock mutations tercatat di database (cek dengan SQL viewer)

## Struktur Folder
```
pos-retail/
├── package.json              # NPM configuration
├── main.js                   # Electron main process
├── preload.js               # Electron preload script
├── pos-retail.db            # SQLite database (auto-generated)
├── database/
│   ├── db.js                # Database connection & helpers
│   └── init.js              # Database initialization
├── src/
│   ├── views/
│   │   ├── login.html       # Login page
│   │   └── dashboard.html   # Dashboard page
│   ├── css/
│   │   └── style.css        # Global styles
│   └── js/
│       ├── auth.js          # Authentication utilities
│       └── dashboard.js     # Dashboard functionality
└── README.md                # This file
```

## Troubleshooting

### Error saat `npm install`
- Pastikan Node.js sudah terinstall (minimal v16)
- Pastikan npm sudah terinstall
- Coba hapus folder `node_modules` dan file `package-lock.json`, lalu install ulang

### Aplikasi tidak bisa dibuka
- Cek console untuk error messages
- Pastikan semua dependencies terinstall dengan benar
- Jalankan dengan mode dev: `npm run dev` untuk melihat DevTools

### Login gagal terus
- Pastikan database sudah terinisialisasi
- Cek file `pos-retail.db` ada di root folder
- Gunakan kredensial default: admin / admin123

### Database error
- Hapus file `pos-retail.db`
- Jalankan ulang aplikasi, database akan dibuat otomatis

## Next Steps

Setelah Step 1 selesai, development akan dilanjutkan dengan:
- **Step 2:** User Management (CRUD users, role management)
- **Step 3:** Product Management (CRUD products, categories, stock)
- **Step 4:** Cashier/Transaction (POS interface, cart, payment)
- **Step 5:** Finance (income, expense, profit tracking)
- **Step 6:** Reports (sales reports, financial reports, exports)

## Support

Jika ada pertanyaan atau issue, silakan dokumentasikan di testing checklist.

---

**Version:** 1.0.0 - Step 1  
**Last Updated:** 2026-02-12