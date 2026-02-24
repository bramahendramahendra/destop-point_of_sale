const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser')
  },
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    getById: (id) => ipcRenderer.invoke('users:getById', id),
    create: (userData) => ipcRenderer.invoke('users:create', userData),
    update: (id, userData) => ipcRenderer.invoke('users:update', id, userData),
    delete: (id) => ipcRenderer.invoke('users:delete', id),
    toggleStatus: (id) => ipcRenderer.invoke('users:toggleStatus', id)
  },
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    getById: (id) => ipcRenderer.invoke('categories:getById', id),
    create: (categoryData) => ipcRenderer.invoke('categories:create', categoryData),
    update: (id, categoryData) => ipcRenderer.invoke('categories:update', id, categoryData),
    delete: (id) => ipcRenderer.invoke('categories:delete', id)
  },
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
    getById: (id) => ipcRenderer.invoke('products:getById', id),
    getByBarcode: (barcode) => ipcRenderer.invoke('products:getByBarcode', barcode),
    search: (keyword) => ipcRenderer.invoke('products:search', keyword),
    create: (productData) => ipcRenderer.invoke('products:create', productData),
    update: (id, productData) => ipcRenderer.invoke('products:update', id, productData),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    toggleStatus: (id) => ipcRenderer.invoke('products:toggleStatus', id)
  },
  transactions: {
    create: (transactionData) => ipcRenderer.invoke('transactions:create', transactionData),
    getAll: (filters) => ipcRenderer.invoke('transactions:getAll', filters),
    getById: (id) => ipcRenderer.invoke('transactions:getById', id),
    void: (id) => ipcRenderer.invoke('transactions:void', id)
  },
  cashDrawer: {
    getCurrent: () => ipcRenderer.invoke('cashDrawer:getCurrent'),
    open: (data) => ipcRenderer.invoke('cashDrawer:open', data),
    close: (id, data) => ipcRenderer.invoke('cashDrawer:close', id, data),
    getHistory: (filters) => ipcRenderer.invoke('cashDrawer:getHistory', filters),
    getById: (id) => ipcRenderer.invoke('cashDrawer:getById', id),
    updateSales: (amount) => ipcRenderer.invoke('cashDrawer:updateSales', amount),
    updateExpenses: (amount) => ipcRenderer.invoke('cashDrawer:updateExpenses', amount)
  },
  expenses: {
    getAll: (filters) => ipcRenderer.invoke('expenses:getAll', filters),
    getById: (id) => ipcRenderer.invoke('expenses:getById', id),
    create: (expenseData) => ipcRenderer.invoke('expenses:create', expenseData),
    update: (id, expenseData) => ipcRenderer.invoke('expenses:update', id, expenseData),
    delete: (id) => ipcRenderer.invoke('expenses:delete', id)
  },
  purchases: {
    getAll: (filters) => ipcRenderer.invoke('purchases:getAll', filters),
    getById: (id) => ipcRenderer.invoke('purchases:getById', id),
    create: (purchaseData) => ipcRenderer.invoke('purchases:create', purchaseData),
    update: (id, purchaseData) => ipcRenderer.invoke('purchases:update', id, purchaseData),
    delete: (id) => ipcRenderer.invoke('purchases:delete', id),
    pay: (id, amount) => ipcRenderer.invoke('purchases:pay', id, amount)
  },
  finance: {
    getDashboard: (filters) => ipcRenderer.invoke('finance:getDashboard', filters),
    getTopProducts: (filters) => ipcRenderer.invoke('finance:getTopProducts', filters)
  },
  window: {
    loadLoginPage: () => ipcRenderer.send('load-login-page'),
    openReceipt: (transactionId) => ipcRenderer.send('window:openReceipt', transactionId)
  }
});