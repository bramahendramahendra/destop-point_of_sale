# Changelog — POS Retail

## [1.0.0] — 2026

### ✅ Step 1 — Login & Dashboard Basic
- Login system dengan autentikasi bcrypt
- Dashboard dengan navbar dan sidebar dinamis
- Session management via localStorage
- Database SQLite auto-init

### ✅ Step 2 — User Management
- CRUD user (owner, admin, kasir)
- Role-based menu visibility
- Toggle status aktif/nonaktif

### ✅ Step 3 — Product & Category Management
- CRUD kategori produk
- CRUD produk dengan barcode, harga beli/jual, stok minimum
- Filter produk, toggle status, stok menipis alert

### ✅ Step 4 — Kasir & Transaksi
- Antarmuka kasir: scan barcode, cart, diskon, pajak
- Multi payment method (cash, debit, kredit, transfer, QRIS)
- Cetak struk / receipt
- Riwayat transaksi dengan detail & void

### ✅ Step 5 — Keuangan
- Kas harian per kasir (buka/tutup kas)
- Manajemen pengeluaran operasional
- Pembelian stok dari supplier
- Dashboard keuangan (pendapatan, pengeluaran, laba)

### ✅ Step 6 — Laporan, Pengaturan & Final Polish
- Laporan Penjualan (filter, chart, pagination, export PDF/Excel, print)
- Laporan Laba Rugi (COGS, gross profit, net profit, pie chart)
- Laporan Stok (nilai inventori, alert stok menipis, export Excel)
- Laporan Kasir (ranking, bar chart, export PDF)
- Settings: info toko, pajak, struk footer, logo upload
- Backup manual & auto backup harian
- Restore database dari file backup
- Global keyboard shortcuts (Ctrl+N/P/T/F/R/U/S/L)
- Toast notification system (success/error/warning/info)
- Loading overlay untuk operasi berat
- Dashboard stats real-time (penjualan hari ini, stok menipis)
- Quick actions cards di dashboard
- Application menu bar (File, View, Help)
- Build configuration untuk Windows & Linux installer