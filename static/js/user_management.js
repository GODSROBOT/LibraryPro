// Enhanced Admin Users Management JavaScript with API Integration

let api;

// Initialize API when DOM loads
document.addEventListener('DOMContentLoaded', async function () {
    try {
        api = new LibraryAPI('/api');
        await initializeUserManagement();
    } catch (error) {
        console.error('Failed to initialize user management:', error);
        showNotification('Failed to initialize user management system', 'error');
    }
});

async function initializeUserManagement() {
    try {
        // Initialize admin page with connection status
        const connectionStatus = await AdminUtils.initializeAdminPage();

        // Initialize API
        api = AdminUtils.api;

        // Initialize user-specific functionality
        setupEventListeners();

        // Only load data if we're on a user management page and connected
        if (document.querySelector('.admin-container') && (connectionStatus.connected || connectionStatus.authed)) {
            await loadUsersData();
            await loadUserStats();
        }

        console.log('✅ User Management initialized successfully');
    } catch (error) {
        console.error('Failed to initialize user management:', error);
        AdminUtils.showNotification('Failed to initialize user management system', 'error');
    }
}
// ===== LOAD LIVE USER DATA =====
async function loadUsersData() {
    try {
        showNotification('Loading users data...', 'info');

        const response = await api.getAdminUsers(1, 50);

        const users = response.data?.users || response.users || [];
        renderUsersTable(users);
        updatePaginationInfo(response.data);

    } catch (error) {
        console.error('Failed to load users:', error);
        showNotification('Failed to load users data', 'error');
        // Fallback to mock data if API fails
        renderMockUsers();
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-users fa-2x text-muted mb-2"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="member-info">
                    <div class="member-avatar">${getInitials(user.name)}</div>
                    <span>${escapeHtml(user.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>#M${String(user.id).padStart(3, '0')}</td>
            <td>${formatDate(user.created_at)}</td>
            <td><span class="status-badge ${user.status}">${capitalizeFirst(user.status)}</span></td>
            <td><span class="plan-badge ${getUserPlan(user)}">${getUserPlanDisplay(user)}</span></td>
            <td>${getUserBookCount(user)}</td>
            <td>
                <button class="btn-action view" onclick="viewMemberDetails(${user.id})" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action edit" onclick="editMember(${user.id})" title="Edit User">
                    <i class="fas fa-edit"></i>
                </button>
                ${user.status !== 'banned' ?
            `<button class="btn-action ban" onclick="banUser(${user.id})" title="Ban User">
                        <i class="fas fa-ban"></i>
                    </button>` :
            `<button class="btn-action unban" onclick="unbanUser(${user.id})" title="Unban User">
                        <i class="fas fa-check"></i>
                    </button>`
        }
            </td>
        </tr>
    `).join('');
}

// ===== LOAD USER STATS =====
async function loadUserStats() {
    try {
        const response = await api.getUserStats();
        const stats = response.data || response;

        // Update stats cards if they exist
        updateStatsCards(stats);
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
}

function updateStatsCards(stats) {
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
        statCards[0].querySelector('.stat-value').textContent = stats.total_users?.toLocaleString() || '0';
        statCards[1].querySelector('.stat-value').textContent = stats.active_users?.toLocaleString() || '0';
        statCards[2].querySelector('.stat-value').textContent = stats.inactive_users?.toLocaleString() || '0';
        statCards[3].querySelector('.stat-value').textContent = stats.banned_users?.toLocaleString() || '0';
    }
}

// ===== USER ACTIONS =====
async function viewMemberDetails(userId) {
    try {
        const response = await api.getAdminUserDetail(userId);
        const user = response.data?.user || response.data || response;
        showUserDetailsModal(user);
    } catch (error) {
        console.error('Failed to load user details:', error);
        showNotification('Failed to load user details', 'error');
    }
}

async function editMember(userId) {
    try {
        const response = await api.getAdminUserDetail(userId);
        const user = response.data?.user || response.data || response;
        showEditUserModal(user);
    } catch (error) {
        console.error('Failed to load user for editing:', error);
        showNotification('Failed to load user data', 'error');
    }
}

async function banUser(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
        await api.updateAdminUser(userId, { status: 'suspended' });
        showNotification('User banned successfully', 'success');
        await loadUsersData();
    } catch (error) {
        console.error('Failed to ban user:', error);
        showNotification('Failed to ban user', 'error');
    }
}

async function unbanUser(userId) {
    if (!confirm('Are you sure you want to unban this user?')) return;

    try {
        await api.updateAdminUser(userId, { status: 'active' });
        showNotification('User unbanned successfully', 'success');
        await loadUsersData();
    } catch (error) {
        console.error('Failed to unban user:', error);
        showNotification('Failed to unban user', 'error');
    }
}

// ===== MODAL FUNCTIONS =====
function showUserDetailsModal(user) {
    document.getElementById('detailName').textContent = user.name || 'N/A';
    document.getElementById('detailEmail').textContent = user.email || 'N/A';
    document.getElementById('detailId').textContent = `#M${String(user.id).padStart(3, '0')}`;
    document.getElementById('detailJoinDate').textContent = formatDate(user.created_at);
    document.getElementById('detailStatus').textContent = capitalizeFirst(user.status);
    document.getElementById('detailPlan').textContent = getUserPlanDisplay(user);
    document.getElementById('detailBorrowed').textContent = getUserBookCount(user);
    document.getElementById('detailReturned').textContent = 'Loading...'; // You might need additional API for this
    document.getElementById('detailOverdue').textContent = 'Loading...'; // You might need additional API for this
    document.getElementById('detailReadingTime').textContent = 'Loading...'; // You might need additional API for this

    document.getElementById('memberModal').classList.add('active');
}

function closeMemberModal() {
    document.getElementById('memberModal')?.classList.remove('active');
}

function closeModalAction(action) {
    closeMemberModal();
    if (action === 'send-email') {
        showNotification('Email functionality coming soon', 'info');
    } else if (action === 'suspend') {
        showNotification('Use the ban/suspend button in the table', 'info');
    }
}

function showEditUserModal(user) {
    // Implement edit modal functionality
    showNotification(`Editing user: ${user.name}`, 'info');
    // You can create a separate edit modal similar to the details modal
}

// ===== UTILITY FUNCTIONS =====
function getInitials(name) {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'UU';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getUserPlan(user) {
    // This would need to check user's subscription status from your database
    // For now, using a simple logic based on user properties
    return user.is_premium ? 'premium' : 'free';
}

function getUserPlanDisplay(user) {
    const plan = getUserPlan(user);
    return plan === 'premium' ? 'Premium' : 'Free';
}

function getUserBookCount(user) {
    // This would need to query borrowings for this user
    // For now, returning a placeholder
    return '0';
}

function updatePaginationInfo(pagination) {
    const pageInfo = document.querySelector('.page-info');
    if (pageInfo && pagination) {
        pageInfo.textContent = `Page ${pagination.page} of ${pagination.pages} (${pagination.total} total users)`;
    }
}

// ===== MOCK DATA FALLBACK =====
function renderMockUsers() {
    const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active', created_at: new Date().toISOString() },
        { id: 2, name: 'Sarah Miller', email: 'sarah@example.com', status: 'active', created_at: new Date().toISOString() },
        { id: 3, name: 'Michael Chen', email: 'michael@example.com', status: 'active', created_at: new Date().toISOString() },
        { id: 4, name: 'Emily Parker', email: 'emily@example.com', status: 'inactive', created_at: new Date().toISOString() }
    ];
    renderUsersTable(mockUsers);
}

// ===== SEARCH & FILTER =====
function setupEventListeners() {
    const searchMembers = document.getElementById('searchMembers');
    if (searchMembers) {
        searchMembers.addEventListener('input', debounce(async function (e) {
            await searchUsers(e.target.value);
        }, 300));
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', async function (e) {
            await filterUsersByStatus(e.target.value);
        });
    }
}

async function searchUsers(searchTerm) {
    try {
        const response = await api.getAdminUsers(1, 50, searchTerm);
        const users = response.data?.users || response.users || [];
        renderUsersTable(users);
    } catch (error) {
        console.error('Search failed:', error);
    }
}

async function filterUsersByStatus(status) {
    try {
        const response = await api.getAdminUsers(1, 50, '', status);
        const users = response.data?.users || response.users || [];
        renderUsersTable(users);
    } catch (error) {
        console.error('Filter failed:', error);
    }
}

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


// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    if (!document.getElementById('userMgmtNotificationStyle')) {
        const style = document.createElement('style');
        style.id = 'userMgmtNotificationStyle';
        style.textContent = `
            .notification {
                position: fixed;
                top: 90px;
                right: 20px;
                padding: 12px 18px;
                border-radius: 8px;
                backdrop-filter: blur(6px);
                border: 1px solid rgba(255,255,255,0.06);
                z-index: 10000;
                animation: slideIn 0.25s ease;
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 500;
            }
            .notification-success {
                background: rgba(34,197,94,0.12);
                color: #166534;
                border-color: rgba(34,197,94,0.2);
            }
            .notification-info {
                background: rgba(59,130,246,0.08);
                color: #1e40af;
                border-color: rgba(59,130,246,0.16);
            }
            .notification-error {
                background: rgba(239,68,68,0.08);
                color: #b91c1c;
                border-color: rgba(239,68,68,0.16);
            }
            @keyframes slideIn {
                from { transform: translateX(300px); opacity: 0 }
                to { transform: translateX(0); opacity: 1 }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 400);
    }, 2800);
}

// Export for reinitialization after AJAX load
window.reinitializeUserManagement = initializeUserManagement;
window.closeMemberModal = closeMemberModal;
window.closeModalAction = closeModalAction;
window.viewMemberDetails = viewMemberDetails;
window.editMember = editMember;
window.banUser = banUser;
window.unbanUser = unbanUser;