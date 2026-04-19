// Shifts Management Page
let currentUser = null;
let allShifts = [];
let editingShiftId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!initializePageLayout('shifts')) return;

  currentUser = getCurrentUser();

  if (currentUser.role === 'kasir') {
    showToast('Anda tidak memiliki akses ke halaman ini', 'error');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    return;
  }

  setupEventListeners();
  await loadShifts();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  document.getElementById('btnAddShift').addEventListener('click', openAddShiftModal);
  document.getElementById('closeShiftModal').addEventListener('click', closeShiftModal);
  document.getElementById('btnCancelShift').addEventListener('click', closeShiftModal);
  document.getElementById('shiftForm').addEventListener('submit', handleShiftFormSubmit);

  window.addEventListener('click', (e) => {
    const modal = document.getElementById('shiftModal');
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ============================================
// LOAD & RENDER
// ============================================

async function loadShifts() {
  try {
    const result = await window.api.shifts.getAll();
    if (result.success) {
      allShifts = result.shifts;
      renderShiftsTable(allShifts);
    } else {
      showToast('Gagal memuat data shift', 'error');
    }
  } catch (error) {
    console.error('loadShifts error:', error);
    showToast('Terjadi kesalahan saat memuat shift', 'error');
  }
}

function renderShiftsTable(shifts) {
  const tbody = document.getElementById('shiftsTableBody');

  if (shifts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data shift</td></tr>';
    return;
  }

  tbody.innerHTML = shifts.map(shift => `
    <tr>
      <td><strong>${escapeHtml(shift.name)}</strong></td>
      <td>${shift.start_time}</td>
      <td>${shift.end_time}</td>
      <td>
        <span class="badge ${shift.is_active ? 'badge-success' : 'badge-secondary'}">
          ${shift.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="openEditShiftModal(${shift.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="toggleShiftStatus(${shift.id}, ${shift.is_active})" title="${shift.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
          ${shift.is_active ? '🔴' : '🟢'}
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteShift(${shift.id})" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// MODAL ADD/EDIT
// ============================================

function openAddShiftModal() {
  editingShiftId = null;
  document.getElementById('shiftModalTitle').textContent = 'Tambah Shift';
  document.getElementById('shiftForm').reset();
  document.getElementById('shiftId').value = '';
  hideShiftFormError();
  document.getElementById('shiftModal').style.display = 'flex';
  setTimeout(() => document.getElementById('shiftName').focus(), 100);
}

async function openEditShiftModal(id) {
  try {
    const result = await window.api.shifts.getById(id);
    if (!result.success) {
      showToast('Gagal memuat data shift', 'error');
      return;
    }
    const shift = result.shift;
    editingShiftId = id;

    document.getElementById('shiftModalTitle').textContent = 'Edit Shift';
    document.getElementById('shiftId').value = shift.id;
    document.getElementById('shiftName').value = shift.name;
    document.getElementById('shiftStartTime').value = shift.start_time;
    document.getElementById('shiftEndTime').value = shift.end_time;
    hideShiftFormError();
    document.getElementById('shiftModal').style.display = 'flex';
  } catch (error) {
    console.error('openEditShiftModal error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeShiftModal() {
  document.getElementById('shiftModal').style.display = 'none';
  editingShiftId = null;
}

async function handleShiftFormSubmit(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('shiftName').value.trim(),
    start_time: document.getElementById('shiftStartTime').value,
    end_time: document.getElementById('shiftEndTime').value
  };

  if (!data.name || !data.start_time || !data.end_time) {
    showShiftFormError('Semua field wajib diisi');
    return;
  }

  try {
    let result;
    if (editingShiftId) {
      result = await window.api.shifts.update(editingShiftId, data);
    } else {
      result = await window.api.shifts.create(data);
    }

    if (result.success) {
      showToast(editingShiftId ? 'Shift berhasil diupdate' : 'Shift berhasil ditambahkan', 'success');
      closeShiftModal();
      await loadShifts();
    } else {
      showShiftFormError(result.message || 'Gagal menyimpan shift');
    }
  } catch (error) {
    console.error('handleShiftFormSubmit error:', error);
    showShiftFormError('Terjadi kesalahan saat menyimpan');
  }
}

function showShiftFormError(msg) {
  const el = document.getElementById('shiftFormError');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.display = 'block';
}

function hideShiftFormError() {
  const el = document.getElementById('shiftFormError');
  el.classList.add('hidden');
  el.style.display = 'none';
}

// ============================================
// TOGGLE STATUS & DELETE
// ============================================

async function toggleShiftStatus(id, currentStatus) {
  const label = currentStatus ? 'nonaktifkan' : 'aktifkan';
  showConfirm(
    'Konfirmasi',
    `Yakin ingin ${label} shift ini?`,
    async () => {
      try {
        const result = await window.api.shifts.toggleStatus(id);
        if (result.success) {
          showToast(`Shift berhasil di${label}kan`, 'success');
          await loadShifts();
        } else {
          showToast(result.message || 'Gagal mengubah status', 'error');
        }
      } catch (error) {
        console.error('toggleShiftStatus error:', error);
        showToast('Terjadi kesalahan', 'error');
      }
    }
  );
}

async function deleteShift(id) {
  showConfirm(
    'Hapus Shift',
    'Yakin ingin menghapus shift ini? Aksi ini tidak dapat dibatalkan.',
    async () => {
      try {
        const result = await window.api.shifts.delete(id);
        if (result.success) {
          showToast('Shift berhasil dihapus', 'success');
          await loadShifts();
        } else {
          showToast(result.message || 'Gagal menghapus shift', 'error');
        }
      } catch (error) {
        console.error('deleteShift error:', error);
        showToast('Terjadi kesalahan', 'error');
      }
    }
  );
}
