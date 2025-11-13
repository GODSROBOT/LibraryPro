// book_management.js - Enhanced Admin Books Management JS
// Integrates with LibraryAPI (library-api.js) and your Flask /api/books endpoints.

// -------------------------
// Initialization
// -------------------------
let api; // Changed from const to let
let bookToDelete = { id: null, title: '', author: '' };

document.addEventListener('DOMContentLoaded', async () => {
  await initializeBookManagement();
});

async function initializeBookManagement() {
  try {
    // Initialize admin page with connection status
    const connectionStatus = await AdminUtils.initializeAdminPage();

    // Initialize API
    api = AdminUtils.api;

    // Initialize book-specific functionality
    initFormHandlers();
    initSearchHandlers();
    initModalHandlers();
    attachEditSubmit();
    attachStatsButton();

    // Load books data if connected
    if (connectionStatus.connected || connectionStatus.authed) {
      await loadBooks();
    } else {
      AdminUtils.showNotification('Running in limited mode - some features may not work', 'warning');
    }

    console.log('✅ Admin Books Management JS Loaded and initialized');
  } catch (error) {
    console.error('Failed to initialize book management:', error);
    AdminUtils.showNotification('Failed to initialize book management', 'error');
  }
}

// -------------------------
// Logout
// -------------------------
window.performLogout = async function () {
  if (!confirm("Are you sure you want to logout?")) return;
  showNotification("Logging out...", "info");
  stopRealTimeUpdates();
  try {
    await api.logout();
  } catch (_) {
    // Even if logout API fails, clear local storage
    api.clearAuth();
  }
  setTimeout(() => (window.location.href = "/admin/authentication/login.html"), 800);
};


// -------------------------
// UI Utilities
// -------------------------
function showNotification(message, type = 'info') {
  // Use AdminUtils if available, otherwise use local implementation
  if (typeof AdminUtils !== 'undefined') {
    return AdminUtils.showNotification(message, type);
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;

  if (!document.getElementById('adminNotificationStyle')) {
    const style = document.createElement('style');
    style.id = 'adminNotificationStyle';
    style.textContent = `
            .notification { position: fixed; top: 90px; right: 20px; padding: 12px 18px; border-radius: 8px; backdrop-filter: blur(6px); border: 1px solid rgba(255,255,255,0.06); z-index: 10000; animation: slideIn 0.25s ease; display:flex; align-items:center; gap:10px; font-weight:500; }
            .notification-success { background: rgba(34,197,94,0.12); color:#166534; border-color: rgba(34,197,94,0.2); }
            .notification-info { background: rgba(59,130,246,0.08); color:#1e40af; border-color: rgba(59,130,246,0.16); }
            .notification-error { background: rgba(239,68,68,0.08); color:#b91c1c; border-color: rgba(239,68,68,0.16); }
            @keyframes slideIn { from { transform: translateX(300px); opacity:0 } to { transform: translateX(0); opacity:1 } }
        `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 400);
  }, 2800);
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"']/g, function (s) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s];
  });
}

// -------------------------
// Form & Preview
// -------------------------
function initFormHandlers() {
  const form = document.getElementById('addBooksForm');
  if (form) form.addEventListener('submit', handleAddBook);

  const inputs = ['bookName', 'author', 'bookType', 'bookPrice', 'bookRate', 'description'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
}

async function handleAddBook(e) {
  e.preventDefault();
  const title = document.getElementById('bookName').value.trim();
  if (!title) return showNotification('Title is required', 'error');

  const author = document.getElementById('author').value.trim();
  if (!author) return showNotification('Author is required', 'error');

  const payload = {
    title,
    author,
    category: document.getElementById('bookType').value || '',
    price: parseFloat(document.getElementById('bookPrice').value) || 0,
    rating: parseFloat(document.getElementById('bookRate').value) || 0,
    total_copies: parseInt(document.getElementById('availability')?.value || 1) || 1,
    available_copies: parseInt(document.getElementById('availability')?.value || 1) || 1,
    description: document.getElementById('description').value || '',
    image_url: document.getElementById('imageUrl')?.value || '',
    reviews: parseInt(document.getElementById('reviews')?.value || 0) || 0,
    has_pdf: 0
  };

  try {
    const res = await api.addAdminBook(payload);
    if (res && res.status === 'success') {
      showNotification('Book added successfully!', 'success');
      document.getElementById('addBooksForm').reset();
      updatePreview();
      await loadBooks();
    } else {
      const errMsg = (res && res.message) || 'Failed to add book';
      showNotification(errMsg, 'error');
    }
  } catch (err) {
    showNotification(err.message || 'Server error', 'error');
    console.error('Add book error', err);
  }
}

function updatePreview() {
  const title = document.getElementById('bookName')?.value || 'Book Title';
  const author = document.getElementById('author')?.value || 'Author Name';
  const genre = document.getElementById('bookType')?.value || 'Genre';
  const price = document.getElementById('bookPrice')?.value || '9.99';
  const rating = document.getElementById('bookRate')?.value || '4.8';
  const description = document.getElementById('description')?.value || 'Book description preview...';

  document.getElementById('previewTitle') && (document.getElementById('previewTitle').textContent = title);
  document.getElementById('previewAuthor') && (document.getElementById('previewAuthor').textContent = author);
  document.getElementById('previewDescription') && (document.getElementById('previewDescription').textContent = description);

  const badges = `<span class="badge">${escapeHtml(genre)}</span> <span class="badge">⭐ ${escapeHtml(rating)}</span> <span class="badge">$${escapeHtml(price)}</span>`;
  const info = document.querySelector('.preview-info');
  if (info) info.innerHTML = badges;
}

// -------------------------
// Load / Render Books
// -------------------------
async function loadBooks({ page = 1, limit = 50, search = '' } = {}) {
  try {
    const q = new URLSearchParams({ page, limit, search }).toString();
    const res = await api.getBooks({ page, limit, search });
    // Normalize response
    let books = [];
    if (res && res.data && Array.isArray(res.data.books)) books = res.data.books;
    else if (res && Array.isArray(res)) books = res;

    renderBooksTable(books);
  } catch (err) {
    console.error('Load books error', err);
    showNotification('Failed to load books', 'error');
  }
}

function renderBooksTable(books) {
  const tbody = document.querySelector('#manageBooksTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  books.forEach(b => {
    const tr = document.createElement('tr');
    tr.dataset.bookId = b.id;

    tr.innerHTML = `
      <td>${escapeHtml(b.title || '')}</td>
      <td>${escapeHtml(b.author || '')}</td>
      <td>${escapeHtml(b.category || '')}</td>
      <td>${typeof b.price === 'number' ? '$' + b.price.toFixed(2) : '$' + escapeHtml(b.price || '0')}</td>
      <td>${escapeHtml(String(b.available_copies || 0))}</td>
      <td>
        <button class="btn-edit" data-id="${b.id}">Edit</button>
        <button class="btn-delete" data-id="${b.id}" data-title="${escapeHtml(b.title || '')}" data-author="${escapeHtml(b.author || '')}">Delete</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach delete & edit handlers
  tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => {
    const id = btn.dataset.id; const title = btn.dataset.title; const author = btn.dataset.author;
    initiateDelete(id, title, author);
  }));

  tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => {
    const id = btn.dataset.id;
    openEdit(id);
  }));
}

// -------------------------
// Search & Filter
// -------------------------
function initSearchHandlers() {
  const searchManage = document.getElementById('searchManage');
  if (searchManage) searchManage.addEventListener('input', function () { filterManageBooks(this.value); });
}

function filterManageBooks(term = '') {
  const rows = document.querySelectorAll('#manageBooksTable tbody tr');
  const s = term.toLowerCase();
  rows.forEach(row => {
    const title = row.cells[0].textContent.toLowerCase();
    const author = row.cells[1].textContent.toLowerCase();
    row.style.display = (title.includes(s) || author.includes(s)) ? '' : 'none';
  });
}

// -------------------------
// Delete with 2FA modal (simulated)
// -------------------------
function initiateDelete(id, title, author) {
  bookToDelete = { id, title, author };
  const titleEl = document.getElementById('deleteBookTitle');
  const authorEl = document.getElementById('deleteBookAuthor');
  if (titleEl) titleEl.textContent = title;
  if (authorEl) authorEl.textContent = `by ${author}`;
  document.getElementById('twoFactorModal')?.classList.add('active');
}

// -------------------------
// Modal handlers
// -------------------------
function initModalHandlers() {
  // Close modals on background click
  document.querySelectorAll('.modal-overlay').forEach(mod => {
    mod.addEventListener('click', (e) => { if (e.target === mod) mod.classList.remove('active'); });
  });
}

function closeModal() {
  document.getElementById('twoFactorModal')?.classList.remove('active');
  const form = document.getElementById('twoFactorForm');
  if (form) form.reset();
}

function closeEditModal() { document.getElementById('editModal')?.classList.remove('active'); }

// Export global functions for HTML onclick handlers
window.closeModal = closeModal;
window.closeEditModal = closeEditModal;
window.verifyAndDelete = verifyAndDelete;

async function verifyAndDelete(e) {
  e.preventDefault();
  const code = document.getElementById('twoFactorCode')?.value || '';
  if (code.length !== 6) return showNotification('2FA code must be 6 digits', 'error');

  // For demo / dev, accept code '123456' or any 6-digit numeric code and call delete
  if (!/^[0-9]{6}$/.test(code)) return showNotification('Invalid code format', 'error');

  try {
    // Call admin delete endpoint
    const res = await api.deleteAdminBook(bookToDelete.id);
    if (res && res.status === 'success') {
      showNotification(`Book "${bookToDelete.title}" deleted successfully`, 'success');
      closeModal();
      await loadBooks();
    } else {
      showNotification(res.message || 'Failed to delete book', 'error');
    }
  } catch (err) {
    console.error('Delete error', err);
    showNotification(err.message || 'Server error deleting book', 'error');
  }
}

// Hook 2FA form
document.addEventListener('DOMContentLoaded', () => {
  const twoFactorForm = document.getElementById('twoFactorForm');
  if (twoFactorForm) twoFactorForm.addEventListener('submit', verifyAndDelete);

  // close modals on background click
  document.querySelectorAll('.modal').forEach(mod => {
    mod.addEventListener('click', (e) => { if (e.target === mod) mod.classList.remove('active'); });
  });
});

// -------------------------
// Edit Book
// -------------------------
function editBook(title, id) {
  // open edit modal and populate
  document.getElementById('editBookName').value = title || '';
  const editForm = document.getElementById('editForm');
  if (editForm) editForm.dataset.bookId = id;
  document.getElementById('editModal')?.classList.add('active');
}

async function openEdit(bookId) {
  try {
    const res = await api.getBook(bookId);
    let b = res && res.data ? res.data : (res || {});
    document.getElementById('editBookName').value = b.title || '';
    document.getElementById('editPrice').value = b.price || '';
    document.getElementById('editRating').value = b.rating || '';
    document.getElementById('editAvailability').value = b.available_copies || '';
    document.getElementById('editDescription').value = b.description || '';
    const editForm = document.getElementById('editForm');
    if (editForm) editForm.dataset.bookId = bookId;
    document.getElementById('editModal')?.classList.add('active');
  } catch (err) {
    console.error('Open edit error', err);
    showNotification('Failed to open book for editing', 'error');
  }
}

function attachEditSubmit() {
  const editForm = document.getElementById('editForm');
  if (!editForm) return;
  editForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const bookId = this.dataset.bookId;
    if (!bookId) return showNotification('No book selected', 'error');

    const payload = {
      title: document.getElementById('editBookName').value,
      price: parseFloat(document.getElementById('editPrice').value) || 0,
      rating: parseFloat(document.getElementById('editRating').value) || 0,
      available_copies: parseInt(document.getElementById('editAvailability').value) || 0,
      description: document.getElementById('editDescription').value || ''
    };

    try {
      const res = await api.updateAdminBook(bookId, payload);
      if (res && res.status === 'success') {
        showNotification('Book updated successfully', 'success');
        document.getElementById('editModal')?.classList.remove('active');
        await loadBooks();
      } else {
        showNotification(res.message || 'Failed to update book', 'error');
      }
    } catch (err) {
      console.error('Update book error', err);
      showNotification(err.message || 'Server error', 'error');
    }
  });
}

// -------------------------
// Stats
// -------------------------
function attachStatsButton() {
  const btn = document.getElementById('btnGetStats');
  if (btn) btn.addEventListener('click', showStats);
}

async function showStats(e) {
  try {
    // LibraryAPI doesn't have a dedicated method, so call request directly
    const res = await api.request('/books/stats', 'GET', null, true);
    if (res && res.data) {
      const stats = res.data;
      showNotification(`Total books: ${stats.total_books} | Available copies: ${stats.available_copies} | Categories: ${stats.categories}`, 'info');
    } else {
      showNotification('Failed to fetch stats', 'error');
    }
  } catch (err) {
    console.error('Stats error', err);
    showNotification(err.message || 'Server error fetching stats', 'error');
  }
}

// -------------------------
// Misc helpers
// -------------------------
window.viewStats = function (bookTitle) {
  showNotification(`Viewing stats for "${bookTitle}" - open detailed page to view more`, 'info');
};

// FIX: Remove the duplicate editBook function and use the main one directly
window.editBook = editBook;

// Expose a manual reload for convenience
window.reloadBooks = function () { loadBooks(); };

// Also expose for re-initialization after AJAX load
window.reinitializeBookManagement = initializeBookManagement;