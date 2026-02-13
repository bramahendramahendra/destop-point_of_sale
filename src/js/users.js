// Users Management
let currentUser = null;
let allUsers = [];
let editingUserId = null;

// Check authentication and role on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Users page loaded');

  // Initialize page layout (navbar + menu)
  if (!initializePageLayout('pengguna')) {
    return;
  }

  // Get current user
  currentUser = getCurrentUser();

  // Check role - only owner and admin can access
  if (currentUser.role === 'kasir') {
    showToast('Anda tidak memiliki akses ke halaman ini', 'error');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
    return;
  }

  // Load users
  await loadUsers();

  // Setup event listeners
  setupEventListeners();
});

// Load all users
async function loadUsers() {
  try {
    const result = await window.api.users.getAll();
    
    if (result.success) {
      allUsers = result.users;
      renderUsersTable(allUsers);
    } else {
      showToast('Gagal memuat data user', 'error');
    }
  } catch (error) {
    console.error('Load users error:', error);
    showToast('Terjadi kesalahan saat memuat data', 'error');
  }
}

// Render users table
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Tidak ada data user</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.full_name)}</td>
      <td><span class="badge badge-role badge-${user.role}">${user.role}</span></td>
      <td>
        <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
          ${user.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>${formatDate(user.created_at)}</td>
      <td class="action-buttons">
        <button class="btn-icon btn-edit" onclick="editUser(${user.id})" title="Edit">
          ✏️
        </button>
        <button 
          class="btn-icon btn-toggle ${user.is_active ? 'active' : ''}" 
          onclick="toggleUserStatus(${user.id}, ${user.is_active})"
          title="${user.is_active ? 'Nonaktifkan' : 'Aktifkan'}"
        >
          ${user.is_active ? '🔓' : '🔒'}
        </button>
        <button 
          class="btn-icon btn-delete" 
          onclick="confirmDeleteUser(${user.id}, '${escapeHtml(user.full_name)}')"
          title="Hapus"
          ${user.id === currentUser.id ? 'disabled' : ''}
        >
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

// Setup event listeners
function setupEventListeners() {
  // Add user button
  document.getElementById('btnAddUser').addEventListener('click', openAddModal);

  // Close modal buttons
  document.getElementById('closeModal').addEventListener('click', closeUserModal);
  document.getElementById('btnCancel').addEventListener('click', closeUserModal);
  
  // Close delete modal
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteModal);

  // Form submit
  document.getElementById('userForm').addEventListener('submit', handleFormSubmit);

  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  // Filters
  document.getElementById('filterRole').addEventListener('change', handleFilter);
  document.getElementById('filterStatus').addEventListener('change', handleFilter);

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    const userModal = document.getElementById('userModal');
    const deleteModal = document.getElementById('deleteModal');
    
    if (e.target === userModal) {
      closeUserModal();
    }
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
}

// Open add user modal
function openAddModal() {
  editingUserId = null;
  document.getElementById('modalTitle').textContent = 'Tambah User Baru';
  document.getElementById('userId').value = '';
  document.getElementById('userForm').reset();
  
  // Password required for new user
  document.getElementById('password').required = true;
  document.getElementById('confirmPassword').required = true;
  document.getElementById('passwordRequired').style.display = 'inline';
  document.getElementById('confirmPasswordRequired').style.display = 'inline';
  document.getElementById('passwordHint').textContent = 'Minimal 8 karakter';
  
  document.getElementById('btnSubmitText').textContent = 'Simpan';
  document.getElementById('formError').style.display = 'none';
  
  document.getElementById('userModal').style.display = 'flex';
  
  // Focus username with delay
  setTimeout(() => {
    const usernameInput = document.getElementById('username');
    usernameInput.focus();
  }, 100);
}

// Edit user
async function editUser(userId) {
  try {
    const result = await window.api.users.getById(userId);
    
    if (result.success) {
      const user = result.user;
      editingUserId = userId;
      
      document.getElementById('modalTitle').textContent = 'Edit User';
      document.getElementById('userId').value = user.id;
      document.getElementById('username').value = user.username;
      document.getElementById('fullName').value = user.full_name;
      document.getElementById('role').value = user.role;
      document.getElementById('password').value = '';
      document.getElementById('confirmPassword').value = '';
      
      // Password optional for edit
      document.getElementById('password').required = false;
      document.getElementById('confirmPassword').required = false;
      document.getElementById('passwordRequired').style.display = 'none';
      document.getElementById('confirmPasswordRequired').style.display = 'none';
      document.getElementById('passwordHint').textContent = 'Kosongkan jika tidak ingin mengubah password';
      
      document.getElementById('btnSubmitText').textContent = 'Update';
      document.getElementById('formError').style.display = 'none';
      
      document.getElementById('userModal').style.display = 'flex';
      
      // Focus username with delay
      setTimeout(() => {
        document.getElementById('username').focus();
      }, 100);
    } else {
      showToast('Gagal memuat data user', 'error');
    }
  } catch (error) {
    console.error('Edit user error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// Close user modal
function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
  document.getElementById('userForm').reset();
  editingUserId = null;
}

// Handle form submit
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    username: document.getElementById('username').value.trim(),
    full_name: document.getElementById('fullName').value.trim(),
    role: document.getElementById('role').value,
    password: document.getElementById('password').value,
    confirmPassword: document.getElementById('confirmPassword').value
  };

  // Validate
  const validation = validateUserForm(formData, editingUserId !== null);
  if (!validation.valid) {
    showFormError(validation.message);
    return;
  }

  // Show confirmation modal before saving
  const actionText = editingUserId ? 'mengupdate' : 'menambahkan';
  const confirmMessage = `Yakin ingin ${actionText} user "${formData.full_name}"?`;
  
  showConfirm(
    'Konfirmasi Simpan',
    confirmMessage,
    async () => {
      await saveUser(formData);
    }
  );
}

// Save user (dipanggil setelah konfirmasi)
async function saveUser(formData) {
  // Disable submit button
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const originalText = btnSubmitText.textContent;
  
  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Menyimpan...';

  try {
    let result;
    
    if (editingUserId) {
      // Update user
      result = await window.api.users.update(editingUserId, formData);
    } else {
      // Create new user
      result = await window.api.users.create(formData);
    }

    if (result.success) {
      closeUserModal();
      await loadUsers();
      showToast(
        editingUserId ? 'User berhasil diupdate' : 'User berhasil ditambahkan',
        'success'
      );
    } else {
      showFormError(result.message || 'Gagal menyimpan user');
      btnSubmit.disabled = false;
      btnSubmitText.textContent = originalText;
    }
  } catch (error) {
    console.error('Save user error:', error);
    showFormError('Terjadi kesalahan saat menyimpan');
    btnSubmit.disabled = false;
    btnSubmitText.textContent = originalText;
  }
}

// Validate user form
function validateUserForm(formData, isEdit) {
  // Username
  if (!formData.username) {
    return { valid: false, message: 'Username harus diisi' };
  }
  if (formData.username.length < 3) {
    return { valid: false, message: 'Username minimal 3 karakter' };
  }

  // Full name
  if (!formData.full_name) {
    return { valid: false, message: 'Nama lengkap harus diisi' };
  }

  // Role
  if (!formData.role) {
    return { valid: false, message: 'Role harus dipilih' };
  }
  if (!['owner', 'admin', 'kasir'].includes(formData.role)) {
    return { valid: false, message: 'Role tidak valid' };
  }

  // Password (required for new user, optional for edit)
  if (!isEdit) {
    if (!formData.password) {
      return { valid: false, message: 'Password harus diisi' };
    }
  }

  // If password is filled
  if (formData.password) {
    if (formData.password.length < 8) {
      return { valid: false, message: 'Password minimal 8 karakter' };
    }
    if (formData.password !== formData.confirmPassword) {
      return { valid: false, message: 'Konfirmasi password tidak cocok' };
    }
  }

  return { valid: true };
}

// Toggle user status
async function toggleUserStatus(userId, currentStatus) {
  // Don't allow toggle own status
  if (userId === currentUser.id) {
    showToast('Tidak dapat mengubah status akun sendiri', 'error');
    return;
  }

  try {
    const result = await window.api.users.toggleStatus(userId);
    
    if (result.success) {
      await loadUsers();
      showToast(
        `User berhasil ${currentStatus ? 'dinonaktifkan' : 'diaktifkan'}`,
        'success'
      );
    } else {
      showToast('Gagal mengubah status user', 'error');
    }
  } catch (error) {
    console.error('Toggle status error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// Confirm delete (menggunakan modal konfirmasi dari utils)
function confirmDeleteUser(userId, userName) {
  // Don't allow delete own account
  if (userId === currentUser.id) {
    showToast('Tidak dapat menghapus akun sendiri', 'error');
    return;
  }

  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus user "${userName}"?`,
    async () => {
      await deleteUser(userId);
    }
  );
}

// Delete user (dipanggil setelah konfirmasi)
async function deleteUser(userId) {
  try {
    const result = await window.api.users.delete(userId);
    
    if (result.success) {
      await loadUsers();
      showToast('User berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus user', 'error');
    }
  } catch (error) {
    console.error('Delete user error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// Handle search
function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  handleFilter();
}

// Handle filter
function handleFilter() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filterRole = document.getElementById('filterRole').value;
  const filterStatus = document.getElementById('filterStatus').value;

  let filtered = allUsers;

  // Search
  if (searchTerm) {
    filtered = filtered.filter(user => 
      user.username.toLowerCase().includes(searchTerm) ||
      user.full_name.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by role
  if (filterRole) {
    filtered = filtered.filter(user => user.role === filterRole);
  }

  // Filter by status
  if (filterStatus !== '') {
    filtered = filtered.filter(user => user.is_active === parseInt(filterStatus));
  }

  renderUsersTable(filtered);
}

function showFormError(message) {
  const errorDiv = document.getElementById('formError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}