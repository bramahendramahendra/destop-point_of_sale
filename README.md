# POS Retail - Step 1

Aplikasi Point of Sale (POS) desktop untuk toko retail, dibangun dengan Electron + Vanilla JavaScript + SQLite.


## Teknologi Stack
- **Electron** - Framework untuk aplikasi desktop
- **Vanilla JavaScript** - Tanpa framework frontend
- **SQLite (better-sqlite3)** - Database lokal
- **bcryptjs** - Enkripsi password

## ✅ Fitur Lengkap

- Multi-user dengan role (Owner, Admin, Kasir)
- Manajemen Produk & Kategori (CRUD + barcode)
- Transaksi Penjualan (multi payment method, diskon, pajak)
- Manajemen Kas Harian per kasir
- Pengeluaran Operasional & Pembelian Stok
- Laporan Penjualan, Laba Rugi, Stok, Kasir
- Export PDF & Excel (via CDN library)
- Backup & Restore Database
- Settings & Konfigurasi Toko
- Keyboard Shortcuts Global
- Toast Notification System
- Loading States & Konfirmasi Dialog

🚀 Instalasi & Menjalankan

### Prasyarat
- Node.js >= 16.x
- npm >= 8.x

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

## 🔑 Login Default

Gunakan kredensial berikut untuk login pertama kali:

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | owner |

## ⌨️ Keyboard Shortcuts

| Shortcut      | Fungsi       |
|---------------|--------------|
| Ctrl+N        | Kasir        |
| Ctrl+P        | Produk       |
| Ctrl+T        | Transaksi    |
| Ctrl+F        | Keuangan     |
| Ctrl+Shift+R  | Laporan      |
| Ctrl+U        | Pengguna     |
| Ctrl+Shift+S  | Pengaturan   |
| Ctrl+L        | Logout       |



## 📦 Build untuk Distribusi

```bash
# Install electron-builder (sudah ada di devDependencies)
npm install

# Build Windows installer (.exe)
npm run build:win

# Build Linux AppImage
npm run build:linux

# Output ada di folder: dist/
```

> **Catatan Build:** Pastikan folder `assets/` berisi `icon.ico` (Windows) dan `icon.png` (Linux) sebelum build.



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
- ✅ **STEP 5: Keuangan - Kas, Pengeluaran, Pembelian** - DONE
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

## Testing Step 5

### Setup:
1. ✅ Hapus database lama: `rm pos-retail.db`
2. ✅ Restart aplikasi: `npm start`
3. ✅ Login dengan admin/admin123

### Kas Harian:
1. ✅ Klik menu "Keuangan"
2. ✅ Tab "Kas Harian" → Tampil tombol "Buka Kas"
3. ✅ Klik "Buka Kas" → Modal terbuka
4. ✅ Input saldo awal Rp 1.000.000 → Simpan
5. ✅ Status kas berubah jadi "Kas Terbuka" dengan info lengkap
6. ✅ Coba buka kas lagi → Error "Kas sudah dibuka hari ini"
7. ✅ Lakukan 2-3 transaksi penjualan dengan metode Cash
8. ✅ Cek status kas → Total penjualan cash bertambah
9. ✅ Tab "Pengeluaran" → Tambah pengeluaran (Cash, Rp 50.000)
10. ✅ Kembali ke "Kas Harian" → Total pengeluaran bertambah
11. ✅ Expected balance auto-calculate dengan benar
12. ✅ Klik "Tutup Kas" → Modal tutup kas terbuka
13. ✅ Input saldo akhir aktual (sama dengan expected)
14. ✅ Selisih = Rp 0 (hijau) → Simpan
15. ✅ Status kas berubah jadi "Closed"
16. ✅ History kas tampil di tabel

### Pengeluaran:
1. ✅ Tab "Pengeluaran" → Klik "Tambah Pengeluaran"
2. ✅ Pilih kategori: Operasional
3. ✅ Isi deskripsi: "Beli pulsa"
4. ✅ Isi jumlah: Rp 50.000
5. ✅ Pilih metode: Cash → Simpan
6. ✅ Pengeluaran muncul di tabel
7. ✅ Total pengeluaran terupdate
8. ✅ Edit pengeluaran → Update berhasil
9. ✅ Filter by kategori → Berfungsi
10. ✅ Filter by date range → Berfungsi
11. ✅ Hapus pengeluaran → Konfirmasi → Terhapus

### Pembelian:
1. ✅ Tab "Pembelian" → Klik "Tambah Pembelian"
2. ✅ Kode PO auto-generate (PO-YYYYMMDD-XXXX)
3. ✅ Input supplier: "Supplier ABC"
4. ✅ Klik "Tambah Item" → Modal item terbuka
5. ✅ Pilih produk: "Air Mineral 600ml"
6. ✅ Input qty: 100 → Harga beli auto-fill
7. ✅ Subtotal auto-calculate → Klik Tambah
8. ✅ Item muncul di tabel
9. ✅ Tambah 2-3 item lagi
10. ✅ Total pembelian auto-sum
11. ✅ Pilih status bayar: "Belum Bayar" → Simpan
12. ✅ Pembelian muncul di tabel
13. ✅ Cek halaman Produk → Stock bertambah sesuai qty
14. ✅ Klik "Detail" → Modal detail terbuka dengan items
15. ✅ Klik "Bayar" → Modal bayar terbuka
16. ✅ Input jumlah bayar (sebagian) → Proses
17. ✅ Status berubah jadi "Bayar Sebagian"
18. ✅ Sisa hutang terupdate
19. ✅ Bayar lagi sampai lunas → Status jadi "Lunas"
20. ✅ Filter by status → Berfungsi

### Dashboard Keuangan:
1. ✅ Tab "Dashboard Keuangan"
2. ✅ Summary cards tampil dengan data real:
   - Total Pendapatan
   - Total Pengeluaran
   - Laba Kotor
   - Laba Bersih
3. ✅ Quick stats tampil (total transaksi, avg, COGS)
4. ✅ Top 10 produk terlaris tampil dengan benar
5. ✅ Filter by date range → Data terupdate
6. ✅ Chart area tampil (placeholder atau data real)

### Integration Test:
1. ✅ Buka kas hari baru (ganti tanggal sistem)
2. ✅ Harus bisa buka kas lagi (karena hari baru)
3. ✅ Transaksi cash hari ini update kas yang baru
4. ✅ Pengeluaran hari ini update kas yang baru
5. ✅ Hapus pembelian → Stock dikembalikan
6. ✅ Stock mutations tercatat dengan benar

## Testing Step 5+ - Kas Saya (Kasir)

### Setup:
1. ✅ Restart aplikasi
2. ✅ Buat user kasir baru (jika belum ada)
3. ✅ Login sebagai kasir

### Test Menu Access:
1. ✅ Kasir BISA lihat menu "Kas Saya" ✅
2. ✅ Kasir TIDAK BISA lihat menu "Keuangan" ❌
3. ✅ Klik menu "Kas Saya" → Halaman terbuka

### Test Buka Kas:
1. ✅ Status: "Kas Belum Dibuka"
2. ✅ Klik "Buka Kas Sekarang" → Modal terbuka
3. ✅ Input saldo awal: Rp 500.000
4. ✅ Input catatan: "Shift pagi"
5. ✅ Klik "Buka Kas" → Konfirmasi muncul
6. ✅ Konfirmasi → Kas terbuka dengan status "KAS TERBUKA"
7. ✅ Info ditampilkan: waktu buka, saldo awal, penjualan, pengeluaran, expected, durasi

### Test Transaksi:
1. ✅ Klik menu "Kasir"
2. ✅ Lakukan 2-3 transaksi penjualan (payment: Cash)
3. ✅ Kembali ke "Kas Saya"
4. ✅ Total Penjualan Cash harus bertambah ✅
5. ✅ Expected Balance harus terupdate ✅
6. ✅ Durasi kas terupdate (misal: "2 jam 15 menit")

### Test Tutup Kas:
1. ✅ Klik "Tutup Kas" → Modal terbuka
2. ✅ Tampil: Saldo Awal, Penjualan Cash, Pengeluaran, Expected Balance
3. ✅ Hitung uang fisik di laci (simulasi)
4. ✅ Input saldo akhir aktual (misal: Rp 548.000)
5. ✅ Selisih auto-calculate dan ditampilkan (hijau/kuning/merah)
6. ✅ Input catatan (opsional)
7. ✅ Klik "Tutup Kas" → Konfirmasi muncul (dengan info selisih)
8. ✅ Konfirmasi → Kas ditutup
9. ✅ Status berubah jadi "Kas Belum Dibuka" (untuk hari berikutnya)

### Test History:
1. ✅ Riwayat kas tampil di tabel (default: 7 hari terakhir)
2. ✅ Hanya tampil kas KASIR SENDIRI (tidak bisa lihat kas kasir lain) ✅
3. ✅ Klik "Detail" → Modal detail terbuka
4. ✅ Detail menampilkan:
   - Info kas
   - List transaksi penjualan cash
   - List pengeluaran
   - Ringkasan dengan selisih
5. ✅ Filter by date range → Berfungsi

### Test Isolation (Penting!):
1. ✅ Login sebagai kasir A
2. ✅ Buka kas → Lakukan transaksi → Tutup kas
3. ✅ Logout
4. ✅ Login sebagai kasir B
5. ✅ Menu "Kas Saya" → Hanya tampil kas kasir B ✅
6. ✅ TIDAK BISA lihat kas kasir A ✅
7. ✅ Logout
8. ✅ Login sebagai owner/admin
9. ✅ Menu "Keuangan" → Tab "Kas Harian"
10. ✅ Owner/admin bisa lihat KAS SEMUA KASIR ✅

### Test Access Control:
1. ✅ Login sebagai kasir
2. ✅ Coba akses finance.html langsung → Redirect atau error ❌
3. ✅ Coba akses my-cash.html → Berhasil ✅
4. ✅ Logout
5. ✅ Login sebagai owner
6. ✅ Coba akses my-cash.html → Redirect (bukan untuk owner) ❌
7. ✅ Menu "Keuangan" tampil dan bisa diakses ✅

## 🧪 Testing Checklist

Setelah implement, test dengan urutan:

### **1. Test sebagai Kasir:**

Login kasir → Menu "Kas Saya" ada ✅
Menu "Keuangan" tidak ada ✅
Buka kas → Berhasil ✅
Transaksi cash → Total update ✅
Tutup kas → Berhasil ✅
History → Hanya kas sendiri ✅

### **2. Test sebagai Owner/Admin:**
Login owner → Menu "Keuangan" ada ✅
Menu "Kas Saya" tidak ada ✅
Tab "Kas Harian" → Lihat semua kas ✅

### **3. Test Isolation:**
Kasir A buka kas → Logout
Kasir B login → Tidak bisa lihat kas A ✅
Owner login → Bisa lihat kas A & B ✅


## 🗂️ Struktur Folder
```
pos-retail/
├── package.json
├── main.js                  # Electron main process
├── preload.js               # Context bridge IPC
├── pos-retail.db            # SQLite database (auto-generated)
├── database/
│   ├── db.js                # Database helper (sql.js)
│   └── init.js              # Schema & seed data
├── src/
│   ├── views/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── users.html
│   │   ├── products.html
│   │   ├── kasir.html
│   │   ├── transactions.html
│   │   ├── finance.html
│   │   ├── my-cash.html
│   │   ├── reports.html     # ← Step 6
│   │   └── settings.html    # ← Step 6
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── utils.js
│       ├── auth.js
│       ├── menu.js
│       ├── notification.js  # ← Step 6
│       ├── dashboard.js
│       ├── users.js
│       ├── products.js
│       ├── kasir.js
│       ├── transactions.js
│       ├── finance.js
│       ├── my-cash.js
│       ├── reports.js       # ← Step 6
│       └── settings.js      # ← Step 6
└── assets/
├── icon.png
└── icon.ico
```


## 🔧 Tech Stack

| Teknologi        | Versi     | Kegunaan                    |
|------------------|-----------|-----------------------------|
| Electron         | ^28.0.0   | Desktop app framework       |
| sql.js           | ^1.8.0    | SQLite di renderer process  |
| bcryptjs         | ^2.4.3    | Hash password               |
| Chart.js         | ^4.4.0    | Grafik (via CDN)            |
| jsPDF            | ^2.5.1    | Export PDF (via CDN)        |
| jsPDF-AutoTable  | ^3.8.0    | Tabel di PDF (via CDN)      |
| SheetJS (xlsx)   | ^0.18.5   | Export Excel (via CDN)      |
| electron-builder | ^24.9.1   | Build installer             |


## ⚠️ Troubleshooting

### Error saat `npm install`
- Pastikan Node.js sudah terinstall (minimal v16)
- Pastikan npm sudah terinstall
- Coba hapus folder `node_modules` dan file `package-lock.json`, lalu install ulang

```bash
# Hapus node_modules dan lock file, install ulang
rm -rf node_modules package-lock.json
npm install
```

### Aplikasi tidak bisa dibuka
- Cek console untuk error messages
- Pastikan semua dependencies terinstall dengan benar
- Jalankan dengan mode dev: `npm run dev` untuk melihat DevTools

### Login gagal terus
- Pastikan database sudah terinisialisasi
- Cek file `pos-retail.db` ada di root folder
- Gunakan kredensial default: admin / admin123
- Hapus `pos-retail.db` → restart app → database dibuat ulang dengan user default

### Database error
- Hapus file `pos-retail.db`
- Jalankan ulang aplikasi, database akan dibuat otomatis

**Export PDF/Excel tidak berjalan**
- Pastikan ada koneksi internet saat pertama kali buka halaman Laporan (Chart.js, jsPDF, XLSX di-load via CDN)
- Atau download library dan simpan lokal di `src/lib/`

**Build error: icon tidak ditemukan**
- Buat folder `assets/` di root project
- Sediakan `icon.ico` (256×256) untuk Windows
- Sediakan `icon.png` (512×512) untuk Linux

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

## 📄 License

MIT — Free to use and modify.

**Version:** 1.0.0 - Step 1  
**Last Updated:** 2026-02-12