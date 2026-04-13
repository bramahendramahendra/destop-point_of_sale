// ============================================
// SUPPLIER MANAGEMENT
// src/js/suppliers.js
// ============================================

let currentUser = null;
let allSuppliers = [];
let editingSupplierId = null;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Suppliers page loaded');

  if (!initializePageLayout('supplier')) return;

  currentUser = getCurrentUser();

  if (currentUser.role === 'kasir') {
    showToast('Anda tidak memiliki akses ke halaman ini', 'error');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    return;
  }

  setupEventListeners();
  await loadSuppliers();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('btnAddSupplier').addEventListener('click', openAddModal);

  document.getElementById('closeSupplierModal').addEventListener('click', closeSupplierModal);
  document.getElementById('btnCancelSupplier').addEventListener('click', closeSupplierModal);
  document.getElementById('supplierForm').addEventListener('submit', handleFormSubmit);

  document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetailModal);

  document.getElementById('searchInput').addEventListener('input', handleFilter);
  document.getElementById('filterStatus').addEventListener('change', handleFilter);
  document.getElementById('btnApplyFilter').addEventListener('click', loadSuppliers);
  document.getElementById('btnResetFilter').addEventListener('click', resetFilter);

  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('supplierModal')) closeSupplierModal();
    if (e.target === document.getElementById('supplierDetailModal')) closeDetailModal();
  });
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadSuppliers() {
  try {
    const filters = {
      search: document.getElementById('searchInput').value.trim(),
      status: document.getElementById('filterStatus').value
    };

    const result = await window.api.suppliers.getAll(filters);

    if (result.success) {
      allSuppliers = result.suppliers;
      renderSuppliersTable(allSuppliers);
      updateStats(allSuppliers);
    } else {
      showToast('Gagal memuat data supplier', 'error');
    }
  } catch (error) {
    console.error('loadSuppliers error:', error);
    showToast('Terjadi kesalahan saat memuat data', 'error');
  }
}

function renderSuppliersTable(suppliers) {
  const tbody = document.getElementById('suppliersTableBody');

  if (suppliers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Tidak ada data supplier</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td><code>${escapeHtml(s.supplier_code)}</code></td>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.contact_person || '-')}</td>
      <td>${escapeHtml(s.phone || '-')}</td>
      <td>${escapeHtml(s.email || '-')}</td>
      <td>
        <span class="badge ${s.is_active ? 'badge-success' : 'badge-danger'}">
          ${s.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="openDetailModal(${s.id})" title="Detail">
          👁️
        </button>
        <button class="btn-icon" onclick="editSupplier(${s.id})" title="Edit">
          ✏️
        </button>
        <button
          class="btn-icon"
          onclick="toggleSupplierStatus(${s.id}, ${s.is_active})"
          title="${s.is_active ? 'Nonaktifkan' : 'Aktifkan'}"
        >
          ${s.is_active ? '🔓' : '🔒'}
        </button>
        <button
          class="btn-icon"
          onclick="confirmDeleteSupplier(${s.id}, '${escapeHtml(s.name)}')"
          title="Hapus"
        >
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function updateStats(suppliers) {
  const active = suppliers.filter(s => s.is_active === 1).length;
  document.getElementById('statTotal').textContent = suppliers.length;
  document.getElementById('statActive').textContent = active;
  document.getElementById('statInactive').textContent = suppliers.length - active;
}

// ============================================
// FILTER & SEARCH
// ============================================

function handleFilter() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;

  let filtered = allSuppliers;

  if (search) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.supplier_code.toLowerCase().includes(search) ||
      (s.phone && s.phone.toLowerCase().includes(search)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(search))
    );
  }

  if (status !== '') {
    filtered = filtered.filter(s => s.is_active === parseInt(status));
  }

  renderSuppliersTable(filtered);
  updateStats(filtered);
}

function resetFilter() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStatus').value = '';
  renderSuppliersTable(allSuppliers);
  updateStats(allSuppliers);
}

// ============================================
// MODAL ADD / EDIT
// ============================================

function openAddModal() {
  editingSupplierId = null;

  document.getElementById('supplierModalTitle').textContent = 'Tambah Supplier';
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierCode').value = '';
  document.getElementById('supplierFormError').style.display = 'none';
  document.getElementById('btnSubmitSupplierText').textContent = 'Simpan';
  document.getElementById('btnSubmitSupplier').disabled = false;

  document.getElementById('supplierModal').style.display = 'flex';
  setTimeout(() => { document.getElementById('supplierName').focus(); }, 100);
}

async function editSupplier(id) {
  try {
    const result = await window.api.suppliers.getById(id);

    if (!result.success) {
      showToast('Gagal memuat data supplier', 'error');
      return;
    }

    const s = result.supplier;
    editingSupplierId = id;

    document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
    document.getElementById('supplierId').value = s.id;
    document.getElementById('supplierCode').value = s.supplier_code;
    document.getElementById('supplierName').value = s.name;
    document.getElementById('supplierPhone').value = s.phone || '';
    document.getElementById('supplierEmail').value = s.email || '';
    document.getElementById('supplierContact').value = s.contact_person || '';
    document.getElementById('supplierAddress').value = s.address || '';
    document.getElementById('supplierNotes').value = s.notes || '';
    document.getElementById('supplierFormError').style.display = 'none';
    document.getElementById('btnSubmitSupplierText').textContent = 'Update';
    document.getElementById('btnSubmitSupplier').disabled = false;

    document.getElementById('supplierModal').style.display = 'flex';
    setTimeout(() => { document.getElementById('supplierName').focus(); }, 100);
  } catch (error) {
    console.error('editSupplier error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeSupplierModal() {
  document.getElementById('supplierModal').style.display = 'none';
  document.getElementById('supplierForm').reset();
  document.getElementById('btnSubmitSupplier').disabled = false;
  document.getElementById('btnSubmitSupplierText').textContent = 'Simpan';
  editingSupplierId = null;
}

// ============================================
// FORM SUBMIT
// ============================================

async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('supplierName').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
    contact_person: document.getElementById('supplierContact').value.trim(),
    address: document.getElementById('supplierAddress').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim()
  };

  const validation = validateSupplierForm(formData);
  if (!validation.valid) {
    showSupplierFormError(validation.message);
    return;
  }

  const actionText = editingSupplierId ? 'mengupdate' : 'menambahkan';
  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin ${actionText} supplier "${formData.name}"?`,
    async () => { await saveSupplier(formData); }
  );
}

async function saveSupplier(formData) {
  const btn = document.getElementById('btnSubmitSupplier');
  const btnText = document.getElementById('btnSubmitSupplierText');
  const originalText = btnText.textContent;

  btn.disabled = true;
  btnText.textContent = 'Menyimpan...';

  try {
    let result;
    if (editingSupplierId) {
      result = await window.api.suppliers.update(editingSupplierId, formData);
    } else {
      result = await window.api.suppliers.create(formData);
    }

    if (result.success) {
      closeSupplierModal();
      await loadSuppliers();
      showToast(
        editingSupplierId ? 'Supplier berhasil diupdate' : `Supplier berhasil ditambahkan (${result.supplier_code})`,
        'success'
      );
    } else {
      showSupplierFormError(result.message || 'Gagal menyimpan supplier');
      btn.disabled = false;
      btnText.textContent = originalText;
    }
  } catch (error) {
    console.error('saveSupplier error:', error);
    showSupplierFormError('Terjadi kesalahan saat menyimpan');
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

function validateSupplierForm(formData) {
  if (!formData.name) return { valid: false, message: 'Nama supplier harus diisi' };
  if (formData.name.length < 2) return { valid: false, message: 'Nama supplier minimal 2 karakter' };
  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    return { valid: false, message: 'Format email tidak valid' };
  }
  return { valid: true };
}

function showSupplierFormError(message) {
  const el = document.getElementById('supplierFormError');
  el.textContent = message;
  el.style.display = 'block';
}

// ============================================
// TOGGLE STATUS
// ============================================

async function toggleSupplierStatus(id, currentStatus) {
  try {
    const result = await window.api.suppliers.toggleStatus(id);
    if (result.success) {
      await loadSuppliers();
      showToast(
        `Supplier berhasil ${currentStatus ? 'dinonaktifkan' : 'diaktifkan'}`,
        'success'
      );
    } else {
      showToast('Gagal mengubah status supplier', 'error');
    }
  } catch (error) {
    console.error('toggleSupplierStatus error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// ============================================
// DELETE
// ============================================

function confirmDeleteSupplier(id, name) {
  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus supplier "${name}"? Supplier yang sudah digunakan di pembelian tidak dapat dihapus.`,
    async () => { await deleteSupplier(id); }
  );
}

async function deleteSupplier(id) {
  try {
    const result = await window.api.suppliers.delete(id);
    if (result.success) {
      await loadSuppliers();
      showToast('Supplier berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus supplier', 'error');
    }
  } catch (error) {
    console.error('deleteSupplier error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// ============================================
// DETAIL MODAL
// ============================================

async function openDetailModal(id) {
  try {
    document.getElementById('detailPurchaseBody').innerHTML =
      '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    document.getElementById('supplierDetailModal').style.display = 'flex';

    const result = await window.api.suppliers.getDetail(id);

    if (!result.success) {
      showToast('Gagal memuat detail supplier', 'error');
      closeDetailModal();
      return;
    }

    const { supplier, purchases, total_debt, stats } = result;

    document.getElementById('detailModalTitle').textContent = `Detail: ${supplier.name}`;

    // Info supplier
    document.getElementById('detailInfoSection').innerHTML = `
      <h3 class="detail-section-title">Informasi Supplier</h3>
      <div class="detail-info-grid">
        <div class="detail-item">
          <span class="detail-field-label">KODE SUPPLIER</span>
          <span><code>${escapeHtml(supplier.supplier_code)}</code></span>
        </div>
        <div class="detail-item">
          <span class="detail-field-label">NAMA</span>
          <span><strong>${escapeHtml(supplier.name)}</strong></span>
        </div>
        <div class="detail-item">
          <span class="detail-field-label">KONTAK PERSON</span>
          <span>${escapeHtml(supplier.contact_person || '-')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-field-label">TELEPON</span>
          <span>${escapeHtml(supplier.phone || '-')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-field-label">EMAIL</span>
          <span>${escapeHtml(supplier.email || '-')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-field-label">STATUS</span>
          <span>
            <span class="badge ${supplier.is_active ? 'badge-success' : 'badge-danger'}">
              ${supplier.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </span>
        </div>
        <div class="detail-item detail-item-full">
          <span class="detail-field-label">ALAMAT</span>
          <span>${escapeHtml(supplier.address || '-')}</span>
        </div>
        ${supplier.notes ? `
        <div class="detail-item detail-item-full">
          <span class="detail-field-label">KETERANGAN</span>
          <span>${escapeHtml(supplier.notes)}</span>
        </div>` : ''}
      </div>
    `;

    // Ringkasan & hutang
    document.getElementById('detailDebtSection').innerHTML = `
      <div class="debt-summary-grid">
        <div class="debt-stat-card">
          <div class="debt-stat-label">TOTAL PEMBELIAN</div>
          <div class="debt-stat-value">${stats ? stats.total_purchases : 0}x</div>
          <div class="debt-stat-sub">${formatCurrency(stats ? stats.total_amount : 0)}</div>
        </div>
        <div class="debt-stat-card ${total_debt > 0 ? 'debt-stat-card--has-debt' : 'debt-stat-card--no-debt'}">
          <div class="debt-stat-label">TOTAL HUTANG BELUM LUNAS</div>
          <div class="debt-stat-value ${total_debt > 0 ? 'text-danger' : 'text-success'}">
            ${formatCurrency(total_debt)}
          </div>
          <div class="debt-stat-note">${total_debt > 0 ? 'Masih ada hutang' : 'Semua lunas'}</div>
        </div>
      </div>
    `;

    // Riwayat pembelian
    renderDetailPurchases(purchases);

  } catch (error) {
    console.error('openDetailModal error:', error);
    showToast('Terjadi kesalahan', 'error');
    closeDetailModal();
  }
}

function renderDetailPurchases(purchases) {
  const tbody = document.getElementById('detailPurchaseBody');

  if (!purchases || purchases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Belum ada riwayat pembelian dari supplier ini</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = purchases.map(p => `
    <tr>
      <td><code>${escapeHtml(p.purchase_code)}</code></td>
      <td>${formatDateOnly(p.purchase_date)}</td>
      <td><strong>${formatCurrency(p.total_amount)}</strong></td>
      <td><span class="text-success">${formatCurrency(p.paid_amount)}</span></td>
      <td>
        ${p.remaining_amount > 0
          ? `<strong class="text-danger">${formatCurrency(p.remaining_amount)}</strong>`
          : '<span class="text-success">-</span>'}
      </td>
      <td>
        <span class="badge ${getPaymentStatusClass(p.payment_status)}">
          ${getPaymentStatusLabel(p.payment_status)}
        </span>
      </td>
    </tr>
  `).join('');
}

function getPaymentStatusClass(status) {
  if (status === 'paid') return 'badge-success';
  if (status === 'partial') return 'badge-warning';
  return 'badge-danger';
}

function getPaymentStatusLabel(status) {
  if (status === 'paid') return 'Lunas';
  if (status === 'partial') return 'Sebagian';
  return 'Belum Bayar';
}

function closeDetailModal() {
  document.getElementById('supplierDetailModal').style.display = 'none';
}