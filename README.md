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
- ⏳ STEP 2: User Management - Coming Soon
- ⏳ STEP 3: Product Management - Coming Soon
- ⏳ STEP 4: Cashier/Transaction - Coming Soon
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