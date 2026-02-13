// Products & Categories Management
let currentUser = null;
let allProducts = [];
let allCategories = [];
let editingProductId = null;
let editingCategoryId = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Products page loaded');

  // Get current user
  currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('No user found, redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  console.log('Current user:', currentUser);

  // Display user info
  displayUserInfo(currentUser);

  // Setup logout button
  setupLogoutButton();

  // Hide menu based on role
  if (currentUser.role === 'kasir') {
    const menuPengguna = document.getElementById('menuPengguna');
    if (menuPengguna) {
      menuPengguna.style.display = 'none';
    }
  }

  // Load data
  await loadCategories();
  await loadProducts();

  // Setup event listeners
  setupEventListeners();
});

// ============================================
// TAB MANAGEMENT
// ============================================

function setupEventListeners() {
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Product buttons
  document.getElementById('btnAddProduct').addEventListener('click', openAddProductModal);
  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('btnCancelProduct').addEventListener('click', closeProductModal);
  document.getElementById('productForm').addEventListener('submit', handleProductFormSubmit);
  document.getElementById('btnGenerateBarcode').addEventListener('click', handleGenerateBarcode);

  // Category buttons
  document.getElementById('btnAddCategory').addEventListener('click', openAddCategoryModal);
  document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal);
  document.getElementById('btnCancelCategory').addEventListener('click', closeCategoryModal);
  document.getElementById('categoryForm').addEventListener('submit', handleCategoryFormSubmit);

  // Product filters & search
  document.getElementById('searchProduct').addEventListener('input', filterProducts);
  document.getElementById('filterCategory').addEventListener('change', filterProducts);
  document.getElementById('filterProductStatus').addEventListener('change', filterProducts);

  // Price change listeners for margin calculation
  document.getElementById('purchasePrice').addEventListener('input', calculateAndDisplayMargin);
  document.getElementById('sellingPrice').addEventListener('input', calculateAndDisplayMargin);

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    const productModal = document.getElementById('productModal');
    const categoryModal = document.getElementById('categoryModal');
    
    if (e.target === productModal) {
      closeProductModal();
    }
    if (e.target === categoryModal) {
      closeCategoryModal();
    }
  });
}

function switchTab(tabName) {
  // Update tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ============================================
// CATEGORIES MANAGEMENT
// ============================================

async function loadCategories() {
  try {
    const result = await window.api.categories.getAll();
    
    if (result.success) {
      allCategories = result.categories;
      renderCategoriesTable(allCategories);
      populateCategoryDropdowns();
    } else {
      showToast('Gagal memuat data kategori', 'error');
    }
  } catch (error) {
    console.error('Load categories error:', error);
    showToast('Terjadi kesalahan saat memuat kategori', 'error');
  }
}

function renderCategoriesTable(categories) {
  const tbody = document.getElementById('categoriesTableBody');
  
  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Tidak ada data kategori</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categories.map(category => `
    <tr>
      <td>${escapeHtml(category.name)}</td>
      <td>${escapeHtml(category.description || '-')}</td>
      <td>${category.product_count || 0} produk</td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="editCategory(${category.id})" title="Edit">
          ✏️
        </button>
        <button 
          class="btn-icon" 
          onclick="confirmDeleteCategory(${category.id}, '${escapeHtml(category.name)}', ${category.product_count || 0})"
          title="Hapus"
        >
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function populateCategoryDropdowns() {
  const productCategorySelect = document.getElementById('productCategory');
  const filterCategorySelect = document.getElementById('filterCategory');

  // Clear existing options (except first)
  productCategorySelect.innerHTML = '<option value="">Pilih Kategori</option>';
  filterCategorySelect.innerHTML = '<option value="">Semua Kategori</option>';

  allCategories.forEach(category => {
    const option1 = document.createElement('option');
    option1.value = category.id;
    option1.textContent = category.name;
    productCategorySelect.appendChild(option1);

    const option2 = document.createElement('option');
    option2.value = category.id;
    option2.textContent = category.name;
    filterCategorySelect.appendChild(option2);
  });
}

function openAddCategoryModal() {
  editingCategoryId = null;
  document.getElementById('categoryModalTitle').textContent = 'Tambah Kategori';
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryFormError').style.display = 'none';
  document.getElementById('btnSubmitCategoryText').textContent = 'Simpan';
  document.getElementById('categoryModal').style.display = 'flex';
  
  setTimeout(() => {
    document.getElementById('categoryName').focus();
  }, 100);
}

async function editCategory(categoryId) {
  try {
    const result = await window.api.categories.getById(categoryId);
    
    if (result.success) {
      const category = result.category;
      editingCategoryId = categoryId;
      
      document.getElementById('categoryModalTitle').textContent = 'Edit Kategori';
      document.getElementById('categoryId').value = category.id;
      document.getElementById('categoryName').value = category.name;
      document.getElementById('categoryDescription').value = category.description || '';
      document.getElementById('categoryFormError').style.display = 'none';
      document.getElementById('btnSubmitCategoryText').textContent = 'Update';
      document.getElementById('categoryModal').style.display = 'flex';
      
      setTimeout(() => {
        document.getElementById('categoryName').focus();
      }, 100);
    } else {
      showToast('Gagal memuat data kategori', 'error');
    }
  } catch (error) {
    console.error('Edit category error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
  document.getElementById('categoryForm').reset();
  editingCategoryId = null;
}

async function handleCategoryFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('categoryName').value.trim(),
    description: document.getElementById('categoryDescription').value.trim()
  };

  if (!formData.name) {
    showCategoryFormError('Nama kategori harus diisi');
    return;
  }

  const actionText = editingCategoryId ? 'mengupdate' : 'menambahkan';
  
  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin ${actionText} kategori "${formData.name}"?`,
    async () => {
      await saveCategory(formData);
    }
  );
}

async function saveCategory(formData) {
  const btnSubmit = document.getElementById('btnSubmitCategory');
  const btnSubmitText = document.getElementById('btnSubmitCategoryText');
  const originalText = btnSubmitText.textContent;
  
  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Menyimpan...';

  try {
    let result;
    
    if (editingCategoryId) {
      result = await window.api.categories.update(editingCategoryId, formData);
    } else {
      result = await window.api.categories.create(formData);
    }

    if (result.success) {
      closeCategoryModal();
      await loadCategories();
      showToast(
        editingCategoryId ? 'Kategori berhasil diupdate' : 'Kategori berhasil ditambahkan',
        'success'
      );
    } else {
      showCategoryFormError(result.message || 'Gagal menyimpan kategori');
      btnSubmit.disabled = false;
      btnSubmitText.textContent = originalText;
    }
  } catch (error) {
    console.error('Save category error:', error);
    showCategoryFormError('Terjadi kesalahan saat menyimpan');
    btnSubmit.disabled = false;
    btnSubmitText.textContent = originalText;
  }
}

function confirmDeleteCategory(categoryId, categoryName, productCount) {
  if (productCount > 0) {
    showToast(`Tidak dapat menghapus kategori "${categoryName}". Masih ada ${productCount} produk dalam kategori ini.`, 'error');
    return;
  }

  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus kategori "${categoryName}"?`,
    async () => {
      await deleteCategory(categoryId);
    }
  );
}

async function deleteCategory(categoryId) {
  try {
    const result = await window.api.categories.delete(categoryId);
    
    if (result.success) {
      await loadCategories();
      showToast('Kategori berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus kategori', 'error');
    }
  } catch (error) {
    console.error('Delete category error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function showCategoryFormError(message) {
  const errorDiv = document.getElementById('categoryFormError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// ============================================
// PRODUCTS MANAGEMENT
// ============================================

async function loadProducts() {
  try {
    const result = await window.api.products.getAll();
    
    if (result.success) {
      allProducts = result.products;
      renderProductsTable(allProducts);
    } else {
      showToast('Gagal memuat data produk', 'error');
    }
  } catch (error) {
    console.error('Load products error:', error);
    showToast('Terjadi kesalahan saat memuat produk', 'error');
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  
  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center">Tidak ada data produk</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(product => {
    const margin = calculateMargin(product.purchase_price, product.selling_price);
    const stockStatus = getStockStatus(product.stock, product.min_stock);
    
    return `
      <tr>
        <td><code>${escapeHtml(product.barcode)}</code></td>
        <td>${escapeHtml(product.name)}</td>
        <td>${escapeHtml(product.category_name || '-')}</td>
        <td>${formatCurrency(product.purchase_price)}</td>
        <td>${formatCurrency(product.selling_price)}</td>
        <td>
          <span class="badge ${margin >= 30 ? 'badge-success' : margin >= 15 ? 'badge-warning' : 'badge-danger'}">
            ${margin}%
          </span>
        </td>
        <td>
          <span class="badge ${stockStatus.class}">
            ${product.stock}
          </span>
        </td>
        <td>${product.unit}</td>
        <td>
          <span class="badge ${product.is_active ? 'badge-success' : 'badge-danger'}">
            ${product.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td class="action-buttons">
          <button class="btn-icon" onclick="editProduct(${product.id})" title="Edit">
            ✏️
          </button>
          <button 
            class="btn-icon" 
            onclick="toggleProductStatus(${product.id}, ${product.is_active})"
            title="${product.is_active ? 'Nonaktifkan' : 'Aktifkan'}"
          >
            ${product.is_active ? '🔓' : '🔒'}
          </button>
          <button 
            class="btn-icon" 
            onclick="confirmDeleteProduct(${product.id}, '${escapeHtml(product.name)}')"
            title="Hapus"
          >
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function getStockStatus(stock, minStock) {
  if (stock === 0) {
    return { class: 'badge-danger', text: 'Habis' };
  } else if (stock < minStock) {
    return { class: 'badge-warning', text: 'Menipis' };
  } else {
    return { class: 'badge-success', text: 'Aman' };
  }
}

function filterProducts() {
  const searchTerm = document.getElementById('searchProduct').value.toLowerCase();
  const categoryFilter = document.getElementById('filterCategory').value;
  const statusFilter = document.getElementById('filterProductStatus').value;

  let filtered = allProducts;

  // Search
  if (searchTerm) {
    filtered = filtered.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.barcode.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by category
  if (categoryFilter) {
    filtered = filtered.filter(product => product.category_id == categoryFilter);
  }

  // Filter by status
  if (statusFilter === '1') {
    filtered = filtered.filter(product => product.is_active === 1);
  } else if (statusFilter === '0') {
    filtered = filtered.filter(product => product.is_active === 0);
  } else if (statusFilter === 'low_stock') {
    filtered = filtered.filter(product => product.stock < product.min_stock);
  }

  renderProductsTable(filtered);
}

function openAddProductModal() {
  editingProductId = null;
  document.getElementById('productModalTitle').textContent = 'Tambah Produk';
  document.getElementById('productForm').reset();
  document.getElementById('stock').value = '0';
  document.getElementById('minStock').value = '5';
  document.getElementById('marginDisplay').value = '0%';
  document.getElementById('productFormError').style.display = 'none';
  document.getElementById('btnSubmitProductText').textContent = 'Simpan';
  document.getElementById('productModal').style.display = 'flex';
  
  setTimeout(() => {
    document.getElementById('barcode').focus();
  }, 100);
}

async function editProduct(productId) {
  try {
    const result = await window.api.products.getById(productId);
    
    if (result.success) {
      const product = result.product;
      editingProductId = productId;
      
      document.getElementById('productModalTitle').textContent = 'Edit Produk';
      document.getElementById('productId').value = product.id;
      document.getElementById('barcode').value = product.barcode;
      document.getElementById('productName').value = product.name;
      document.getElementById('productCategory').value = product.category_id || '';
      document.getElementById('purchasePrice').value = product.purchase_price;
      document.getElementById('sellingPrice').value = product.selling_price;
      document.getElementById('stock').value = product.stock;
      document.getElementById('minStock').value = product.min_stock;
      document.getElementById('unit').value = product.unit;
      
      calculateAndDisplayMargin();
      
      document.getElementById('productFormError').style.display = 'none';
      document.getElementById('btnSubmitProductText').textContent = 'Update';
      document.getElementById('productModal').style.display = 'flex';
      
      setTimeout(() => {
        document.getElementById('productName').focus();
      }, 100);
    } else {
      showToast('Gagal memuat data produk', 'error');
    }
  } catch (error) {
    console.error('Edit product error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
  editingProductId = null;
}

function handleGenerateBarcode() {
  const barcode = generateBarcode();
  document.getElementById('barcode').value = barcode;
}

function calculateAndDisplayMargin() {
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
  
  const margin = calculateMargin(purchasePrice, sellingPrice);
  document.getElementById('marginDisplay').value = `${margin}%`;
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  
  const formData = {
    barcode: document.getElementById('barcode').value.trim(),
    name: document.getElementById('productName').value.trim(),
    category_id: document.getElementById('productCategory').value || null,
    purchase_price: parseFloat(document.getElementById('purchasePrice').value) || 0,
    selling_price: parseFloat(document.getElementById('sellingPrice').value) || 0,
    stock: parseInt(document.getElementById('stock').value) || 0,
    min_stock: parseInt(document.getElementById('minStock').value) || 5,
    unit: document.getElementById('unit').value
  };

  // Validate
  if (!formData.barcode || !formData.name) {
    showProductFormError('Barcode dan nama produk harus diisi');
    return;
  }

  if (formData.purchase_price < 0 || formData.selling_price < 0) {
    showProductFormError('Harga tidak boleh negatif');
    return;
  }

  if (formData.selling_price < formData.purchase_price) {
    showProductFormError('Harga jual tidak boleh lebih rendah dari harga beli');
    return;
  }

  const actionText = editingProductId ? 'mengupdate' : 'menambahkan';
  
  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin ${actionText} produk "${formData.name}"?`,
    async () => {
      await saveProduct(formData);
    }
  );
}

async function saveProduct(formData) {
  const btnSubmit = document.getElementById('btnSubmitProduct');
  const btnSubmitText = document.getElementById('btnSubmitProductText');
  const originalText = btnSubmitText.textContent;
  
  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Menyimpan...';

  try {
    let result;
    
    if (editingProductId) {
      result = await window.api.products.update(editingProductId, formData);
    } else {
      result = await window.api.products.create(formData);
    }

    if (result.success) {
      closeProductModal();
      await loadProducts();
      showToast(
        editingProductId ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan',
        'success'
      );
    } else {
      showProductFormError(result.message || 'Gagal menyimpan produk');
      btnSubmit.disabled = false;
      btnSubmitText.textContent = originalText;
    }
  } catch (error) {
    console.error('Save product error:', error);
    showProductFormError('Terjadi kesalahan saat menyimpan');
    btnSubmit.disabled = false;
    btnSubmitText.textContent = originalText;
  }
}

async function toggleProductStatus(productId, currentStatus) {
  try {
    const result = await window.api.products.toggleStatus(productId);
    
    if (result.success) {
      await loadProducts();
      showToast(
        `Produk berhasil ${currentStatus ? 'dinonaktifkan' : 'diaktifkan'}`,
        'success'
      );
    } else {
      showToast('Gagal mengubah status produk', 'error');
    }
  } catch (error) {
    console.error('Toggle product status error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function confirmDeleteProduct(productId, productName) {
  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus produk "${productName}"?`,
    async () => {
      await deleteProduct(productId);
    }
  );
}

async function deleteProduct(productId) {
  try {
    const result = await window.api.products.delete(productId);
    
    if (result.success) {
      await loadProducts();
      showToast('Produk berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus produk', 'error');
    }
  } catch (error) {
    console.error('Delete product error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function showProductFormError(message) {
  const errorDiv = document.getElementById('productFormError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}