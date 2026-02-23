// Receipt Page
let transactionId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Receipt page loaded');

  // Get transaction ID from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  transactionId = parseInt(urlParams.get('id'));

  if (!transactionId) {
    console.error('No transaction ID provided');
    document.querySelector('.receipt-content').innerHTML = '<p class="text-center">Transaksi tidak ditemukan</p>';
    return;
  }

  // Load transaction data
  await loadTransactionData();

  // Auto-print after short delay
  setTimeout(() => {
    autoPrint();
  }, 500);
});

// ============================================
// LOAD DATA
// ============================================

async function loadTransactionData() {
  try {
    const result = await window.api.transactions.getById(transactionId);
    
    if (result.success) {
      displayReceipt(result.transaction);
    } else {
      console.error('Failed to load transaction');
      document.querySelector('.receipt-content').innerHTML = '<p class="text-center">Gagal memuat data transaksi</p>';
    }
  } catch (error) {
    console.error('Load transaction error:', error);
    document.querySelector('.receipt-content').innerHTML = '<p class="text-center">Terjadi kesalahan</p>';
  }
}

// ============================================
// DISPLAY RECEIPT
// ============================================

function displayReceipt(transaction) {
  // Date & Time
  document.getElementById('receiptDate').textContent = formatDateOnly(transaction.transaction_date);
  document.getElementById('receiptTime').textContent = formatTimeOnly(transaction.transaction_date);
  
  // Transaction Info
  document.getElementById('receiptCode').textContent = transaction.transaction_code;
  document.getElementById('receiptCashier').textContent = transaction.cashier_name;
  
  // Customer (if exists)
  if (transaction.customer_name) {
    document.getElementById('receiptCustomerRow').style.display = 'flex';
    document.getElementById('receiptCustomer').textContent = transaction.customer_name;
  }

  // Items
  const itemsBody = document.getElementById('receiptItemsBody');
  itemsBody.innerHTML = transaction.items.map(item => `
    <tr>
      <td colspan="3" class="item-name">${escapeHtml(item.product_name)}</td>
    </tr>
    <tr>
      <td class="item-qty">${item.quantity} ${item.unit}</td>
      <td class="item-price">@ ${formatCurrency(item.price)}</td>
      <td class="item-subtotal">${formatCurrency(item.subtotal)}</td>
    </tr>
  `).join('');

  // Summary
  document.getElementById('receiptSubtotal').textContent = formatCurrency(transaction.subtotal);
  
  if (transaction.discount_amount > 0) {
    document.getElementById('receiptDiscountRow').style.display = 'flex';
    document.getElementById('receiptDiscount').textContent = '- ' + formatCurrency(transaction.discount_amount);
  }

  if (transaction.tax_amount > 0) {
    document.getElementById('receiptTaxRow').style.display = 'flex';
    document.getElementById('receiptTax').textContent = formatCurrency(transaction.tax_amount);
  }

  document.getElementById('receiptTotal').textContent = formatCurrency(transaction.total_amount);
  document.getElementById('receiptPaid').textContent = formatCurrency(transaction.payment_amount);
  document.getElementById('receiptChange').textContent = formatCurrency(transaction.change_amount);
}

// ============================================
// AUTO PRINT
// ============================================

function autoPrint() {
  // Auto-trigger print dialog
  window.print();
}