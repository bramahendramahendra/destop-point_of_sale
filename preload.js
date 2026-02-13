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
    create: (productData) => ipcRenderer.invoke('products:create', productData),
    update: (id, productData) => ipcRenderer.invoke('products:update', id, productData),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    toggleStatus: (id) => ipcRenderer.invoke('products:toggleStatus', id)
  },
  window: {
    loadLoginPage: () => ipcRenderer.send('load-login-page')
  }
});