// Kasir Page - POS System
let currentUser = null;
let cart = [];
let currentDiscount = { type: 'none', value: 0, amount: 0 };
let currentTax = { percent: 0, amount: 0 };
let searchTimeout = null;
// pending product for unit selection
let pendingProduct = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('Kasir page loaded');

  // Initialize page layout
  if (!initializePageLayout('kasir')) {
    return;
  }

  currentUser = getCurrentUser();

  // Load draft if exists
  loadDraft();

  // Setup event listeners
  setupEventListeners();

  // Focus on search input
  setTimeout(() => {
    document.getElementById('productSearch').focus();
  }, 100);
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Product search with debounce
  document.getElementById('productSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const keyword = e.target.value.trim();
    
    if (keyword.length < 2) {
      hideSuggestions();
      return;
    }

    searchTimeout = setTimeout(() => {
      searchProduct(keyword);
    }, 300);
  });

  // Product search - Enter key
  document.getElementById('productSearch').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const keyword = e.target.value.trim();

      if (keyword) {
        const result = await window.api.products.getByBarcode(keyword);
        if (result.success && result.product) {
          document.getElementById('productSearch').value = '';
          hideSuggestions();
          await addToCartWithUnitSelect(result.product);
        }
      }
    }
  });

  // Discount type toggle
  document.getElementById('discountTypePercent').addEventListener('click', () => {
    setDiscountType('percent');
  });
  
  document.getElementById('discountTypeAmount').addEventListener('click', () => {
    setDiscountType('amount');
  });

  // Discount value input
  document.getElementById('discountValue').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value) || 0;
    applyDiscount(currentDiscount.type, value);
  });

  // Tax input
  document.getElementById('taxPercent').addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value) || 0;
    calculateTax(percent);
  });

  // Action buttons
  document.getElementById('btnPayment').addEventListener('click', openPaymentModal);
  document.getElementById('btnHold').addEventListener('click', saveDraft);
  document.getElementById('btnCancel').addEventListener('click', confirmClearCart);

  // Payment modal
  document.getElementById('closePaymentModal').addEventListener('click', closePaymentModal);
  document.getElementById('btnCancelPayment').addEventListener('click', closePaymentModal);
  document.getElementById('btnProcessPayment').addEventListener('click', processTransaction);

  // Payment amount input - auto calculate change
  document.getElementById('paymentAmount').addEventListener('input', calculateChange);

  // Unit select modal
  document.getElementById('closeUnitSelectModal').addEventListener('click', closeUnitSelectModal);

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.product-search-box')) {
      hideSuggestions();
    }
    if (e.target === document.getElementById('unitSelectModal')) {
      closeUnitSelectModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ============================================
// PRODUCT SEARCH
// ============================================

async function searchProduct(keyword) {
  try {
    const result = await window.api.products.search(keyword);
    
    if (result.success && result.products.length > 0) {
      showProductSuggestions(result.products);
    } else {
      hideSuggestions();
    }
  } catch (error) {
    console.error('Search product error:', error);
  }
}

function showProductSuggestions(products) {
  const container = document.getElementById('productSuggestions');
  
  container.innerHTML = products.map(product => `
    <div class="suggestion-item" onclick="selectProduct(${product.id})">
      <div class="suggestion-main">
        <strong>${escapeHtml(product.name)}</strong>
        <span class="suggestion-barcode">${escapeHtml(product.barcode)}</span>
      </div>
      <div class="suggestion-details">
        <span class="suggestion-price">${formatCurrency(product.selling_price)}</span>
        <span class="suggestion-stock">Stok: ${product.stock}</span>
      </div>
    </div>
  `).join('');
  
  container.style.display = 'block';
}

function hideSuggestions() {
  document.getElementById('productSuggestions').style.display = 'none';
}

async function selectProduct(productId) {
  try {
    const result = await window.api.products.getById(productId);

    if (result.success) {
      document.getElementById('productSearch').value = '';
      hideSuggestions();
      await addToCartWithUnitSelect(result.product);
    }
  } catch (error) {
    console.error('Select product error:', error);
  }
}

// Cek satuan jual tersedia; jika > 1 tampilkan modal, jika hanya 1 langsung tambah
async function addToCartWithUnitSelect(product) {
  try {
    const result = await window.api.productUnits.getByProduct(product.id);
    const units = result.success ? result.units : [];

    if (units.length > 1) {
      openUnitSelectModal(product, units);
    } else if (units.length === 1) {
      const u = units[0];
      addToCart(product, 1, {
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        conversion_qty: u.conversion_qty,
        selling_price: u.selling_price
      });
    } else {
      // Tidak ada product_units — gunakan satuan dasar produk
      addToCart(product, 1, null);
    }
  } catch (error) {
    console.error('addToCartWithUnitSelect error:', error);
    addToCart(product, 1, null);
  }
}

// ============================================
// CART MANAGEMENT
// ============================================

// unitInfo = { unit_id, unit_name, conversion_qty, selling_price } | null (gunakan satuan dasar)
function addToCart(product, quantity, unitInfo) {
  const unitName = unitInfo ? unitInfo.unit_name : (product.unit || 'pcs');
  const unitId = unitInfo ? unitInfo.unit_id : null;
  const conversionQty = unitInfo ? unitInfo.conversion_qty : 1;
  const price = unitInfo ? unitInfo.selling_price : product.selling_price;

  // Stock cek dalam satuan dasar
  const stockNeeded = quantity * conversionQty;
  if (product.stock < stockNeeded) {
    showToast(`Stok ${product.name} tidak mencukupi (tersedia: ${product.stock} ${product.unit || 'pcs'})`, 'error');
    return;
  }

  // Cari item di cart berdasarkan product_id DAN unit_id
  const existingIndex = cart.findIndex(
    item => item.product_id === product.id && item.unit_id === unitId
  );

  if (existingIndex !== -1) {
    const newQty = cart[existingIndex].quantity + quantity;
    const newStockNeeded = newQty * conversionQty;

    if (newStockNeeded > product.stock) {
      showToast(`Stok ${product.name} tidak mencukupi`, 'error');
      return;
    }

    cart[existingIndex].quantity = newQty;
    cart[existingIndex].subtotal = newQty * price;
  } else {
    cart.push({
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode || '',
      price: price,
      quantity: quantity,
      unit: unitName,
      unit_id: unitId,
      conversion_qty: conversionQty,
      subtotal: price * quantity,
      stock: product.stock
    });
  }

  renderCart();
  calculateTotal();
  saveDraft();
  setTimeout(() => document.getElementById('productSearch').focus(), 100);
}

function updateCartItemQty(index, newQty) {
  if (newQty <= 0) {
    removeCartItem(index);
    return;
  }

  const item = cart[index];
  const convQty = item.conversion_qty || 1;
  const stockNeeded = newQty * convQty;

  if (stockNeeded > item.stock) {
    showToast(`Stok tidak mencukupi (tersedia: ${Math.floor(item.stock / convQty)} ${item.unit})`, 'error');
    return;
  }

  cart[index].quantity = newQty;
  cart[index].subtotal = cart[index].quantity * cart[index].price;

  renderCart();
  calculateTotal();
  saveDraft();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  renderCart();
  calculateTotal();
  saveDraft();
}

function clearCart() {
  cart = [];
  currentDiscount = { type: 'none', value: 0, amount: 0 };
  currentTax = { percent: 0, amount: 0 };
  
  document.getElementById('discountValue').value = '';
  document.getElementById('taxPercent').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('paymentMethod').value = 'cash';
  
  renderCart();
  calculateTotal();
  localStorage.removeItem('cart_draft');
}

function renderCart() {
  const tbody = document.getElementById('cartTableBody');
  
  if (cart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center empty-cart">
          Keranjang masih kosong<br>
          <small>Scan barcode atau cari produk untuk mulai transaksi</small>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cart.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.product_name)}</td>
      <td>
        <button class="btn-unit-select" onclick="changeCartItemUnit(${index})" title="Ganti satuan">
          ${escapeHtml(item.unit)}
          <span style="font-size:10px; opacity:0.6;">▼</span>
        </button>
      </td>
      <td>${formatCurrency(item.price)}</td>
      <td>
        <div class="qty-controls">
          <button class="btn-qty" onclick="updateCartItemQty(${index}, ${item.quantity - 1})">-</button>
          <input
            type="number"
            class="qty-input"
            value="${item.quantity}"
            min="1"
            onchange="updateCartItemQty(${index}, parseInt(this.value))"
          >
          <button class="btn-qty" onclick="updateCartItemQty(${index}, ${item.quantity + 1})">+</button>
        </div>
      </td>
      <td><strong>${formatCurrency(item.subtotal)}</strong></td>
      <td>
        <button class="btn-remove" onclick="removeCartItem(${index})" title="Hapus">
          ❌
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// CALCULATIONS
// ============================================

function calculateSubtotal() {
  return cart.reduce((sum, item) => sum + item.subtotal, 0);
}

function setDiscountType(type) {
  currentDiscount.type = type;
  
  // Update toggle buttons
  document.getElementById('discountTypePercent').classList.toggle('active', type === 'percent');
  document.getElementById('discountTypeAmount').classList.toggle('active', type === 'amount');
  
  // Re-calculate with current value
  const value = parseFloat(document.getElementById('discountValue').value) || 0;
  applyDiscount(type, value);
}

function applyDiscount(type, value) {
  const subtotal = calculateSubtotal();
  
  if (type === 'percent') {
    currentDiscount.amount = (subtotal * value) / 100;
  } else if (type === 'amount') {
    currentDiscount.amount = value;
  } else {
    currentDiscount.amount = 0;
  }

  currentDiscount.value = value;
  
  calculateTotal();
}

function calculateTax(percent) {
  const subtotal = calculateSubtotal();
  const afterDiscount = subtotal - currentDiscount.amount;
  
  currentTax.percent = percent;
  currentTax.amount = (afterDiscount * percent) / 100;
  
  calculateTotal();
}

function calculateTotal() {
  const subtotal = calculateSubtotal();
  const afterDiscount = subtotal - currentDiscount.amount;
  const total = afterDiscount + currentTax.amount;

  // Update display
  document.getElementById('cartSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('discountAmount').textContent = formatCurrency(currentDiscount.amount);
  document.getElementById('taxAmount').textContent = formatCurrency(currentTax.amount);
  document.getElementById('cartTotal').textContent = formatCurrency(total);

  return total;
}

// ============================================
// PAYMENT
// ============================================

function openPaymentModal() {
  if (cart.length === 0) {
    showToast('Keranjang masih kosong', 'error');
    return;
  }

  const total = calculateTotal();
  const paymentMethod = document.getElementById('paymentMethod').value;
  
  document.getElementById('paymentTotal').textContent = formatCurrency(total);
  document.getElementById('paymentMethodDisplay').textContent = getPaymentMethodLabel(paymentMethod);
  document.getElementById('paymentAmount').value = '';
  document.getElementById('changeAmount').textContent = 'Rp 0';
  document.getElementById('insufficientWarning').style.display = 'none';
  
  document.getElementById('paymentModal').style.display = 'flex';
  
  setTimeout(() => {
    document.getElementById('paymentAmount').focus();
  }, 100);
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

function calculateChange() {
  const total = calculateTotal();
  const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const change = paymentAmount - total;

  document.getElementById('changeAmount').textContent = formatCurrency(change);

  const btnProcess = document.getElementById('btnProcessPayment');
  const warningEl = document.getElementById('insufficientWarning');

  if (change < 0) {
    btnProcess.disabled = true;
    warningEl.style.display = 'block';
    document.getElementById('changeAmount').style.color = '#e74c3c';
  } else {
    btnProcess.disabled = false;
    warningEl.style.display = 'none';
    document.getElementById('changeAmount').style.color = '#27ae60';
  }
}

async function processTransaction() {
  const total = calculateTotal();
  const paymentAmount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  
  if (paymentAmount < total) {
    showToast('Jumlah uang yang dibayarkan kurang', 'error');
    return;
  }

  const transactionCode = generateTransactionCode();
  const paymentMethod = document.getElementById('paymentMethod').value;
  
  // Ensure all cart items have complete data
  const items = cart.map(item => ({
    product_id: item.product_id,
    product_name: item.product_name,
    barcode: item.barcode || '',
    quantity: item.quantity,
    unit: item.unit || 'pcs',
    unit_id: item.unit_id || null,
    conversion_qty: item.conversion_qty || 1,
    price: item.price,
    subtotal: item.subtotal
  }));

  const transactionData = {
    transaction_code: transactionCode,
    user_id: currentUser.id,
    transaction_date: new Date().toISOString(),
    subtotal: calculateSubtotal(),
    discount_type: currentDiscount.type || 'none',
    discount_value: currentDiscount.value || 0,
    discount_amount: currentDiscount.amount || 0,
    tax_percent: currentTax.percent || 0,
    tax_amount: currentTax.amount || 0,
    total_amount: total,
    payment_method: paymentMethod,
    payment_amount: paymentAmount,
    change_amount: paymentAmount - total,
    customer_name: document.getElementById('customerName').value.trim() || '',
    notes: document.getElementById('notes').value.trim() || '',
    items: items
  };

  console.log('Transaction data to send:', transactionData);

  // Disable button
  const btnProcess = document.getElementById('btnProcessPayment');
  btnProcess.disabled = true;
  btnProcess.textContent = 'Memproses...';

  try {
    const result = await window.api.transactions.create(transactionData);

    if (result.success) {
      // Update cash drawer if payment is cash
      if (paymentMethod === 'cash') {
        try {
          await window.api.cashDrawer.updateSales(total);
          console.log('Cash drawer updated');
        } catch (error) {
          console.error('Failed to update cash drawer:', error);
          // Don't block transaction if cash drawer update fails
        }
      }

      showToast('Transaksi berhasil disimpan!', 'success');
      
      // Close modal
      closePaymentModal();
      
      // Clear cart
      clearCart();
      
      // Open receipt
      window.api.window.openReceipt(result.transactionId);
      
    } else {
      showToast(result.message || 'Gagal menyimpan transaksi', 'error');
      btnProcess.disabled = false;
      btnProcess.textContent = '✓ Proses Pembayaran';
    }
  } catch (error) {
    console.error('Process transaction error:', error);
    showToast('Terjadi kesalahan saat memproses transaksi', 'error');
    btnProcess.disabled = false;
    btnProcess.textContent = '✓ Proses Pembayaran';
  }
}

// ============================================
// UNIT SELECT MODAL
// ============================================

function openUnitSelectModal(product, units) {
  pendingProduct = { product, units };

  document.getElementById('unitSelectProductName').textContent = product.name;

  const list = document.getElementById('unitSelectList');
  list.innerHTML = units.map(u => {
    const maxQty = Math.floor(product.stock / u.conversion_qty);
    const disabled = maxQty <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
    return `
      <button class="btn btn-secondary" style="text-align:left; padding:10px 14px;" ${disabled}
        onclick="selectUnitForCart(${u.unit_id})">
        <strong>${escapeHtml(u.unit_name)}</strong>
        <span style="float:right; color:#888; font-size:12px;">
          ${u.conversion_qty > 1 ? `isi ${u.conversion_qty} &bull; ` : ''}${formatCurrency(u.selling_price)}
          ${maxQty > 0 ? `<br><small>Maks: ${maxQty} ${escapeHtml(u.unit_name)}</small>` : '<br><small style="color:#e74c3c;">Stok habis</small>'}
        </span>
      </button>
    `;
  }).join('');

  document.getElementById('unitSelectModal').style.display = 'flex';
}

function closeUnitSelectModal() {
  document.getElementById('unitSelectModal').style.display = 'none';
  pendingProduct = null;
}

function selectUnitForCart(unitId) {
  if (!pendingProduct) return;

  const { product, units } = pendingProduct;
  const u = units.find(x => x.unit_id === unitId);
  if (!u) return;

  closeUnitSelectModal();
  addToCart(product, 1, {
    unit_id: u.unit_id,
    unit_name: u.unit_name,
    conversion_qty: u.conversion_qty,
    selling_price: u.selling_price
  });
}

async function changeCartItemUnit(index) {
  const item = cart[index];

  try {
    const productResult = await window.api.products.getById(item.product_id);
    if (!productResult.success) return;

    const unitsResult = await window.api.productUnits.getByProduct(item.product_id);
    if (!unitsResult.success || unitsResult.units.length <= 1) return;

    const product = { ...productResult.product };
    // Restore stock karena item sudah di cart, tambahkan kembali untuk validasi
    const currentStockUsed = item.quantity * (item.conversion_qty || 1);
    product.stock = product.stock + currentStockUsed;

    // Simpan index untuk diupdate setelah pilih
    pendingProduct = {
      product,
      units: unitsResult.units,
      replaceCartIndex: index
    };

    document.getElementById('unitSelectProductName').textContent = product.name;

    const list = document.getElementById('unitSelectList');
    list.innerHTML = unitsResult.units.map(u => {
      const maxQty = Math.floor(product.stock / u.conversion_qty);
      const isCurrent = item.unit_id === u.unit_id;
      const disabled = maxQty <= 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
      return `
        <button class="btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}"
          style="text-align:left; padding:10px 14px;" ${disabled}
          onclick="applyUnitChange(${u.unit_id})">
          <strong>${escapeHtml(u.unit_name)}</strong>
          ${isCurrent ? ' <small>(sekarang)</small>' : ''}
          <span style="float:right; color:#888; font-size:12px;">
            ${u.conversion_qty > 1 ? `isi ${u.conversion_qty} &bull; ` : ''}${formatCurrency(u.selling_price)}
            ${maxQty > 0 ? `<br><small>Maks: ${maxQty} ${escapeHtml(u.unit_name)}</small>` : '<br><small style="color:#e74c3c;">Stok habis</small>'}
          </span>
        </button>
      `;
    }).join('');

    document.getElementById('unitSelectModal').style.display = 'flex';
  } catch (error) {
    console.error('changeCartItemUnit error:', error);
  }
}

function applyUnitChange(unitId) {
  if (!pendingProduct) return;

  const { product, units, replaceCartIndex } = pendingProduct;

  if (replaceCartIndex === undefined) {
    selectUnitForCart(unitId);
    return;
  }

  const u = units.find(x => x.unit_id === unitId);
  if (!u) return;

  const item = cart[replaceCartIndex];
  const convQty = u.conversion_qty || 1;
  const stockNeeded = item.quantity * convQty;

  if (stockNeeded > product.stock) {
    // Kurangi qty agar muat
    const maxQty = Math.floor(product.stock / convQty);
    if (maxQty <= 0) {
      showToast('Stok tidak mencukupi untuk satuan ini', 'error');
      closeUnitSelectModal();
      return;
    }
    cart[replaceCartIndex].quantity = maxQty;
  }

  cart[replaceCartIndex].unit = u.unit_name;
  cart[replaceCartIndex].unit_id = u.unit_id;
  cart[replaceCartIndex].conversion_qty = convQty;
  cart[replaceCartIndex].price = u.selling_price;
  cart[replaceCartIndex].subtotal = cart[replaceCartIndex].quantity * u.selling_price;

  closeUnitSelectModal();
  renderCart();
  calculateTotal();
  saveDraft();
}

function getPaymentMethodLabel(method) {
  const labels = {
    cash: 'Cash',
    debit: 'Debit Card',
    credit: 'Credit Card',
    qris: 'QRIS',
    transfer: 'Transfer'
  };
  return labels[method] || method;
}

// ============================================
// DRAFT MANAGEMENT
// ============================================

function saveDraft() {
  const draft = {
    cart,
    discount: currentDiscount,
    tax: currentTax,
    customerName: document.getElementById('customerName').value,
    notes: document.getElementById('notes').value,
    paymentMethod: document.getElementById('paymentMethod').value
  };
  
  localStorage.setItem('cart_draft', JSON.stringify(draft));
  showToast('Draft disimpan', 'info');
}

function loadDraft() {
  const draftStr = localStorage.getItem('cart_draft');
  if (!draftStr) return;

  try {
    const draft = JSON.parse(draftStr);
    
    cart = draft.cart || [];
    currentDiscount = draft.discount || { type: 'none', value: 0, amount: 0 };
    currentTax = draft.tax || { percent: 0, amount: 0 };
    
    document.getElementById('customerName').value = draft.customerName || '';
    document.getElementById('notes').value = draft.notes || '';
    document.getElementById('paymentMethod').value = draft.paymentMethod || 'cash';
    
    if (currentDiscount.value > 0) {
      document.getElementById('discountValue').value = currentDiscount.value;
      setDiscountType(currentDiscount.type);
    }
    
    if (currentTax.percent > 0) {
      document.getElementById('taxPercent').value = currentTax.percent;
    }

    renderCart();
    calculateTotal();
    
    if (cart.length > 0) {
      showToast('Draft dimuat', 'info');
    }
  } catch (error) {
    console.error('Load draft error:', error);
  }
}

function confirmClearCart() {
  if (cart.length === 0) {
    return;
  }

  showConfirm(
    'Konfirmasi Batal',
    'Yakin ingin membatalkan transaksi ini? Semua item akan dihapus.',
    () => {
      clearCart();
      showToast('Transaksi dibatalkan', 'info');
    }
  );
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function handleKeyboardShortcuts(e) {
  // F2: Focus search
  if (e.key === 'F2') {
    e.preventDefault();
    document.getElementById('productSearch').focus();
  }

  // F8: Open payment modal
  if (e.key === 'F8') {
    e.preventDefault();
    openPaymentModal();
  }

  // F9: Save draft
  if (e.key === 'F9') {
    e.preventDefault();
    saveDraft();
  }

  // ESC: Clear cart (with confirmation)
  if (e.key === 'Escape') {
    // Close modal if open
    if (document.getElementById('paymentModal').style.display === 'flex') {
      closePaymentModal();
    } else {
      confirmClearCart();
    }
  }
}