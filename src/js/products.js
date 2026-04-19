// Products & Categories Management
let currentUser = null;
let allProducts = [];
let allCategories = [];
let allUnits = [];
let editingProductId = null;
let editingCategoryId = null;
let editingUnitId = null;
// productUnits buffer: array of {unit_id, unit_name, abbreviation, conversion_qty, selling_price, is_default}
let productUnitRows = [];
let puEditIndex = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Products page loaded');

  // Initialize page layout (navbar + menu)
  if (!initializePageLayout('products')) {
    return;
  }

  // Get current user
  currentUser = getCurrentUser();

  // Load data
  await loadCategories();
  await loadProducts();
  await loadUnits();

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

  // Unit master buttons
  document.getElementById('btnAddUnit').addEventListener('click', openAddUnitModal);
  document.getElementById('closeUnitModal').addEventListener('click', closeUnitModal);
  document.getElementById('btnCancelUnit').addEventListener('click', closeUnitModal);
  document.getElementById('unitForm').addEventListener('submit', handleUnitFormSubmit);

  // Product unit buttons
  document.getElementById('btnAddProductUnit').addEventListener('click', openAddProductUnitModal);
  document.getElementById('closeProductUnitModal').addEventListener('click', closeProductUnitModal);
  document.getElementById('btnCancelProductUnit').addEventListener('click', closeProductUnitModal);
  document.getElementById('productUnitForm').addEventListener('submit', handleProductUnitFormSubmit);

  // Product price tier buttons
  document.getElementById('btnAddProductPrice').addEventListener('click', openAddProductPriceModal);
  document.getElementById('closeProductPriceModal').addEventListener('click', closeProductPriceModal);
  document.getElementById('btnCancelProductPrice').addEventListener('click', closeProductPriceModal);
  document.getElementById('productPriceForm').addEventListener('submit', handleProductPriceFormSubmit);

  // Auto-calculate hint on product unit price input
  document.getElementById('puConversionQty').addEventListener('input', updatePuPriceHint);
  document.getElementById('puSellingPrice').addEventListener('input', updatePuPriceHint);

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    const productModal = document.getElementById('productModal');
    const categoryModal = document.getElementById('categoryModal');
    const unitModal = document.getElementById('unitModal');
    const productUnitModal = document.getElementById('productUnitModal');
    const productPriceModal = document.getElementById('productPriceModal');

    if (e.target === productModal) closeProductModal();
    if (e.target === categoryModal) closeCategoryModal();
    if (e.target === unitModal) closeUnitModal();
    if (e.target === productUnitModal) closeProductUnitModal();
    if (e.target === productPriceModal) closeProductPriceModal();
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
  productUnitRows = [];
  document.getElementById('productModalTitle').textContent = 'Tambah Produk';
  document.getElementById('productForm').reset();
  document.getElementById('stock').value = '0';
  document.getElementById('minStock').value = '5';
  document.getElementById('marginDisplay').value = '0%';
  document.getElementById('productFormError').style.display = 'none';
  document.getElementById('btnSubmitProductText').textContent = 'Simpan';
  document.getElementById('productUnitsSection').classList.add('hidden');
  document.getElementById('productPricesSection').classList.add('hidden');
  productPriceRows = [];
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

      // Load product units
      await loadProductUnitsForEdit(productId, product.unit, product.selling_price);

      // Load product price tiers
      await loadProductPricesForEdit(productId);

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
  document.getElementById('productUnitsSection').classList.add('hidden');
  document.getElementById('productPricesSection').classList.add('hidden');
  editingProductId = null;
  productUnitRows = [];
  productPriceRows = [];
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
      // Save product units if any
      const savedProductId = editingProductId || result.productId;
      if (savedProductId && productUnitRows.length > 0) {
        await window.api.productUnits.save(savedProductId, productUnitRows);
      }

      closeProductModal();
      await loadProducts();
      showToast(
        editingProductId ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan',
        'success'
      );

      btnSubmit.disabled = false;
      btnSubmitText.textContent = originalText;
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

// ============================================
// UNITS MASTER MANAGEMENT
// ============================================

async function loadUnits() {
  try {
    const result = await window.api.units.getAll();
    if (result.success) {
      allUnits = result.units;
      renderUnitsTable(allUnits);
    } else {
      showToast('Gagal memuat data satuan', 'error');
    }
  } catch (error) {
    console.error('Load units error:', error);
    showToast('Terjadi kesalahan saat memuat satuan', 'error');
  }
}

function renderUnitsTable(units) {
  const tbody = document.getElementById('unitsTableBody');

  if (units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">Tidak ada data satuan</td></tr>`;
    return;
  }

  tbody.innerHTML = units.map(unit => `
    <tr>
      <td>${escapeHtml(unit.name)}</td>
      <td><code>${escapeHtml(unit.abbreviation)}</code></td>
      <td>
        <span class="badge ${unit.is_active ? 'badge-success' : 'badge-danger'}">
          ${unit.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="editUnit(${unit.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="toggleUnitStatus(${unit.id}, ${unit.is_active})"
          title="${unit.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
          ${unit.is_active ? '🔓' : '🔒'}
        </button>
        <button class="btn-icon" onclick="confirmDeleteUnit(${unit.id}, '${escapeHtml(unit.name)}')" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openAddUnitModal() {
  editingUnitId = null;
  document.getElementById('unitModalTitle').textContent = 'Tambah Satuan';
  document.getElementById('unitForm').reset();
  document.getElementById('unitFormError').style.display = 'none';
  document.getElementById('btnSubmitUnitText').textContent = 'Simpan';
  document.getElementById('unitModal').style.display = 'flex';
  setTimeout(() => document.getElementById('unitName').focus(), 100);
}

async function editUnit(unitId) {
  try {
    const result = await window.api.units.getById(unitId);
    if (result.success) {
      const unit = result.unit;
      editingUnitId = unitId;
      document.getElementById('unitModalTitle').textContent = 'Edit Satuan';
      document.getElementById('unitId').value = unit.id;
      document.getElementById('unitName').value = unit.name;
      document.getElementById('unitAbbreviation').value = unit.abbreviation;
      document.getElementById('unitFormError').style.display = 'none';
      document.getElementById('btnSubmitUnitText').textContent = 'Update';
      document.getElementById('unitModal').style.display = 'flex';
      setTimeout(() => document.getElementById('unitName').focus(), 100);
    } else {
      showToast('Gagal memuat data satuan', 'error');
    }
  } catch (error) {
    console.error('Edit unit error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeUnitModal() {
  document.getElementById('unitModal').style.display = 'none';
  document.getElementById('unitForm').reset();
  editingUnitId = null;
}

async function handleUnitFormSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById('unitName').value.trim(),
    abbreviation: document.getElementById('unitAbbreviation').value.trim()
  };

  if (!formData.name || !formData.abbreviation) {
    showUnitFormError('Nama dan singkatan satuan harus diisi');
    return;
  }

  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin ${editingUnitId ? 'mengupdate' : 'menambahkan'} satuan "${formData.name}"?`,
    async () => {
      const btnSubmit = document.querySelector('#unitForm button[type="submit"]');
      const btnText = document.getElementById('btnSubmitUnitText');
      btnSubmit.disabled = true;
      btnText.textContent = 'Menyimpan...';

      try {
        const result = editingUnitId
          ? await window.api.units.update(editingUnitId, formData)
          : await window.api.units.create(formData);

        if (result.success) {
          closeUnitModal();
          await loadUnits();
          showToast(editingUnitId ? 'Satuan berhasil diupdate' : 'Satuan berhasil ditambahkan', 'success');
        } else {
          showUnitFormError(result.message || 'Gagal menyimpan satuan');
        }
      } catch (error) {
        showUnitFormError('Terjadi kesalahan saat menyimpan');
      } finally {
        btnSubmit.disabled = false;
        btnText.textContent = editingUnitId ? 'Update' : 'Simpan';
      }
    }
  );
}

async function toggleUnitStatus(unitId, currentStatus) {
  try {
    const result = await window.api.units.toggleStatus(unitId);
    if (result.success) {
      await loadUnits();
      showToast(`Satuan berhasil ${currentStatus ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
    } else {
      showToast('Gagal mengubah status satuan', 'error');
    }
  } catch (error) {
    showToast('Terjadi kesalahan', 'error');
  }
}

function confirmDeleteUnit(unitId, unitName) {
  showConfirm('Konfirmasi Hapus', `Yakin ingin menghapus satuan "${unitName}"?`, async () => {
    try {
      const result = await window.api.units.delete(unitId);
      if (result.success) {
        await loadUnits();
        showToast('Satuan berhasil dihapus', 'success');
      } else {
        showToast(result.message || 'Gagal menghapus satuan', 'error');
      }
    } catch (error) {
      showToast('Terjadi kesalahan', 'error');
    }
  });
}

function showUnitFormError(message) {
  const el = document.getElementById('unitFormError');
  el.textContent = message;
  el.style.display = 'block';
}

// ============================================
// PRODUCT UNITS (SATUAN JUAL) MANAGEMENT
// ============================================

async function loadProductUnitsForEdit(productId, baseUnit, basePrice) {
  try {
    const result = await window.api.productUnits.getByProduct(productId);
    if (result.success) {
      productUnitRows = result.units.map(u => ({
        id: u.id,
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        abbreviation: u.abbreviation || '',
        conversion_qty: u.conversion_qty,
        selling_price: u.selling_price,
        is_default: u.is_default
      }));
    } else {
      productUnitRows = [];
    }

    // Ensure base unit row exists
    const baseUnitObj = allUnits.find(u => u.name.toLowerCase() === baseUnit.toLowerCase());
    const alreadyHasDefault = productUnitRows.some(r => r.is_default);
    if (!alreadyHasDefault && baseUnitObj) {
      productUnitRows.unshift({
        id: null,
        unit_id: baseUnitObj.id,
        unit_name: baseUnitObj.name,
        abbreviation: baseUnitObj.abbreviation,
        conversion_qty: 1,
        selling_price: basePrice,
        is_default: 1
      });
    }

    renderProductUnitsRows(baseUnit);
    document.getElementById('productUnitsSection').classList.remove('hidden');
  } catch (error) {
    console.error('loadProductUnitsForEdit error:', error);
  }
}

function renderProductUnitsRows(baseUnit) {
  const container = document.getElementById('productUnitsContainer');

  if (productUnitRows.length === 0) {
    container.innerHTML = `<p class="text-center" style="color:#888; font-size:13px;">Belum ada satuan jual. Klik "+ Tambah Satuan Jual" untuk menambahkan.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table" style="font-size:13px;">
      <thead>
        <tr>
          <th>Satuan</th>
          <th>Konversi</th>
          <th>Harga Jual</th>
          <th>Tipe</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${productUnitRows.map((row, idx) => `
          <tr>
            <td>${escapeHtml(row.unit_name)} <small style="color:#888;">(${escapeHtml(row.abbreviation)})</small></td>
            <td>${row.is_default ? '1 (Dasar)' : `1 ${escapeHtml(row.unit_name)} = ${row.conversion_qty} ${escapeHtml(baseUnit || '')}`}</td>
            <td>${formatCurrency(row.selling_price)}</td>
            <td>
              <span class="badge ${row.is_default ? 'badge-success' : 'badge-warning'}">
                ${row.is_default ? 'Dasar' : 'Jual'}
              </span>
            </td>
            <td class="action-buttons">
              ${row.is_default ? '' : `
                <button type="button" class="btn-icon" onclick="editProductUnitRow(${idx})" title="Edit">✏️</button>
                <button type="button" class="btn-icon" onclick="deleteProductUnitRow(${idx})" title="Hapus">🗑️</button>
              `}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddProductUnitModal() {
  if (!editingProductId) {
    showToast('Simpan produk terlebih dahulu sebelum menambahkan satuan jual', 'warning');
    return;
  }

  puEditIndex = null;
  document.getElementById('productUnitModalTitle').textContent = 'Tambah Satuan Jual';
  document.getElementById('productUnitForm').reset();
  document.getElementById('puEditIndex').value = '';
  document.getElementById('productUnitFormError').style.display = 'none';
  document.getElementById('btnSubmitProductUnitText').textContent = 'Simpan';
  document.getElementById('puPriceHint').textContent = '';

  populatePuUnitSelect();
  document.getElementById('productUnitModal').style.display = 'flex';
  setTimeout(() => document.getElementById('puUnitId').focus(), 100);
}

function editProductUnitRow(idx) {
  const row = productUnitRows[idx];
  puEditIndex = idx;

  document.getElementById('productUnitModalTitle').textContent = 'Edit Satuan Jual';
  document.getElementById('puEditIndex').value = idx;
  document.getElementById('productUnitFormError').style.display = 'none';
  document.getElementById('btnSubmitProductUnitText').textContent = 'Update';

  populatePuUnitSelect();
  document.getElementById('puUnitId').value = row.unit_id;
  document.getElementById('puConversionQty').value = row.conversion_qty;
  document.getElementById('puSellingPrice').value = row.selling_price;
  updatePuPriceHint();

  document.getElementById('productUnitModal').style.display = 'flex';
}

function deleteProductUnitRow(idx) {
  showConfirm('Konfirmasi Hapus', 'Yakin ingin menghapus satuan jual ini?', () => {
    productUnitRows.splice(idx, 1);
    const baseUnit = document.getElementById('unit').value;
    renderProductUnitsRows(baseUnit);
  });
}

function closeProductUnitModal() {
  document.getElementById('productUnitModal').style.display = 'none';
  document.getElementById('productUnitForm').reset();
  puEditIndex = null;
}

function populatePuUnitSelect() {
  const select = document.getElementById('puUnitId');
  const activeUnits = allUnits.filter(u => u.is_active);
  select.innerHTML = '<option value="">Pilih Satuan</option>' +
    activeUnits.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.abbreviation)})</option>`).join('');
}

function updatePuPriceHint() {
  const convQty = parseFloat(document.getElementById('puConversionQty').value) || 0;
  const price = parseFloat(document.getElementById('puSellingPrice').value) || 0;
  const baseUnit = document.getElementById('unit') ? document.getElementById('unit').value : '';
  const hint = document.getElementById('puConversionHint');
  hint.textContent = convQty > 0
    ? `1 satuan ini = ${convQty} ${baseUnit}`
    : 'Berapa satuan dasar dalam 1 satuan ini';

  const priceHint = document.getElementById('puPriceHint');
  if (convQty > 0 && price > 0) {
    priceHint.textContent = `≈ ${formatCurrency(price / convQty)} per ${baseUnit}`;
  } else {
    priceHint.textContent = '';
  }
}

async function handleProductUnitFormSubmit(e) {
  e.preventDefault();

  const unitId = parseInt(document.getElementById('puUnitId').value);
  const conversionQty = parseFloat(document.getElementById('puConversionQty').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('puSellingPrice').value) || 0;

  if (!unitId) {
    showPuFormError('Pilih satuan terlebih dahulu');
    return;
  }
  if (conversionQty <= 0) {
    showPuFormError('Nilai konversi harus lebih dari 0');
    return;
  }
  if (sellingPrice <= 0) {
    showPuFormError('Harga jual harus lebih dari 0');
    return;
  }

  const unitObj = allUnits.find(u => u.id === unitId);
  if (!unitObj) {
    showPuFormError('Satuan tidak valid');
    return;
  }

  // Check duplicate (excluding current edit index)
  const isDuplicate = productUnitRows.some((r, i) => r.unit_id === unitId && i !== puEditIndex);
  if (isDuplicate) {
    showPuFormError('Satuan ini sudah ditambahkan');
    return;
  }

  const rowData = {
    id: puEditIndex !== null ? productUnitRows[puEditIndex].id : null,
    unit_id: unitId,
    unit_name: unitObj.name,
    abbreviation: unitObj.abbreviation,
    conversion_qty: conversionQty,
    selling_price: sellingPrice,
    is_default: 0
  };

  if (puEditIndex !== null) {
    productUnitRows[puEditIndex] = rowData;
  } else {
    productUnitRows.push(rowData);
  }

  // Persist immediately if editing existing product
  if (editingProductId) {
    const saveResult = await window.api.productUnits.save(editingProductId, productUnitRows);
    if (!saveResult.success) {
      showToast('Gagal menyimpan satuan jual', 'error');
      return;
    }
    // Reload from DB to get IDs
    const fresh = await window.api.productUnits.getByProduct(editingProductId);
    if (fresh.success) {
      productUnitRows = fresh.units.map(u => ({
        id: u.id,
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        abbreviation: u.abbreviation || '',
        conversion_qty: u.conversion_qty,
        selling_price: u.selling_price,
        is_default: u.is_default
      }));
    }
  }

  const baseUnit = document.getElementById('unit').value;
  renderProductUnitsRows(baseUnit);
  closeProductUnitModal();
  showToast(puEditIndex !== null ? 'Satuan jual diupdate' : 'Satuan jual ditambahkan', 'success');
}

function showPuFormError(message) {
  const el = document.getElementById('productUnitFormError');
  el.textContent = message;
  el.style.display = 'block';
}

// ============================================
// PRODUCT PRICES (MULTI-HARGA / GROSIR)
// ============================================

// Buffer: array of { tier_name, min_qty, price }
let productPriceRows = [];
let ppEditIndex = null;

async function loadProductPricesForEdit(productId) {
  try {
    const result = await window.api.productPrices.getByProduct(productId);
    productPriceRows = result.success ? result.prices.map(p => ({
      tier_name: p.tier_name,
      min_qty: p.min_qty,
      price: p.price
    })) : [];
  } catch (error) {
    console.error('loadProductPricesForEdit error:', error);
    productPriceRows = [];
  }
  renderProductPricesRows();
  document.getElementById('productPricesSection').classList.remove('hidden');
}

function renderProductPricesRows() {
  const container = document.getElementById('productPricesContainer');

  if (productPriceRows.length === 0) {
    container.innerHTML = `<p class="text-center" style="color:#888; font-size:13px;">Belum ada tier harga. Klik "+ Tambah Tier Harga" untuk menambahkan.</p>`;
    return;
  }

  container.innerHTML = `
    <table class="data-table" style="font-size:13px;">
      <thead>
        <tr>
          <th>Nama Tier</th>
          <th>Qty Minimum</th>
          <th>Harga per Satuan</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${productPriceRows.map((row, idx) => `
          <tr>
            <td>${escapeHtml(row.tier_name)}</td>
            <td>≥ ${row.min_qty}</td>
            <td>${formatCurrency(row.price)}</td>
            <td class="action-buttons">
              <button type="button" class="btn-icon" onclick="editProductPriceRow(${idx})" title="Edit">✏️</button>
              <button type="button" class="btn-icon" onclick="deleteProductPriceRow(${idx})" title="Hapus">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function openAddProductPriceModal() {
  if (!editingProductId) {
    showToast('Simpan produk terlebih dahulu sebelum menambahkan tier harga', 'warning');
    return;
  }

  ppEditIndex = null;
  document.getElementById('productPriceModalTitle').textContent = 'Tambah Tier Harga';
  document.getElementById('productPriceForm').reset();
  document.getElementById('ppEditIndex').value = '';
  document.getElementById('productPriceFormError').style.display = 'none';
  document.getElementById('btnSubmitProductPriceText').textContent = 'Simpan';
  document.getElementById('productPriceModal').style.display = 'flex';
  setTimeout(() => document.getElementById('ppTierName').focus(), 100);
}

function editProductPriceRow(idx) {
  const row = productPriceRows[idx];
  ppEditIndex = idx;

  document.getElementById('productPriceModalTitle').textContent = 'Edit Tier Harga';
  document.getElementById('ppEditIndex').value = idx;
  document.getElementById('ppTierName').value = row.tier_name;
  document.getElementById('ppMinQty').value = row.min_qty;
  document.getElementById('ppPrice').value = row.price;
  document.getElementById('productPriceFormError').style.display = 'none';
  document.getElementById('btnSubmitProductPriceText').textContent = 'Update';
  document.getElementById('productPriceModal').style.display = 'flex';
  setTimeout(() => document.getElementById('ppTierName').focus(), 100);
}

function deleteProductPriceRow(idx) {
  showConfirm('Konfirmasi Hapus', 'Yakin ingin menghapus tier harga ini?', async () => {
    productPriceRows.splice(idx, 1);
    if (editingProductId) {
      await window.api.productPrices.save(editingProductId, productPriceRows);
    }
    renderProductPricesRows();
    showToast('Tier harga dihapus', 'success');
  });
}

function closeProductPriceModal() {
  document.getElementById('productPriceModal').style.display = 'none';
  document.getElementById('productPriceForm').reset();
  ppEditIndex = null;
}

async function handleProductPriceFormSubmit(e) {
  e.preventDefault();

  const tierName = document.getElementById('ppTierName').value.trim();
  const minQty = parseFloat(document.getElementById('ppMinQty').value) || 0;
  const price = parseFloat(document.getElementById('ppPrice').value) || 0;

  if (!tierName) {
    showPpFormError('Nama tier harus diisi');
    return;
  }
  if (minQty <= 0) {
    showPpFormError('Qty minimum harus lebih dari 0');
    return;
  }
  if (price <= 0) {
    showPpFormError('Harga harus lebih dari 0');
    return;
  }

  const rowData = { tier_name: tierName, min_qty: minQty, price };

  if (ppEditIndex !== null) {
    productPriceRows[ppEditIndex] = rowData;
  } else {
    productPriceRows.push(rowData);
  }

  // Sort by min_qty ascending
  productPriceRows.sort((a, b) => a.min_qty - b.min_qty);

  if (editingProductId) {
    const saveResult = await window.api.productPrices.save(editingProductId, productPriceRows);
    if (!saveResult.success) {
      showToast('Gagal menyimpan tier harga', 'error');
      return;
    }
    // Refresh from DB
    const fresh = await window.api.productPrices.getByProduct(editingProductId);
    if (fresh.success) {
      productPriceRows = fresh.prices.map(p => ({ tier_name: p.tier_name, min_qty: p.min_qty, price: p.price }));
    }
  }

  renderProductPricesRows();
  closeProductPriceModal();
  showToast(ppEditIndex !== null ? 'Tier harga diupdate' : 'Tier harga ditambahkan', 'success');
}

function showPpFormError(message) {
  const el = document.getElementById('productPriceFormError');
  el.textContent = message;
  el.style.display = 'block';
}