// library-api.js
/**
 * Robust API client for Library Management System
 * - auto-refresh on 401 (one retry)
 * - timeout support
 * - consistent error shape
 * - safe JSON handling
 * - helper for query strings
 */

class LibraryAPI {
  constructor(baseURL = '/api', options = {}) {
    this.baseURL = baseURL.replace(/\/+$/, ''); // no trailing slash
    this.token = localStorage.getItem('authToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.userId = localStorage.getItem('userId');
    this.defaultTimeout = options.defaultTimeout || 15000; // ms
    this.autoRefresh = options.autoRefresh ?? true;
    this._isRefreshing = false;
  }

  // --------- storage helpers ----------
  setAuthToken(token, refreshToken = null, userId = null) {
    this.token = token;
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('refreshToken', refreshToken);
    }
    if (userId !== null && userId !== undefined) {
      this.userId = String(userId);
      localStorage.setItem('userId', this.userId);
    }
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  clearAuth() {
    this.token = null;
    this.refreshToken = null;
    this.userId = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }

  // --------- small utilities ----------
  _url(endpoint) {
    if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
    return `${this.baseURL}${endpoint}`;
  }

  _buildQuery(params = {}) {
    const esc = encodeURIComponent;
    const parts = [];
    for (const k in params) {
      const v = params[k];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        v.forEach(x => parts.push(`${esc(k)}=${esc(String(x))}`));
      } else {
        parts.push(`${esc(k)}=${esc(String(v))}`);
      }
    }
    return parts.length ? `?${parts.join('&')}` : '';
  }

  _getAuthHeader() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // Consistent error object
  _makeError(response, payload = null) {
    return {
      status: response?.status ?? 0,
      ok: !!(response && response.ok),
      message: (payload && payload.message) || response?.statusText || 'Network or server error',
      data: (payload && payload.data) ?? payload,
      raw: payload,
    };
  }

  // --------- core request with auto-refresh ----------
  async request(endpoint, method = 'GET', data = null, useAuth = false, { timeout = this.defaultTimeout, retry = true } = {}) {
    const url = this._url(endpoint);
    const headers = { 'Content-Type': 'application/json', ... (useAuth ? this._getAuthHeader() : {}) };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const options = {
      method,
      headers,
      signal: controller.signal,
      // Ensure session cookies are sent & received for same-origin calls
      credentials: 'same-origin'
    };

    if (data != null && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    let response;
    let text = null;
    let payload = null;

    try {
      response = await fetch(url, options);
      clearTimeout(id);

      // try parse JSON safely
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        payload = await response.json().catch(() => null);
      } else {
        // try text (for 204 or html)
        text = await response.text().catch(() => null);
        payload = text;
      }

      if (response.ok) {
        // support responses that wrap in { status, data, message } or raw data
        if (payload && typeof payload === 'object' && ('status' in payload || 'data' in payload || 'message' in payload)) {
          return payload;
        }
        return { status: 'success', data: payload, message: null };
      }

      // handle 401 -> try refresh once (if allowed)
      if (response.status === 401 && useAuth && this.autoRefresh && retry) {
        const refreshed = await this._attemptRefresh();
        if (refreshed) {
          // retry original request once
          return this.request(endpoint, method, data, useAuth, { timeout, retry: false });
        }
      }

      const err = this._makeError(response, payload);
      throw err;
    } catch (err) {
      clearTimeout(id);
      // AbortError or fetch network error
      if (err.name === 'AbortError') {
        throw { status: 0, ok: false, message: 'Request timeout', data: null };
      }
      // If it's our generated error object, rethrow
      if (err && typeof err === 'object' && 'ok' in err) throw err;
      // Unexpected error
      throw { status: 0, ok: false, message: err.message || String(err), data: null };
    }
  }

  // --------- token refresh ----------
  async _attemptRefresh() {
    if (!this.refreshToken) return false;
    if (this._isRefreshing) {
      // if a refresh is already ongoing, wait a short while for it to finish and check token
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (!this._isRefreshing) break;
      }
      return !!this.token;
    }

    this._isRefreshing = true;
    try {
      // Backend expects refresh_token in body or X-Refresh-Token header.
      const res = await this.request('/auth/refresh-token', 'POST', { refresh_token: this.refreshToken }, false, { timeout: 10000, retry: false });
      if (res && res.data) {
        const newAccess = res.data.access_token || res.data.token;
        const newRefresh = res.data.refresh_token || this.refreshToken;
        const uid = res.data.user_id || this.userId;
        if (newAccess) {
          this.setAuthToken(newAccess, newRefresh, uid);
          return true;
        }
      }
      // failed to refresh
      this.clearAuth();
      return false;
    } catch (e) {
      // refresh failed
      this.clearAuth();
      return false;
    } finally {
      this._isRefreshing = false;
    }
  }
  // Add to LibraryAPI class in library-api.js


  // --------- convenience wrappers for endpoints ---------
  // Auth
  register(name, email, password, passwordConfirm) {
    return this.request('/auth/register', 'POST', { name, email, password, password_confirm: passwordConfirm });
  }

  async login(email, password, isAdmin = false) {

    const endpoint = isAdmin ? '/auth/admin/login' : '/auth/login';

    const res = await this.request(endpoint, 'POST', { email, password });

    // Backend returns { access_token, refresh_token, user_id, ... }
    if (res && res.data) {
      const access = res.data.access_token || res.data.token || null;
      const refresh = res.data.refresh_token || null;
      const uid = res.data.user_id ?? res.data.admin_id ?? null;

      if (access) {
        this.setAuthToken(access, refresh, uid);
        // Store admin flag if this is an admin login
        if (isAdmin || res.data.role === 'admin' || res.data.is_admin) {
          localStorage.setItem('isAdmin', 'true');
        }
      }
    }
    return res;
  }
  async logout() {
    try {
      const response = await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      // Clear local storage regardless of API response
      this.clearAuth();
      return await response.json();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API call fails
      this.clearAuth();
      throw error;
    }

  }
  forgotPassword(email) { return this.request('/auth/forgot-password', 'POST', { email }); }
  resetPassword(token, password, passwordConfirm) { return this.request('/auth/reset-password', 'POST', { token, password, password_confirm: passwordConfirm }); }
  checkSession() { return this.request('/auth/check-session', 'GET', null, true); }
  refreshToken() { return this.request('/auth/refresh-token', 'POST', null, true); }
  bootstrapSession() { return this.request('/auth/bootstrap-session', 'POST', null, true); }

  // Users (examples)
  async getProfile() {
    try {
      // ✅ FIX: Use this.baseURL and correct endpoint
      const response = await fetch(`${this.baseURL}/users/profile`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      return await response.json();
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }
  updateProfile(name, phone, address) { return this.request('/users/profile', 'PUT', { name, phone, address }, true); }
  changePassword(currentPassword, newPassword, confirmPassword) { return this.request('/users/change-password', 'POST', { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }, true); }
  async getUserStats() {
    try {
      // ✅ FIX: Use this.baseURL and correct endpoint
      const response = await fetch(`${this.baseURL}/users/stats`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Get user stats error:', error);
      throw error;
    }
  }

  // Management helpers (example: query builder)
  // User Management Methods
  getAllUsers(params = {}) {
    const queryParams = this._buildQuery(params);
    return this.request(`/users${queryParams}`, 'GET', null, true);
  }

  getUser(userId) {
    return this.request(`/users/${userId}`, 'GET', null, true);
  }

  updateUser(userId, userData) {
    return this.request(`/users/${userId}`, 'PUT', userData, true);
  }

  updateUserStatus(userId, status) {
    return this.request(`/users/${userId}/status`, 'PUT', { status }, true);
  }

  deleteUser(userId) {
    return this.request(`/users/${userId}`, 'DELETE', null, true);
  }

  getUserStats() {
    return this.request('/users/stats', 'GET', null, true);
  }

  // Books (examples)
  getBooks({ page = 1, limit = 10, category = null, search = null, sort = null } = {}) {
    const q = this._buildQuery({ page, limit, category, search, sort });
    return this.request(`/books${q}`, 'GET');
  }
  getCategories() {
    return this.request('/categories', 'GET');
  }
  getBook(bookId) { return this.request(`/books/${bookId}`, 'GET'); }
  addAdminBook(bookData) {
    return this.request('/books', 'POST', bookData, true);
  }
  updateAdminBook(bookId, payload) { return this.request(`/books/${bookId}`, 'PUT', payload, true); }
  deleteAdminBook(bookId) { return this.request(`/books/${bookId}`, 'DELETE', null, true); }

  // Subscriptions (examples)
  getPlans() { return this.request('/subscriptions/plans', 'GET'); }
  subscribe(planId, autoRenew = true) { return this.request('/subscriptions/subscribe', 'POST', { plan_id: planId, auto_renew: autoRenew }, true); }
  cancelSubscription(subscriptionId) { return this.request('/subscriptions/cancel', 'POST', { subscription_id: subscriptionId }, true); }

  // Analytics / system
  healthCheck() { return this.request('/health', 'GET'); }
  systemStatus() { return this.request('/status', 'GET', null, true); }
  // Contact / Messages (Admin)
  getContactMessages({ page = 1, limit = 20, status = null, search = null } = {}) {
    const q = this._buildQuery({ page, limit, status, search });
    return this.request(`/contact/messages${q}`, 'GET', null, true);
  }

  getContactMessage(id) {
    return this.request(`/contact/messages/${id}`, 'GET', null, true);
  }

  replyContactMessage(id, reply) {
    return this.request(`/contact/messages/${id}/reply`, 'POST', { reply }, true);
  }

  updateContactMessageStatus(id, status) {
    return this.request(`/contact/messages/${id}/status`, 'PUT', { status }, true);
  }

  deleteContactMessage(id) {
    return this.request(`/contact/messages/${id}`, 'DELETE', null, true);
  }

  getContactStats() {
    return this.request(`/contact/stats`, 'GET', null, true);
  }
  // Admin specific methods
  adminSignup(adminCode, username, email, password, confirmPassword) {
    return this.request('/auth/admin/signup', 'POST', {
      admin_code: adminCode,
      username: username,
      email: email,
      password: password,
      confirm_password: confirmPassword
    });
  }

  // Generate admin code (super admin only)
  generateAdminCode(expiresDays = 30, maxUses = 1) {
    return this.request('/auth/admin/generate-code', 'POST', {
      expires_days: expiresDays,
      max_uses: maxUses
    }, true);
  }
  async adminLogin(email, password) {
    const res = await this.request('/auth/admin/login', 'POST', { email, password });

    if (res && res.data) {
      const access = res.data.access_token;
      const refresh = res.data.refresh_token;
      const adminId = res.data.admin_id;

      if (access) {
        this.setAuthToken(access, refresh, adminId);
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminRole', res.data.role || 'admin');
      }
    }
    return res;
  }

  async adminCheckSession() {
    return this.request('/auth/admin/check-session', 'GET', null, true);
  }

  adminSignup(adminCode, username, email, password, confirmPassword) {
    return this.request('/auth/admin/signup', 'POST', {
      admin_code: adminCode,
      username: username,
      email: email,
      password: password,
      confirm_password: confirmPassword
    });
  }

  // Admin code management
  generateAdminCode(expiresDays = 30, maxUses = 1, description = 'Admin signup code') {
    return this.request('/auth/admin/generate-code', 'POST', {
      expires_days: expiresDays,
      max_uses: maxUses,
      description: description
    }, true);
  }

  getAdminCodes() {
    return this.request('/auth/admin/codes', 'GET', null, true);
  }

  deactivateAdminCode(code) {
    return this.request('/auth/admin/deactivate-code', 'POST', {
      code: code
    }, true);
  }

  // Admin dashboard and management
  getAdminProfile() {
    return this.request('/admin/profile', 'GET', null, true);
  }

  getAdminDashboard() {
    return this.request('/admin/dashboard', 'GET', null, true);
  }

  getAdminList(page = 1, limit = 10) {
    return this.request(`/admin/list?page=${page}&limit=${limit}`, 'GET', null, true);
  }

  getAdminLogs(page = 1, limit = 20) {
    return this.request(`/admin/logs?page=${page}&limit=${limit}`, 'GET', null, true);
  }

  getRecentActivity(limit = 10) {
    return this.request(`/admin/activity?limit=${limit}`, 'GET', null, true);
  }

  // Clear auth with admin-specific cleanup
  clearAuth() {
    this.token = null;
    this.refreshToken = null;
    this.userId = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminRole');
  }

  // Check if user is admin
  isAdmin() {
    return localStorage.getItem('isAdmin') === 'true';
  }

  // Check if user is super admin
  isSuperAdmin() {
    return this.isAdmin() && localStorage.getItem('adminRole') === 'super_admin';
  }

  // ===== BORROWING METHODS =====
  borrowBook(bookId) {
    return this.request('/borrow', 'POST', { book_id: bookId }, true);
  }

  returnBook(bookId) {
    return this.request('/return-book', 'POST', { book_id: bookId }, true);
  }

  getUserBorrowings(userId) {
    return this.request(`/users/${userId}/borrowings`, 'GET', null, true);
  }

  getCurrentUserBorrowings() {
    const userId = this.userId || localStorage.getItem('userId');
    if (!userId) {
      return Promise.reject(new Error('User not logged in'));
    }
    return this.getUserBorrowings(userId);
  }

  // Add to your LibraryAPI class
  async resetPool() {
    try {
      const response = await this._request('POST', '/api/admin/reset-pool');
      return response;
    } catch (error) {
      console.error('Pool reset failed:', error);
      throw error;
    }
  }

  // ===== ADMIN USER MANAGEMENT =====
  getAdminUsers(page = 1, limit = 20, search = '', filter = '') {
    const q = this._buildQuery({ page, limit, search, filter });
    return this.request(`/admin/users${q}`, 'GET', null, true);
  }

  getAdminUserDetail(userId) {
    return this.request(`/admin/users/${userId}`, 'GET', null, true);
  }

  updateAdminUser(userId, userData) {
    return this.request(`/admin/users/${userId}`, 'PUT', userData, true);
  }

  suspendUser(userId) {
    return this.request(`/admin/users/${userId}`, 'PUT', { status: 'suspended' }, true);
  }

  unsuspendUser(userId) {
    return this.request(`/admin/users/${userId}`, 'PUT', { status: 'active' }, true);
  }

  // ===== ADMIN SUBSCRIPTIONS =====
  getAdminSubscriptions(page = 1, limit = 20, search = '', filter = '') {
    const q = this._buildQuery({ page, limit, search, filter });
    return this.request(`/admin/subscriptions${q}`, 'GET', null, true);
  }

  updateAdminSubscription(subscriptionId, action) {
    return this.request(`/admin/subscriptions/${subscriptionId}`, 'PUT', { action }, true);
  }

  suspendSubscription(subscriptionId) {
    return this.updateAdminSubscription(subscriptionId, 'suspend');
  }

  resumeSubscription(subscriptionId) {
    return this.updateAdminSubscription(subscriptionId, 'resume');
  }

  downgradeSubscription(subscriptionId) {
    return this.updateAdminSubscription(subscriptionId, 'downgrade');
  }

  // ===== ADMIN ACTIVITY =====
  getAdminActivity(limit = 20) {
    const q = this._buildQuery({ limit });
    return this.request(`/admin/activity${q}`, 'GET', null, true);
  }

  // ===== ADMIN PROFILE (already exists above, but for completeness) =====
  // getAdminProfile() { return this.request('/admin/profile', 'GET', null, true); }
}


// export for Node/CommonJS and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibraryAPI;
} else {
  window.LibraryAPI = LibraryAPI;
}
