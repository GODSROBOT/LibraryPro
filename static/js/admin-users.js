/**
 * Admin Users Management
 * Handles user management, viewing, and suspending user accounts
 */

const api = new LibraryAPI();
let currentPage = 1;
let currentLimit = 20;
let allUsers = [];
let currentFilters = {
    search: '',
    status: ''
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUsers(1);
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchMembers');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            currentFilters.search = e.target.value;
            loadUsers(1);
        }, 500));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', function(e) {
            currentFilters.status = e.target.value;
            loadUsers(1);
        });
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load users from API
async function loadUsers(page = 1) {
    try {
        const tbody = document.getElementById('membersTableBody');
        if (!tbody) return;

        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-spinner fa-spin"></i> Loading members...
                </td>
            </tr>
        `;

        currentPage = page;

        // Fetch users from API
        const response = await api.getAdminUsers(
            page,
            currentLimit,
            currentFilters.search,
            currentFilters.status
        );

        if (!response || response.status !== 'success') {
            showError('Failed to load users');
            return;
        }

        const data = response.data || {};
        allUsers = data.users || [];
        const total = data.total || 0;
        const pages = Math.ceil(total / currentLimit);

        // Populate table
        if (allUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        No members found
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = allUsers.map(user => createUserRow(user)).join('');
        }

        // Update pagination
        updatePagination(page, pages, total);

    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users: ' + error.message);
    }
}

// Create user table row
function createUserRow(user) {
    const joinDate = formatDate(user.created_at);
    const statusBadge = getStatusBadge(user.status);
    const planBadge = user.is_subscriber ? '<span class="badge bg-premium">Premium</span>' : '<span class="badge bg-light">Free</span>';

    return `
        <tr>
            <td>
                <div class="user-info">
                    <div class="user-avatar">${getInitials(user.name)}</div>
                    <span class="user-name">${escapeHtml(user.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>#M${String(user.id).padStart(4, '0')}</td>
            <td>${joinDate}</td>
            <td>${statusBadge}</td>
            <td>${planBadge}</td>
            <td>
                <span class="borrowed-count">—</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action-small" title="View Details" onclick="viewUserDetails(${user.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-action-small" title="Send Email" onclick="sendEmailToUser(${user.id}, '${escapeHtml(user.email).replace(/'/g, "\\'")}')">
                        <i class="fas fa-envelope"></i>
                    </button>
                    ${user.status === 'suspended' ?
                        `<button class="btn-action-small danger" title="Unsuspend" onclick="unsuspendUser(${user.id})">
                            <i class="fas fa-check"></i>
                        </button>` :
                        `<button class="btn-action-small danger" title="Suspend" onclick="suspendUser(${user.id})">
                            <i class="fas fa-pause"></i>
                        </button>`
                    }
                </div>
            </td>
        </tr>
    `;
}

// View user details
async function viewUserDetails(userId) {
    try {
        const response = await api.getAdminUserDetail(userId);

        if (!response || response.status !== 'success') {
            showError('Failed to load user details');
            return;
        }

        const user = response.data.user;
        const stats = response.data.borrow_stats || {};
        const history = response.data.borrowing_history || [];

        // Populate modal with details
        document.getElementById('detailName').textContent = user.name;
        document.getElementById('detailEmail').textContent = user.email;
        document.getElementById('detailId').textContent = `#M${String(user.id).padStart(4, '0')}`;
        document.getElementById('detailJoinDate').textContent = formatDate(user.created_at);
        document.getElementById('detailStatus').textContent = user.status.charAt(0).toUpperCase() + user.status.slice(1);
        document.getElementById('detailPlan').textContent = user.is_subscriber ? 'Premium' : 'Free';
        document.getElementById('detailBorrowed').textContent = stats.total_borrowed || 0;
        document.getElementById('detailOverdue').textContent = stats.currently_borrowed || 0;

        // Show modal
        const modal = document.getElementById('memberModal');
        if (modal) {
            modal.style.display = 'block';
        }

    } catch (error) {
        console.error('Error loading user details:', error);
        showError('Failed to load user details: ' + error.message);
    }
}

// Suspend user
async function suspendUser(userId) {
    if (!confirm('Are you sure you want to suspend this user account?')) return;

    try {
        const response = await api.suspendUser(userId);

        if (!response || response.status !== 'success') {
            showError('Failed to suspend user');
            return;
        }

        showSuccess('User suspended successfully');
        loadUsers(currentPage);

    } catch (error) {
        console.error('Error suspending user:', error);
        showError('Failed to suspend user: ' + error.message);
    }
}

// Unsuspend user
async function unsuspendUser(userId) {
    if (!confirm('Are you sure you want to unsuspend this user account?')) return;

    try {
        const response = await api.unsuspendUser(userId);

        if (!response || response.status !== 'success') {
            showError('Failed to unsuspend user');
            return;
        }

        showSuccess('User unsuspended successfully');
        loadUsers(currentPage);

    } catch (error) {
        console.error('Error unsuspending user:', error);
        showError('Failed to unsuspend user: ' + error.message);
    }
}

// Send email to user
function sendEmailToUser(userId, email) {
    alert(`Email feature not yet implemented.\nWill send email to: ${email}`);
}

// Close member modal
function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Update pagination
function updatePagination(page, totalPages, totalItems) {
    const container = document.querySelector('.pagination-container');
    if (!container) return;

    const prevBtn = container.querySelector('.btn-page:nth-of-type(1)');
    const pageInfo = container.querySelector('.page-info');
    const nextBtn = container.querySelector('.btn-page:nth-of-type(2)');

    if (prevBtn) {
        prevBtn.disabled = page === 1;
        prevBtn.onclick = () => loadUsers(page - 1);
    }

    if (pageInfo) {
        pageInfo.textContent = `Page ${page} of ${totalPages} (${totalItems} total members)`;
    }

    if (nextBtn) {
        nextBtn.disabled = page === totalPages;
        nextBtn.onclick = () => loadUsers(page + 1);
    }
}

// Helper functions
function getStatusBadge(status) {
    const badges = {
        'active': '<span class="badge bg-success">Active</span>',
        'inactive': '<span class="badge bg-secondary">Inactive</span>',
        'suspended': '<span class="badge bg-danger">Suspended</span>'
    };
    return badges[status] || `<span class="badge bg-light">${status}</span>`;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showError(message) {
    console.error(message);
    // You can add a toast notification here
    alert(message);
}

function showSuccess(message) {
    console.log(message);
    // You can add a toast notification here
    alert(message);
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('memberModal');
    if (event.target === modal) {
        closeMemberModal();
    }
});
