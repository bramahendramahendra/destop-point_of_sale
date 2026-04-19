// customers.js - Master Data Pelanggan
let currentUser = null;
let deleteTargetId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!initializePageLayout('piutang')) return;
  currentUser = getCurrentUser();

  if (!['owner', 'admin'].includes(currentUser.role)) {
    window.location.href = 'dashboard.html';
    return;
  }

  setupEventListeners();
  loadCustomers();
});

function setupEventListeners() {
  document.getElementById('btnAddCustomer').addEventListener('click', openAddModal);
  document.getElementById('btnFilter').addEventListener('click', loadCustomers);
  document.getElementById('searchCustomer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadCustomers();
  });

  document.getElementById('closeCustomerModal').addEventListener('click', closeCustomerModal);
  document.getElementById('btnCancelCustomer').addEventListener('click', closeCustomerModal);
  document.getElementById('customerForm').addEventListener('submit', saveCustomer);

  document.getElementById('closeDeleteCustomerModal').addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);

  document.addEventListener('click', (e) => {
    if (e.target === document.getElementById('customerModal')) closeCustomerModal();
    if (e.target === document.getElementById('deleteCustomerModal')) closeDeleteModal();
  });
}

async function loadCustomers() {
  const search = document.getElementById('searchCustomer').value.trim();
  const is_active = document.getElementById('filterStatus').value;

  const filters = {};
  if (search) filters.search = search;
  if (is_active !== '') filters.is_active = parseInt(is_active);

  try {
    const result = await window.api.customers.getAll(filters);
    if (result.success) {
      renderTable(result.customers);
    } else {
      showToast(result.message || 'Gagal memuat data', 'error');
    }
  } catch (error) {
    console.error('loadCustomers error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function renderTable(customers) {
  const tbody = document.getElementById('customerTableBody');

  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Belum ada data pelanggan</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const statusBadge = c.is_active
      ? '<span class="badge badge-success">Aktif</span>'
      : '<span class="badge badge-danger">Nonaktif</span>';
    const limitDisplay = c.credit_limit > 0 ? formatCurrency(c.credit_limit) : '<span class="text-muted">Tak terbatas</span>';
    const outstandingDisplay = c.outstanding > 0
      ? `<span style="color:#e74c3c;font-weight:600;">${formatCurrency(c.outstanding)}</span>`
      : '<span class="text-muted">0</span>';
    return `
      <tr>
        <td><code>${escapeHtml(c.customer_code)}</code></td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.phone || '-')}</td>
        <td>${escapeHtml(c.address || '-')}</td>
        <td>${limitDisplay}</td>
        <td>${outstandingDisplay}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openEditModal(${c.id})">Edit</button>
          <button class="btn btn-sm ${c.is_active ? 'btn-warning' : 'btn-success'}" onclick="toggleStatus(${c.id})">
            ${c.is_active ? 'Nonaktif' : 'Aktifkan'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${c.id}, '${escapeHtml(c.name)}')">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddModal() {
  document.getElementById('customerModalTitle').textContent = 'Tambah Pelanggan';
  document.getElementById('customerId').value = '';
  document.getElementById('customerForm').reset();
  generateCustomerCode();
  document.getElementById('customerModal').style.display = 'flex';
}

async function openEditModal(id) {
  try {
    const result = await window.api.customers.getById(id);
    if (!result.success) { showToast(result.message, 'error'); return; }

    const c = result.customer;
    document.getElementById('customerModalTitle').textContent = 'Edit Pelanggan';
    document.getElementById('customerId').value = c.id;
    document.getElementById('customerCode').value = c.customer_code;
    document.getElementById('customerName').value = c.name;
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerAddress').value = c.address || '';
    document.getElementById('customerCreditLimit').value = c.credit_limit || 0;
    document.getElementById('customerNotes').value = c.notes || '';
    document.getElementById('customerModal').style.display = 'flex';
  } catch (error) {
    console.error('openEditModal error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeCustomerModal() {
  document.getElementById('customerModal').style.display = 'none';
}

async function generateCustomerCode() {
  try {
    const result = await window.api.customers.getAll({});
    const count = result.success ? result.customers.length + 1 : 1;
    document.getElementById('customerCode').value = `PLG-${String(count).padStart(3, '0')}`;
  } catch (e) {
    document.getElementById('customerCode').value = `PLG-001`;
  }
}

async function saveCustomer(e) {
  e.preventDefault();

  const id = document.getElementById('customerId').value;
  const data = {
    customer_code: document.getElementById('customerCode').value.trim(),
    name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    address: document.getElementById('customerAddress').value.trim(),
    credit_limit: parseFloat(document.getElementById('customerCreditLimit').value) || 0,
    notes: document.getElementById('customerNotes').value.trim()
  };

  if (!data.customer_code || !data.name) {
    showToast('Kode dan nama pelanggan wajib diisi', 'error');
    return;
  }

  const btn = document.getElementById('btnSaveCustomer');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const result = id
      ? await window.api.customers.update(parseInt(id), data)
      : await window.api.customers.create(data);

    if (result.success) {
      showToast(id ? 'Pelanggan berhasil diupdate' : 'Pelanggan berhasil ditambahkan', 'success');
      closeCustomerModal();
      loadCustomers();
    } else {
      showToast(result.message || 'Gagal menyimpan', 'error');
    }
  } catch (error) {
    console.error('saveCustomer error:', error);
    showToast('Terjadi kesalahan', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan';
  }
}

async function toggleStatus(id) {
  try {
    const result = await window.api.customers.toggleStatus(id);
    if (result.success) {
      showToast('Status pelanggan berhasil diubah', 'success');
      loadCustomers();
    } else {
      showToast(result.message || 'Gagal mengubah status', 'error');
    }
  } catch (error) {
    console.error('toggleStatus error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function openDeleteModal(id, name) {
  deleteTargetId = id;
  document.getElementById('deleteCustomerName').textContent = name;
  document.getElementById('deleteCustomerModal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('deleteCustomerModal').style.display = 'none';
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  try {
    const result = await window.api.customers.delete(deleteTargetId);
    if (result.success) {
      showToast('Pelanggan berhasil dihapus', 'success');
      closeDeleteModal();
      loadCustomers();
    } else {
      showToast(result.message || 'Gagal menghapus', 'error');
    }
  } catch (error) {
    console.error('confirmDelete error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}
