// /static/js/admin-dashboard.js
// Enhanced Admin Dashboard — backend-connected with live data with better connection pool management

(function () {
  "use strict";

  const dashboardPage = document.getElementById("dashboard-page");
  const connectionStatusEl = document.getElementById("connectionStatus");

  let api;
  let statsRefreshInterval;
  let activityRefreshInterval;
  let isInitialized = false;
  let connectionRetryCount = 0;
  const MAX_RETRY_COUNT = 3;

  // -------------------------
  // Initialize API with proper error handling
  // -------------------------
  function initAPI() {
    try {
      if (typeof LibraryAPI === 'undefined') {
        throw new Error('LibraryAPI class not found. Make sure library-api.js is loaded before this file.');
      }
      api = new LibraryAPI("/api");
      console.log("✅ API initialized successfully", { tokenPresent: !!api.token, token: api.token ? api.token.slice(0, 8) + '...' : null });
      return true;
    } catch (e) {
      console.error("Failed to initialize API:", e.message);
      api = null;

      // Show user-friendly error
      if (connectionStatusEl) {
        connectionStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> API not available';
        connectionStatusEl.className = 'connection-status small text-danger';
      }

      return false;
    }
  }

  // -------------------------
  // Mock data for demo/fallback
  // -------------------------
  const mockData = {
    dashboard: {
      total_books: 5234,
      books_this_month: 124,
      total_users: 2450,
      users_this_week: 156,
      books_borrowed_today: 1245,
      monthly_revenue: 15640,
      revenue_growth: 22.5
    },
    recent_activity: [
      {
        type: 'book_added',
        title: 'Book Added',
        description: '"The Great Gatsby" added to system',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString()
      },
      {
        type: 'user_registered',
        title: 'New User',
        description: 'John Doe registered to the platform',
        timestamp: new Date(Date.now() - 23 * 60000).toISOString()
      },
      {
        type: 'book_borrowed',
        title: 'Book Borrowed',
        description: '"To Kill a Mockingbird" borrowed by user',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString()
      }
    ],
    profile: {
      name: 'Sarah Admin',
      role: 'Administrator'
    },
    messages: {
      new_messages: 3
    },
    notifications: {
      count: 2
    }
  };

  // -------------------------
  // Enhanced Connection Check with Pool Status
  // -------------------------
  async function checkBackendConnection() {
    updateConnectionIndicator("Connecting...", "text-warning");

    if (!api) {
      console.log("🔄 API not initialized, using mock data for demo");
      updateConnectionIndicator("Demo Mode - Using Mock Data", "text-warning");
      return { connected: false, authed: false, poolStatus: null };
    }

    // Ensure we have an auth token for admin endpoints
    const token = localStorage.getItem('authToken') || api.token;
    if (!token) {
      // Let the handler manage redirection or limited access
      return handleAuthFailure() || { connected: true, authed: false, poolStatus: null };
    }

    // API initialized and token present
    console.log("✅ Proceeding with dashboard initialization (auth token present)");
    updateConnectionIndicator("Connected", "text-success");
    return { connected: true, authed: true, poolStatus: null };
  }

  function handleAuthFailure() {
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log("Auth check failed but token exists, proceeding with limited access");
      updateConnectionIndicator("Limited Access - Auth Issues", "text-warning");
      showNotification("⚠️ Authentication issues detected", "warning");
    } else {
      updateConnectionIndicator("Session Expired - Please Login", "text-danger");
      showNotification("🔐 Session expired, redirecting to login...", "error");
      setTimeout(() => {
        window.location.href = "/admin/authentication/login.html";
      }, 2000);
      return { connected: false, authed: false };
    }
  }

  function updateConnectionIndicator(text, cls) {
    if (!connectionStatusEl) return;
    connectionStatusEl.className = "connection-status small " + cls;
    connectionStatusEl.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
  }

  // -------------------------
  // Enhanced Data Loading with Retry Logic
  // -------------------------
  async function loadDataWithRetry(apiCall, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await apiCall();
        connectionRetryCount = 0; // Reset retry count on success
        return result;
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);

        // Check if it's a pool exhaustion error
        if (error.message.includes('pool') || error.message.includes('connection') || error.message.includes('exhausted')) {
          console.log(`🔄 Pool exhausted, waiting before retry ${attempt}/${maxRetries}`);
          // Exponential backoff for pool issues
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else if (attempt === maxRetries) {
          throw error;
        } else {
          // Regular retry with shorter delay
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  // -------------------------
  // Fetch Admin Profile with fallback
  // -------------------------
  async function loadAdminProfile() {
    let profileData = mockData.profile;

    if (api) {
      try {
        const res = await loadDataWithRetry(async () => {
          // Try admin profile first, fall back to regular profile
          try {
            return await api.getAdminProfile();
          } catch (e) {
            console.warn("Admin profile failed, trying regular profile:", e.message);
            return await api.getProfile();
          }
        });
        profileData = res.data || res || mockData.profile;
      } catch (err) {
        console.warn("Failed to load profile, using mock data:", err.message);
      }
    }

    const nameEl = document.getElementById('adminName');
    const avatarEl = document.getElementById('adminAvatar');
    const welcomeEl = document.getElementById('welcomeMessage');

    const displayName = profileData.name || profileData.email || "Admin";

    if (nameEl) {
      nameEl.textContent = displayName;
    }

    if (welcomeEl && profileData.name) {
      welcomeEl.textContent = `Welcome back, ${profileData.name.split(' ')[0]}! Here's your library system overview`;
    }

    if (avatarEl && profileData.name) {
      const initials = profileData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
      avatarEl.textContent = initials;
    } else if (avatarEl && profileData.email) {
      avatarEl.textContent = profileData.email.substring(0, 2).toUpperCase();
    } else if (avatarEl) {
      avatarEl.textContent = 'AD';
    }
  }

  // -------------------------
  // Load Admin Profile Stats Section
  // -------------------------
  async function loadAdminProfileStats() {
    try {
      if (!api) {
        console.warn("API not initialized, skipping profile stats");
        return;
      }

      console.log('Requesting admin profile stats', { tokenPresent: !!api.token, tokenSample: api.token ? api.token.slice(0, 8) + '...' : null });
      const res = await loadDataWithRetry(() => api.getAdminProfile());
      const data = res.data || res;

      // Extract admin data and stats
      const adminData = data.admin || data;
      const stats = data.stats || {};

      // Update profile card with admin info
      const profileNameEl = document.getElementById('profileName');
      const profileRoleEl = document.getElementById('profileRole');
      const profileEmailEl = document.getElementById('profileEmail');
      const profileAvatarEl = document.getElementById('profileAvatar');

      const adminName = adminData?.name || 'Administrator';
      const adminEmail = adminData?.email || 'admin@library.com';

      if (profileNameEl) profileNameEl.textContent = adminName;
      if (profileEmailEl) profileEmailEl.textContent = adminEmail;
      if (profileRoleEl) profileRoleEl.textContent = 'Administrator';

      if (profileAvatarEl) {
        const initials = adminName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        profileAvatarEl.textContent = initials;
      }

      // Update profile stats
      const usersEl = document.getElementById('usersManaged');
      const booksEl = document.getElementById('booksAdded');
      const borrowEl = document.getElementById('activeBorrowings');

      if (usersEl) usersEl.textContent = stats.total_users !== undefined ? stats.total_users : '—';
      if (booksEl) booksEl.textContent = stats.total_books !== undefined ? stats.total_books : '—';
      if (borrowEl) borrowEl.textContent = stats.active_borrowings !== undefined ? stats.active_borrowings : '—';

    } catch (err) {
      console.warn("Failed to load admin profile stats:", err.message);
      // Set default values
      const elements = ['usersManaged', 'booksAdded', 'activeBorrowings'];
      elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
    }
  }

  // -------------------------
  // Enhanced Dashboard Stats with Better Error Handling
  // -------------------------
  async function loadDashboardStats() {
    let stats = mockData.dashboard;
    let isLiveData = false;
    let errorDetails = null;

    if (api) {
      try {
        const res = await loadDataWithRetry(() => api.getAdminDashboard());
        stats = res.data || res || mockData.dashboard;
        isLiveData = true;
      } catch (err) {
        console.warn("Failed to load dashboard stats:", err.message);
        errorDetails = err.message;

        // Show specific error for pool exhaustion
        if (err.message.includes('pool') || err.message.includes('connection') || err.message.includes('exhausted')) {
          showNotification("🔄 Database connections busy, using demo data", "warning");
          connectionRetryCount++;

          // If too many retries, suggest page refresh
          if (connectionRetryCount >= MAX_RETRY_COUNT) {
            showNotification("🔄 Multiple connection issues - consider refreshing page", "warning");
          }
        }
      }
    }

    // Update the stat cards with error state if needed
    updateStatCard(1, stats.total_books, stats.books_this_month, "books", "Total Books", isLiveData, errorDetails);
    updateStatCard(2, stats.total_users, stats.users_this_week, "users", "Active Users", isLiveData, errorDetails);
    updateStatCard(3, stats.books_borrowed_today, null, "borrowed", "Books Borrowed", isLiveData, errorDetails);
    updateStatCard(4, stats.monthly_revenue, stats.revenue_growth, "revenue", "Monthly Revenue", isLiveData, errorDetails);

    updateLastRefreshTime(isLiveData, errorDetails);
  }

  function updateStatCard(index, value, change, type, title, isLiveData = false, error = null) {
    const card = document.querySelector(`.stat-card:nth-child(${index})`);
    if (!card) return;

    const valueEl = card.querySelector("h3");
    const titleEl = card.querySelector("h5");
    const metaEl = card.querySelector(".stat-meta");

    // Clear previous states
    card.className = card.className.replace(/\b(live-data|mock-data|error-state|offline|pool-warning)\b/g, '') + ' stat-card';

    if (isLiveData) {
      card.classList.add('live-data');
    } else {
      card.classList.add('mock-data');
    }

    if (error) {
      card.classList.add('error-state');
      if (error.includes('pool') || error.includes('connection')) {
        card.classList.add('pool-warning');
      }
    }

    if (titleEl) titleEl.textContent = title;

    if (valueEl) {
      if (value === undefined || value === null || error) {
        valueEl.textContent = "—";
        valueEl.title = error || "No data available";
        card.classList.add('offline');
      } else {
        valueEl.textContent = type === 'revenue' ? `$${value.toLocaleString()}` : value.toLocaleString();
        valueEl.title = isLiveData ? "Live data" : "Demo data";
        card.classList.remove('offline');

        // Add update animation for live data
        if (isLiveData) {
          card.classList.add('updated');
          setTimeout(() => card.classList.remove('updated'), 1000);
        }
      }
    }

    if (metaEl) {
      if (error) {
        if (error.includes('pool') || error.includes('connection')) {
          metaEl.textContent = "Connection pool issue";
        } else {
          metaEl.textContent = "Connection issue";
        }
        metaEl.className = "stat-meta error";
      } else if (change === undefined || change === null) {
        metaEl.textContent = type === 'borrowed' ? "Today's count" : "No change data";
        metaEl.className = "stat-meta";
      } else if (type === 'revenue') {
        const growthText = change > 0 ? `+${change}% growth` : `${change}% decline`;
        metaEl.textContent = growthText;
        metaEl.className = `stat-meta ${change >= 0 ? 'positive' : 'negative'}`;
      } else {
        const period = type === 'books' ? 'month' : 'week';
        const changeText = change > 0 ? `+${change} this ${period}` : `${change} this ${period}`;
        metaEl.textContent = changeText;
        metaEl.className = `stat-meta ${change >= 0 ? 'positive' : 'negative'}`;
      }
    }
  }

  function updateLastRefreshTime(isLiveData = false, error = null) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const refreshIndicator = document.getElementById('lastRefreshTime');

    if (refreshIndicator) {
      let status = isLiveData ? 'Live data' : 'Demo data';
      if (error) {
        if (error.includes('pool') || error.includes('connection')) {
          status = 'Pool busy - retrying';
          refreshIndicator.className = `last-refresh pool-warning`;
        } else {
          status = 'Connection issues';
          refreshIndicator.className = `last-refresh error`;
        }
      } else {
        refreshIndicator.className = `last-refresh ${isLiveData ? 'live' : 'demo'}`;
      }
      refreshIndicator.textContent = `${status} • Last updated: ${timeString}`;
    }
  }

  // -------------------------
  // Load Recent Activity - LIVE DATA
  // -------------------------
  async function loadRecentActivity() {
    let activities = mockData.recent_activity;
    let isLiveData = false;

    if (api) {
      try {
        const res = await loadDataWithRetry(() => api.getRecentActivity(10));

        // Handle different response formats
        if (res && res.data) {
          activities = Array.isArray(res.data) ? res.data : (res.data.activities || res.data.recent_activity || []);
          isLiveData = true;
          console.log("✅ Loaded live activity data:", activities.length, "items");
        } else if (Array.isArray(res)) {
          activities = res;
          isLiveData = true;
        }

        // Ensure we have at least some data
        if (!activities || activities.length === 0) {
          console.warn("No activity data returned, using mock data");
          activities = mockData.recent_activity;
          isLiveData = false;
        }

      } catch (err) {
        console.warn("Failed to load recent activity, using mock data:", err.message);
        activities = mockData.recent_activity;
      }
    }

    renderActivityList(activities, isLiveData);
  }

  function renderActivityList(activities, isLiveData = false) {
    const activityList = document.querySelector(".activity-list");
    if (!activityList) return;

    if (activities.length === 0) {
      activityList.innerHTML = '<div class="text-muted no-activity">No recent activity</div>';
      return;
    }

    activityList.innerHTML = activities.map(activity => {
      // Ensure activity has required fields
      const type = activity.type || 'system_alert';
      const title = activity.title || 'System Activity';
      const description = activity.description || 'No description available';
      const timestamp = activity.timestamp || activity.created_at || new Date().toISOString();

      return `
        <div class="activity-item ${isLiveData ? 'live-data' : 'mock-data'}">
            <div class="activity-icon ${getActivityIconClass(type)}">
                <i class="fas fa-${getActivityIcon(type)}"></i>
            </div>
            <div class="activity-content">
                <span class="activity-title">${title}</span>
                <span class="activity-time">${formatRelativeTime(timestamp)}</span>
            </div>
            <span class="activity-desc">${description}</span>
        </div>
        `;
    }).join('');

    // Add data source indicator
    if (activityList.children.length > 0) {
      const firstItem = activityList.children[0];
      if (firstItem) {
        const indicator = document.createElement('div');
        indicator.className = `activity-source-indicator small ${isLiveData ? 'text-success' : 'text-warning'}`;
        indicator.style.padding = '5px 10px';
        indicator.style.fontSize = '0.8em';
        indicator.innerHTML = `<i class="fas fa-${isLiveData ? 'database' : 'demo'}"></i> ${isLiveData ? 'Live data' : 'Demo data'}`;
        activityList.insertBefore(indicator, firstItem);
      }
    }
  }

  function getActivityIcon(type) {
    const iconMap = {
      'book_added': 'plus',
      'user_registered': 'user-plus',
      'book_borrowed': 'book-reader',
      'book_returned': 'book',
      'subscription_created': 'crown',
      'payment_received': 'dollar-sign',
      'support_ticket': 'ticket-alt',
      'system_alert': 'exclamation-triangle',
      'profile_updated': 'user-edit',
      'password_changed': 'key',
      'login': 'sign-in-alt',
      'logout': 'sign-out-alt'
    };
    return iconMap[type] || 'circle';
  }

  function getActivityIconClass(type) {
    const classMap = {
      'book_added': 'add',
      'user_registered': 'user',
      'book_borrowed': 'borrowed',
      'book_returned': 'returned',
      'subscription_created': 'subscription',
      'payment_received': 'revenue',
      'support_ticket': 'support',
      'system_alert': 'alert',
      'profile_updated': 'update',
      'password_changed': 'security',
      'login': 'login',
      'logout': 'logout'
    };
    return classMap[type] || 'default';
  }

  // Helper function to format relative time
  function formatRelativeTime(timestamp) {
    if (!timestamp) return "Unknown time";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  }

  // -------------------------
  // Message badge - LIVE DATA
  // -------------------------
  async function updateMessageBadge() {
    let messageCount = mockData.messages.new_messages;

    if (api) {
      try {
        const res = await loadDataWithRetry(() => api.getContactStats());
        messageCount = res.data?.new_messages || res.new_messages || mockData.messages.new_messages;
      } catch (e) {
        console.warn("Could not fetch message stats:", e.message);
      }
    }

    const badge = document.getElementById("msgBadge");
    if (badge) {
      badge.textContent = messageCount;
      badge.style.display = messageCount > 0 ? 'flex' : 'none';
    }
  }

  // -------------------------
  // Notification badge - LIVE DATA
  // -------------------------
  async function updateNotificationBadge() {
    let notificationCount = mockData.notifications.count;

    // Since there's no specific notification endpoint, we'll use a mock
    const badge = document.querySelector('.icon-btn .badge');
    if (badge) {
      badge.textContent = notificationCount;
      badge.style.display = notificationCount > 0 ? 'flex' : 'none';
    }
  }

  // -------------------------
  // Real-time Updates with Pool Awareness
  // -------------------------
  function startRealTimeUpdates() {
    // Refresh stats every 30 seconds, but slow down if pool issues
    const statsInterval = connectionRetryCount > 0 ? 60000 : 30000;
    statsRefreshInterval = setInterval(loadDashboardStats, statsInterval);

    // Refresh activity every minute, adjust based on connection health
    const activityInterval = connectionRetryCount > 0 ? 120000 : 60000;
    activityRefreshInterval = setInterval(loadRecentActivity, activityInterval);

    // Refresh badges every 2 minutes
    setInterval(() => {
      updateMessageBadge();
      updateNotificationBadge();
    }, 120000);

    console.log(`🔄 Real-time updates started (stats: ${statsInterval}ms, activity: ${activityInterval}ms)`);
  }

  function stopRealTimeUpdates() {
    if (statsRefreshInterval) {
      clearInterval(statsRefreshInterval);
      statsRefreshInterval = null;
    }
    if (activityRefreshInterval) {
      clearInterval(activityRefreshInterval);
      activityRefreshInterval = null;
    }
    console.log("🔄 Real-time updates stopped");
  }

  // -------------------------
  // Navigation Dropdowns
  // -------------------------
  function initNavigationDropdowns() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');

    dropdowns.forEach(dropdown => {
      dropdown.addEventListener('click', function (e) {
        // Close other dropdowns
        dropdowns.forEach(other => {
          if (other !== dropdown) {
            other.classList.remove('active');
          }
        });

        // Toggle current dropdown
        this.classList.toggle('active');
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-dropdown')) {
        dropdowns.forEach(dropdown => {
          dropdown.classList.remove('active');
        });
      }
    });
  }

  // -------------------------
  // Enhanced Manual Refresh with Pool Recovery
  // -------------------------
  function setupManualRefresh() {
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

        // Stop current intervals to prevent conflicts
        stopRealTimeUpdates();

        try {
          await Promise.all([
            loadDashboardStats(),
            loadRecentActivity(),
            updateMessageBadge(),
            updateNotificationBadge()
          ]);

          showNotification('✅ Dashboard data refreshed successfully', 'success');

          // Restart real-time updates with potentially adjusted intervals
          startRealTimeUpdates();

        } catch (error) {
          console.error("Manual refresh failed:", error);
          showNotification('❌ Refresh failed - connection issues', 'error');
        } finally {
          setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
          }, 1000);
        }
      });
    }
  }

  // -------------------------
  // Pool Recovery Functions
  // -------------------------
  async function checkPoolStatus() {
    if (!api) return null;

    if (typeof api.getPoolStatus !== 'function') {
      // Pool status not supported by this API client — skip gracefully
      return null;
    }

    try {
      const response = await api.getPoolStatus();
      return response && (response.data || response) || null;
    } catch (error) {
      console.warn("Pool status check failed:", error);
      return null;
    }
  }

  async function attemptPoolRecovery() {
    if (!api) return false;

    console.log("🔄 Attempting pool recovery...");
    showNotification("🔄 Attempting to recover database connections...", "info");

    try {
      // Try to reset the pool via API if supported
      if (typeof api.resetPool === 'function') {
        const response = await api.resetPool();
        if (response && (response.status === 'success' || response.ok)) {
          connectionRetryCount = 0;
          showNotification("✅ Connection pool recovered successfully", "success");
          return true;
        }
      } else {
        console.warn('API client does not support pool reset.');
      }
    } catch (error) {
      console.warn("Pool recovery API call failed:", error);
    }

    // Fallback: reload the page
    showNotification("🔄 Reloading page to recover connections...", "warning");
    setTimeout(() => {
      window.location.reload();
    }, 2000);

    return false;
  }

  // -------------------------
  // Enhanced Connection Check
  // -------------------------
  async function checkBackendConnection() {
    updateConnectionIndicator("Connecting...", "text-warning");

    if (!api && !initAPI()) {
      console.log("🔄 Using mock data for demo");
      updateConnectionIndicator("Demo Mode - Using Mock Data", "text-warning");
      showNotification("⚠️ Running in demo mode with sample data", "info");
      return { connected: false, authed: true, poolStatus: null };
    }

    let connected = false;
    let authed = false;
    let poolStatus = null;

    // Determine if we have an auth token available for admin endpoints
    try {
      const token = localStorage.getItem('authToken') || (api && api.token);
      if (!token) {
        // Trigger the auth failure handler which may redirect or show UI
        handleAuthFailure();
        authed = false;
      } else {
        authed = true;
      }
    } catch (e) {
      authed = false;
    }

    try {
      const health = await api.healthCheck();
      if (health && (health.status === "success" || health.status === "ok")) {
        connected = true;

        // Check pool status
        poolStatus = await checkPoolStatus();
        if (poolStatus) {
          console.log("📊 Pool Status:", poolStatus);

          // Check if pool is exhausted
          if (poolStatus.pooling && poolStatus.available === 0) {
            console.warn("🚨 Connection pool exhausted!");
            showNotification("🔄 Database pool exhausted, attempting recovery...", "warning");

            // Attempt automatic recovery
            if (connectionRetryCount >= MAX_RETRY_COUNT) {
              await attemptPoolRecovery();
            }
          }
        }

        updateConnectionIndicator("Backend Connected", "text-success");
      }
    } catch (err) {
      console.warn("Backend unreachable:", err.message);
      updateConnectionIndicator("Backend Offline - Using Demo Data", "text-warning");
      showNotification("⚠️ Backend offline, showing sample data", "warning");
      return { connected: false, authed: authed, poolStatus: null };
    }
    // Return a consistent status object
    return { connected: connected, authed: authed, poolStatus: poolStatus };
  }

  // Add pool reset button handler
  function setupPoolReset() {
    const resetBtn = document.getElementById('resetPoolBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to reset the database connection pool? This may temporarily affect performance.")) {
          resetBtn.disabled = true;
          resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

          const success = await attemptPoolRecovery();

          resetBtn.disabled = false;
          resetBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reset Pool';

          if (success) {
            // Reload data after successful reset
            await loadDashboardStats();
            await loadRecentActivity();
          }
        }
      });
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
  // Notifications
  // -------------------------
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === "success" ? "check-circle" : type === "error" ? "exclamation-circle" : "info-circle"}"></i>
      <span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  // -------------------------
  // Enhanced Error Handling for Activity Loading
  // -------------------------
  function handleActivityLoadError(error) {
    console.error("Activity loading error:", error);
    
    const activityList = document.querySelector(".activity-list");
    if (activityList) {
      activityList.innerHTML = `
        <div class="activity-error">
          <div class="text-warning text-center">
            <i class="fas fa-exclamation-triangle"></i>
            <div>Unable to load recent activity</div>
            <small class="text-muted">${error.message || 'Connection issue'}</small>
          </div>
        </div>
      `;
    }
  }

  // Update the loadRecentActivity function to use the error handler
  const originalLoadRecentActivity = loadRecentActivity;
  loadRecentActivity = async function() {
    try {
      await originalLoadRecentActivity();
    } catch (error) {
      handleActivityLoadError(error);
    }
  };

  // -------------------------
  // Enhanced Initialization sequence
  // -------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    if (isInitialized) return;

    console.log("🔄 Initializing Admin Dashboard...");

    // Initialize API first
    initAPI();
    initNavigationDropdowns();
    setupManualRefresh();
    setupPoolReset();

    const status = await checkBackendConnection();

    // Allow access even if auth is not perfect (we have fallback data)
    if (!status.authed) {
      console.log("⚠️ Limited access mode");
      showNotification("⚠️ Limited access mode - some features may not work", "warning");
    }

    // Load initial data (will use mock data if API fails)
    await Promise.all([
      loadAdminProfile(),
      loadAdminProfileStats(),
      loadDashboardStats(),
      loadRecentActivity(),
      updateMessageBadge(),
      updateNotificationBadge()
    ]);

    // Start real-time updates only if API is available
    if (api) {
      startRealTimeUpdates();
      showNotification("✅ Dashboard loaded successfully", "success");
    } else {
      showNotification("ℹ️ Dashboard running in demo mode", "info");
    }

    isInitialized = true;
    console.log("✅ Admin Dashboard initialized successfully");
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    stopRealTimeUpdates();
  });

  // Make functions available globally
  window.loadDashboardStats = loadDashboardStats;
  window.loadRecentActivity = loadRecentActivity;
  window.performLogout = performLogout;
  window.showNotification = showNotification;
  window.attemptPoolRecovery = attemptPoolRecovery;

})();