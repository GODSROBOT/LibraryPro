// User Dashboard - Real Data Integration
(function() {
    'use strict';

    let api;

    // Initialize API
    function initAPI() {
        if (typeof LibraryAPI === 'undefined') {
            console.error('LibraryAPI not found. Make sure library-api.js is loaded first.');
            return false;
        }
        api = new LibraryAPI('/api');
        return true;
    }

    // Load user profile and update name
    async function loadUserProfile() {
        try {
            const response = await api.getProfile();
            const profile = response.data || response;
            
            // Update user name in navbar
            const userName = document.getElementById('userName');
            if (userName && profile.name) {
                userName.textContent = profile.name;
            }
            
            return profile;
        } catch (error) {
            console.error('Failed to load profile:', error);
            return null;
        }
    }

    // Load user statistics
    async function loadUserStats() {
        try {
            const response = await api.request('/users/stats', 'GET', null, true);
            const stats = response.data || response;
            
            // Update stats cards
            // Show current borrowed (not total) in the Books Borrowed stat
            document.getElementById('booksBorrowed').textContent = stats.current_borrowed || 0;
            document.getElementById('booksReturned').textContent = stats.total_returned || 0;
            document.getElementById('readingStreak').textContent = calculateReadingStreak(stats);
            
            return stats;
        } catch (error) {
            console.error('Failed to load stats:', error);
            // Keep default values on error
        }
    }

    // Calculate reading streak (simple calculation based on activity)
    function calculateReadingStreak(stats) {
        // Simple streak calculation: if user has borrowed books recently, show a number
        const borrowed = stats.current_borrowed || 0;
        return borrowed > 0 ? Math.min(borrowed * 3, 30) : 0;
    }

    // Load currently borrowed books
    async function loadCurrentlyBorrowed() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                showNoBorrowedBooks();
                return;
            }

            const response = await api.request(`/users/${userId}/borrowings`, 'GET', null, true);
            
            // Handle nested data structure
            let borrowings = [];
            if (response.data && response.data.borrowings) {
                borrowings = response.data.borrowings;
            } else if (response.borrowings) {
                borrowings = response.borrowings;
            } else if (Array.isArray(response.data)) {
                borrowings = response.data;
            } else if (Array.isArray(response)) {
                borrowings = response;
            }
            
            console.log('Borrowings data:', borrowings);
            
            // Filter only currently borrowed (not returned)
            const currentBorrowed = borrowings.filter(b => b.status === 'borrowed' || (!b.returned_at && !b.status));
            
            console.log('Current borrowed:', currentBorrowed);
            renderBorrowedBooks(currentBorrowed);
        } catch (error) {
            console.error('Failed to load borrowed books:', error);
            showNoBorrowedBooks();
        }
    }

    // Render borrowed books
    function renderBorrowedBooks(books) {
        const container = document.getElementById('currentlyBorrowedList');
        if (!container) return;

        if (books.length === 0) {
            showNoBorrowedBooks();
            return;
        }

        container.innerHTML = books.map(book => `
            <div class="reading-item">
                <div class="book-cover">
                    ${book.image_url ? `<img src="${escapeHtml(book.image_url)}" alt="${escapeHtml(book.title)}">` : '<i class="fas fa-book"></i>'}
                </div>
                <div class="reading-info">
                    <h6>${escapeHtml(book.title || 'Unknown Title')}</h6>
                    <p>${escapeHtml(book.author || 'Unknown Author')}</p>
                    <small>Due: ${formatDate(book.due_at)}</small>
                </div>
                <div class="reading-progress">
                    <div class="progress-circle">
                        <span>${calculateDaysLeft(book.due_at)}</span>
                        <small>days left</small>
                    </div>
                </div>
                <div class="book-actions">
                    <button class="btn-return" onclick="returnBook(${book.id}, ${book.book_id})" title="Return this book">
                        <i class="fas fa-undo"></i> Return
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Show message when no books borrowed
    function showNoBorrowedBooks() {
        const container = document.getElementById('currentlyBorrowedList');
        if (!container) return;
        
        container.innerHTML = `
            <div class="reading-item text-center" style="padding: 2rem;">
                <i class="fas fa-book" style="font-size: 3rem; color: #666; margin-bottom: 1rem;"></i>
                <p style="color: #999;">No books currently borrowed</p>
                <a href="/library/books" class="btn btn-sm" style="margin-top: 1rem;">Browse Books</a>
            </div>
        `;
    }

    // Calculate days left until due date
    function calculateDaysLeft(dueDate) {
        if (!dueDate) return '?';
        const due = new Date(dueDate);
        const now = new Date();
        const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
    }

    // Format date to readable string
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Escape HTML to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Load subscription status
    async function loadSubscriptionStatus() {
        try {
            const profile = await loadUserProfile();
            if (!profile) return;

            const isSubscriber = profile.is_subscriber || false;
            const badge = document.querySelector('.badge-premium');
            const planType = document.querySelector('.subscription-detail strong');
            
            if (badge) {
                badge.textContent = isSubscriber ? 'Premium Active' : 'Free Plan';
                badge.className = isSubscriber ? 'badge-premium' : 'badge-free';
            }

            // Update subscription details
            const renewalDate = document.getElementById('renewalDate');
            const daysRemaining = document.getElementById('daysRemaining');
            
            if (isSubscriber) {
                // Calculate renewal date (30 days from creation for demo)
                const createdAt = new Date(profile.created_at);
                const renewal = new Date(createdAt);
                renewal.setDate(renewal.getDate() + 30);
                
                if (renewalDate) {
                    renewalDate.textContent = formatDate(renewal);
                }
                
                // Calculate days remaining
                const now = new Date();
                const days = Math.ceil((renewal - now) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining) {
                    daysRemaining.textContent = days > 0 ? days : 0;
                }
                
                // Update progress bar
                const progressFill = document.querySelector('.progress-fill');
                if (progressFill) {
                    const percentage = Math.min((days / 30) * 100, 100);
                    progressFill.style.width = percentage + '%';
                }
            } else {
                if (renewalDate) renewalDate.textContent = 'N/A';
                if (daysRemaining) daysRemaining.textContent = '0';
            }
        } catch (error) {
            console.error('Failed to load subscription status:', error);
        }
    }

    // Load recent activity from borrowings
    async function loadRecentActivity() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                showNoActivity();
                return;
            }

            const response = await api.request(`/users/${userId}/borrowings`, 'GET', null, true);
            
            // Handle nested data structure
            let borrowings = [];
            if (response.data && response.data.borrowings) {
                borrowings = response.data.borrowings;
            } else if (response.borrowings) {
                borrowings = response.borrowings;
            } else if (Array.isArray(response.data)) {
                borrowings = response.data;
            } else if (Array.isArray(response)) {
                borrowings = response;
            }
            
            // Get the most recent 5 activities
            const recentBorrowings = borrowings.slice(0, 5);
            
            renderRecentActivity(recentBorrowings);
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            showNoActivity();
        }
    }

    // Render recent activity
    function renderRecentActivity(activities) {
        const container = document.getElementById('recentActivityList');
        if (!container) return;

        if (activities.length === 0) {
            showNoActivity();
            return;
        }

        container.innerHTML = activities.map(activity => {
            const isBorrowed = activity.status === 'borrowed' || !activity.returned_at;
            const iconClass = isBorrowed ? 'borrowed' : 'returned';
            const iconSymbol = isBorrowed ? 'fa-arrow-down' : 'fa-arrow-up';
            const actionText = isBorrowed ? 'Borrowed' : 'Returned';
            const timeAgo = getTimeAgo(isBorrowed ? activity.borrowed_at : activity.returned_at);
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">
                        <i class="fas ${iconSymbol}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${actionText} <strong>${escapeHtml(activity.title || 'Unknown Book')}</strong></p>
                        <small>${timeAgo}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Show message when no activity
    function showNoActivity() {
        const container = document.getElementById('recentActivityList');
        if (!container) return;
        
        container.innerHTML = `
            <div class="activity-item text-center" style="padding: 2rem;">
                <i class="fas fa-history" style="font-size: 3rem; color: #666; margin-bottom: 1rem;"></i>
                <p style="color: #999;">No recent activity</p>
                <a href="/library/books" class="btn btn-sm" style="margin-top: 1rem;">Start Reading</a>
            </div>
        `;
    }

    // Get time ago from date
    function getTimeAgo(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
        if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
        if (seconds < 2592000) return Math.floor(seconds / 604800) + ' weeks ago';
        return formatDate(dateString);
    }

    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideInRight 0.3s ease;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const icon = type === 'success' ? '✓' : '✕';
        notification.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span> ${message}`;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Return book function
    window.returnBook = async function(borrowingId, bookId) {
        if (!confirm('Are you sure you want to return this book?')) {
            return;
        }

        try {
            const response = await api.returnBook(bookId);
            
            if (response.status === 'success') {
                showNotification('Book returned successfully!', 'success');
                
                // Reload the borrowed books list and stats
                await Promise.all([
                    loadCurrentlyBorrowed(),
                    loadUserStats(),
                    loadRecentActivity()
                ]);
            } else {
                showNotification(response.message || 'Failed to return book', 'error');
            }
        } catch (error) {
            console.error('Return book error:', error);
            showNotification(error.message || 'Failed to return book', 'error');
        }
    };

    // Logout function
    window.performLogout = async function() {
        try {
            if (api) {
                await api.logout();
            }
            localStorage.clear();
            window.location.href = '/auth/login';
        } catch (error) {
            console.error('Logout error:', error);
            localStorage.clear();
            window.location.href = '/auth/login';
        }
    };

    // Initialize dashboard
    async function initDashboard() {
        if (!initAPI()) {
            console.error('Failed to initialize API');
            return;
        }

        // Check if user is logged in
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/auth/login';
            return;
        }

        // Load all dashboard data
        try {
            await Promise.all([
                loadUserProfile(),
                loadUserStats(),
                loadCurrentlyBorrowed(),
                loadSubscriptionStatus(),
                loadRecentActivity()
            ]);
            
            console.log('✅ Dashboard loaded successfully');
        } catch (error) {
            console.error('Dashboard initialization error:', error);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
        initDashboard();
    }
})();
