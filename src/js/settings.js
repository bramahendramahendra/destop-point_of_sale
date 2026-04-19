// ============================================
// SETTINGS PAGE JAVASCRIPT
// src/js/settings.js
// ============================================

'use strict';

let currentSettings = {};
let logoBase64 = '';

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const ok = initializePageLayout('pengaturan');
  if (!ok) return;

  // Only owner/admin can access
  const user = getCurrentUser();
  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    window.location.href = 'dashboard.html';
    return;
  }

  loadSettings();
  loadPrinterListForSettings();
  setupEventListeners();
});

// ============================================
// LOAD SETTINGS FROM DB
// ============================================

async function loadSettings() {
  showLoading('Memuat pengaturan...');
  try {
    const res = await window.api.settings.getAll();
    if (!res.success) {
      Toast.error(res.message || 'Gagal memuat pengaturan');
      return;
    }

    currentSettings = res.settings;
    applySettingsToForm(res.settings);
  } catch (e) {
    console.error('loadSettings error:', e);
    Toast.error('Terjadi kesalahan saat memuat pengaturan');
  } finally {
    hideLoading();
  }
}

function applySettingsToForm(s) {
  // Store info
  setVal('storeName',     s.store_name     || '');
  setVal('storeAddress',  s.store_address  || '');
  setVal('storePhone',    s.store_phone    || '');
  setVal('storeEmail',    s.store_email    || '');
  setVal('receiptFooter', s.receipt_footer || '');

  // Tax
  const taxEnabled = s.tax_enabled === '1';
  document.getElementById('taxEnabled').checked = taxEnabled;
  setVal('taxPercent', s.tax_percent || '0');
  toggleTaxPercent(taxEnabled);

  // Backup
  const autoBackup = s.auto_backup !== '0';
  document.getElementById('autoBackup').checked = autoBackup;
  setVal('backupDays', s.backup_days || '7');

  // Stock notification (default: enabled)
  const stockNotif = s.stock_notification_enabled !== '0';
  document.getElementById('stockNotificationEnabled').checked = stockNotif;

  // Label barcode
  if (s.label_size_default) {
    const sizeEl = document.getElementById('labelSizeDefault');
    if (sizeEl) sizeEl.value = s.label_size_default;
  }
  if (s.label_printer_default) {
    const printerEl = document.getElementById('labelPrinterDefault');
    if (printerEl) {
      // Set after printer list is loaded
      printerEl.dataset.savedValue = s.label_printer_default;
    }
  }

  // Logo
  if (s.store_logo && s.store_logo.length > 0) {
    logoBase64 = s.store_logo;
    showLogoPreview(s.store_logo);
  }

  // Update receipt preview
  updateReceiptPreview();
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Save button
  document.getElementById('btnSaveSettings').addEventListener('click', handleSaveSettings);

  // Reset button
  document.getElementById('btnResetSettings').addEventListener('click', () => {
    showConfirm(
      'Reset Pengaturan',
      'Yakin ingin mereset semua pengaturan ke nilai default? Perubahan yang belum disimpan akan hilang.',
      async () => {
        showLoading('Mereset pengaturan...');
        try {
          const res = await window.api.settings.reset();
          if (res.success) {
            await loadSettings();
            Toast.success('Pengaturan berhasil direset ke default');
          } else {
            Toast.error(res.message || 'Gagal mereset pengaturan');
          }
        } catch (e) {
          Toast.error('Terjadi kesalahan');
        } finally {
          hideLoading();
        }
      }
    );
  });

  // Tax toggle
  document.getElementById('taxEnabled').addEventListener('change', function () {
    toggleTaxPercent(this.checked);
  });

  // Auto backup toggle
  document.getElementById('autoBackup').addEventListener('change', function () {
    document.getElementById('backupDaysGroup').style.opacity = this.checked ? '1' : '0.5';
  });

  // Logo upload
  document.getElementById('logoFileInput').addEventListener('change', handleLogoUpload);
  document.getElementById('btnRemoveLogo').addEventListener('click', removeLogo);

  // Receipt preview live update
  ['storeName', 'storeAddress', 'storePhone', 'receiptFooter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateReceiptPreview);
  });

  // Backup & Restore
  document.getElementById('btnBackupNow').addEventListener('click', handleBackupNow);
  document.getElementById('btnRestoreBackup').addEventListener('click', handleRestoreBackup);

  // Confirm modal buttons
  document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirm);
  document.getElementById('btnConfirmOk').addEventListener('click', () => {
    closeConfirm();
    if (typeof window._confirmCallback === 'function') {
      window._confirmCallback();
    }
  });

  // Close modal on overlay click
  document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirm();
  });
}

// ============================================
// TAX TOGGLE
// ============================================

function toggleTaxPercent(enabled) {
  document.getElementById('taxPercentGroup').style.display = enabled ? 'block' : 'none';
  document.getElementById('taxInfoBox').style.display      = enabled ? 'block' : 'none';
  document.getElementById('taxPercent').disabled           = !enabled;
}

// ============================================
// LOGO HANDLING
// ============================================

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate type
  if (!file.type.startsWith('image/')) {
    Toast.error('File harus berupa gambar (JPG, PNG, GIF)');
    return;
  }

  // Validate size (500KB)
  if (file.size > 512000) {
    Toast.error('Ukuran file maksimal 500KB');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    logoBase64 = ev.target.result;
    showLogoPreview(logoBase64);
    Toast.success('Logo berhasil dipilih. Klik "Simpan Pengaturan" untuk menyimpan.');
  };
  reader.readAsDataURL(file);

  // Reset input so same file can be picked again
  e.target.value = '';
}

function showLogoPreview(base64) {
  const preview = document.getElementById('logoPreview');
  preview.innerHTML = `<img src="${base64}" alt="Logo" class="logo-img">`;
}

function removeLogo() {
  logoBase64 = '';
  const preview = document.getElementById('logoPreview');
  preview.innerHTML = '<span class="logo-placeholder">🏪</span>';
  Toast.info('Logo dihapus. Klik "Simpan Pengaturan" untuk menyimpan perubahan.');
}

// ============================================
// RECEIPT PREVIEW
// ============================================

function updateReceiptPreview() {
  const name    = document.getElementById('storeName')?.value    || 'TOKO RETAIL';
  const address = document.getElementById('storeAddress')?.value || '';
  const phone   = document.getElementById('storePhone')?.value   || '';
  const footer  = document.getElementById('receiptFooter')?.value || '';

  const nameEl    = document.getElementById('previewStoreName');
  const addressEl = document.getElementById('previewStoreAddress');
  const phoneEl   = document.getElementById('previewStorePhone');
  const footerEl  = document.getElementById('previewFooter');

  if (nameEl)    nameEl.textContent    = name;
  if (addressEl) addressEl.textContent = address;
  if (phoneEl)   phoneEl.textContent   = phone;
  if (footerEl)  footerEl.textContent  = footer;
}

// ============================================
// SAVE SETTINGS
// ============================================

async function handleSaveSettings() {
  // Validate
  const storeName = document.getElementById('storeName').value.trim();
  if (!storeName) {
    Toast.warning('Nama toko tidak boleh kosong');
    document.getElementById('storeName').focus();
    return;
  }

  const taxEnabled = document.getElementById('taxEnabled').checked;
  const taxPercent = parseFloat(document.getElementById('taxPercent').value || '0');

  if (taxEnabled && (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100)) {
    Toast.warning('Persentase pajak harus antara 0 dan 100');
    document.getElementById('taxPercent').focus();
    return;
  }

  const backupDays = parseInt(document.getElementById('backupDays').value || '7', 10);
  if (isNaN(backupDays) || backupDays < 1) {
    Toast.warning('Jumlah hari backup minimal 1 hari');
    document.getElementById('backupDays').focus();
    return;
  }

  const data = {
    store_name:     storeName,
    store_address:  document.getElementById('storeAddress').value.trim(),
    store_phone:    document.getElementById('storePhone').value.trim(),
    store_email:    document.getElementById('storeEmail').value.trim(),
    tax_enabled:    taxEnabled ? '1' : '0',
    tax_percent:    String(taxPercent),
    receipt_footer: document.getElementById('receiptFooter').value.trim(),
    auto_backup:    document.getElementById('autoBackup').checked ? '1' : '0',
    backup_days:    String(backupDays),
    store_logo:                  logoBase64,
    stock_notification_enabled:  document.getElementById('stockNotificationEnabled').checked ? '1' : '0',
    label_size_default:    document.getElementById('labelSizeDefault')?.value    || '4x2.5',
    label_printer_default: document.getElementById('labelPrinterDefault')?.value || ''
  };

  showLoading('Menyimpan pengaturan...');
  try {
    const res = await window.api.settings.save(data);
    if (res.success) {
      currentSettings = { ...currentSettings, ...data };
      Toast.success('Pengaturan berhasil disimpan');
    } else {
      Toast.error(res.message || 'Gagal menyimpan pengaturan');
    }
  } catch (e) {
    console.error('handleSaveSettings error:', e);
    Toast.error('Terjadi kesalahan saat menyimpan pengaturan');
  } finally {
    hideLoading();
  }
}

// ============================================
// BACKUP HANDLERS
// ============================================

async function handleBackupNow() {
  const btn = document.getElementById('btnBackupNow');
  btn.disabled = true;
  btn.textContent = '⏳ Membuat backup...';

  try {
    const res = await window.api.backup.create();

    if (res.canceled) {
      Toast.info('Backup dibatalkan');
      return;
    }

    if (!res.success) {
      Toast.error(res.message || 'Gagal membuat backup');
      return;
    }

    showBackupStatus(`✅ Backup berhasil disimpan: ${res.filename}`, 'success');
    Toast.success(`Backup berhasil: ${res.filename}`);

  } catch (e) {
    console.error('handleBackupNow error:', e);
    Toast.error('Terjadi kesalahan saat backup');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Backup Sekarang';
  }
}

async function handleRestoreBackup() {
  // Step 1: Pilih file
  let fileResult;
  try {
    fileResult = await window.api.backup.selectFile();
  } catch (e) {
    Toast.error('Gagal membuka dialog file');
    return;
  }

  if (fileResult.canceled || !fileResult.filePath) {
    Toast.info('Restore dibatalkan');
    return;
  }

  const filePath = fileResult.filePath;
  const fileName = filePath.split(/[\\/]/).pop();

  // Step 2: Konfirmasi
  showConfirm(
    '⚠️ Restore Database',
    `Anda akan mengganti database aktif dengan:\n"${fileName}"\n\nData saat ini akan digantikan dan TIDAK BISA DIKEMBALIKAN.\nAplikasi akan restart otomatis setelah restore.\n\nYakin ingin melanjutkan?`,
    async () => {
      showLoading('Memulihkan database...');
      try {
        await window.api.backup.restore(filePath);
        // App will restart, so we won't reach here normally
      } catch (e) {
        console.error('handleRestoreBackup error:', e);
        Toast.error('Terjadi kesalahan saat restore database');
        hideLoading();
      }
    }
  );
}

function showBackupStatus(message, type) {
  const box  = document.getElementById('backupStatusBox');
  const text = document.getElementById('backupStatusText');
  if (!box || !text) return;

  text.textContent = message;
  box.style.display = 'block';
  box.className = `info-box info-box-${type || 'info'}`;

  setTimeout(() => { box.style.display = 'none'; }, 6000);
}

// ============================================
// CONFIRM MODAL
// ============================================

function showConfirm(title, message, callback) {
  document.getElementById('confirmModalTitle').textContent  = title;
  document.getElementById('confirmModalMessage').textContent = message;
  document.getElementById('confirmModal').style.display     = 'flex';
  window._confirmCallback = callback;
}

function closeConfirm() {
  document.getElementById('confirmModal').style.display = 'none';
  window._confirmCallback = null;
}

// ============================================
// LOADING OVERLAY
// ============================================

function showLoading(text) {
  const overlay = document.getElementById('loadingOverlay');
  const label   = document.getElementById('loadingText');
  if (overlay) overlay.style.display = 'flex';
  if (label)   label.textContent     = text || 'Memproses...';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================
// PRINTER LIST FOR SETTINGS
// ============================================

async function loadPrinterListForSettings() {
  const select = document.getElementById('labelPrinterDefault');
  if (!select) return;

  select.innerHTML = '<option value="">— Gunakan printer default sistem —</option>';

  try {
    const res = await window.api.printer.getAll();
    if (res.success && res.printers.length > 0) {
      res.printers.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name + (p.isDefault ? ' (default)' : '');
        select.appendChild(opt);
      });
    }

    // Restore saved value after list is populated
    const saved = select.dataset.savedValue;
    if (saved) {
      select.value = saved;
      delete select.dataset.savedValue;
    }
  } catch (e) {
    console.error('loadPrinterListForSettings error:', e);
  }
}