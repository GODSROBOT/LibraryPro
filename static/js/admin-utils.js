// admin-utils.js - Enhanced with better connection status
class AdminUtils {
    static api = null;
    static isInitialized = false;

    // Initialize API once
    static initAPI() {
        if (!this.api && typeof LibraryAPI !== 'undefined') {
            this.api = new LibraryAPI("/api");
            console.log("✅ Admin API initialized");
        }
        return this.api;
    }

    // Enhanced connection status management
    static updateConnectionStatus(text, type = 'info') {
        const connectionStatusEl = document.getElementById('connectionStatus');
        if (!connectionStatusEl) {
            // Create connection status element if it doesn't exist
            this.createConnectionStatusElement();
            return;
        }

        const typeClass = {
            'success': 'text-success',
            'warning': 'text-warning', 
            'error': 'text-danger',
            'info': 'text-info'
        }[type] || 'text-info';

        connectionStatusEl.className = `connection-status small ${typeClass}`;
        connectionStatusEl.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
    }

    static createConnectionStatusElement() {
        // Only create if we're in an admin container
        const adminContainer = document.querySelector('.admin-container') || document.querySelector('.admin-header');
        if (!adminContainer) return;

        const statusEl = document.createElement('div');
        statusEl.id = 'connectionStatus';
        statusEl.className = 'connection-status small text-info';
        statusEl.innerHTML = '<i class="fas fa-circle"></i> Connecting...';
        statusEl.style.cssText = 'position: fixed; top: 70px; right: 20px; z-index: 9999; background: rgba(0,0,0,0.8); padding: 5px 10px; border-radius: 4px; font-size: 12px;';

        // Try to insert near admin header or at top of body
        const header = document.querySelector('.admin-header') || document.querySelector('.navbar');
        if (header) {
            header.appendChild(statusEl);
        } else {
            document.body.appendChild(statusEl);
        }
    }

    // Check backend connection for any admin page
    static async checkBackendConnection() {
        this.updateConnectionStatus("Connecting...", "warning");

        const api = this.initAPI();
        if (!api) {
            console.log("🔄 API not initialized, using limited functionality");
            this.updateConnectionStatus("Demo Mode - Limited Functionality", "warning");
            return { connected: false, authed: false };
        }

        // Check if we have auth token
        const token = localStorage.getItem('authToken') || (api && api.token);
        if (!token) {
            this.updateConnectionStatus("Not Authenticated - Please Login", "error");
            return { connected: false, authed: false };
        }

        try {
            const health = await api.healthCheck();
            if (health && (health.status === "success" || health.status === "ok")) {
                this.updateConnectionStatus("Backend Connected", "success");
                return { connected: true, authed: true };
            } else {
                this.updateConnectionStatus("Backend Response Error", "warning");
                return { connected: false, authed: true };
            }
        } catch (err) {
            console.warn("Backend unreachable:", err.message);
            this.updateConnectionStatus("Backend Offline - Limited Mode", "warning");
            return { connected: false, authed: true };
        }
    }

    // Load admin profile (shared across all admin pages)
    static async loadAdminProfile() {
        const api = this.initAPI();
        if (!api) {
            console.warn("API not available for admin profile");
            return this.getMockProfile();
        }

        try {
            let profileData;
            try {
                const res = await api.getAdminProfile();
                profileData = res.data || res;
            } catch (e) {
                console.warn("Admin profile failed, trying regular profile:", e.message);
                const res = await api.getProfile();
                profileData = res.data || res;
            }
            
            this.updateProfileUI(profileData);
            return profileData;
        } catch (err) {
            console.warn("Failed to load profile, using mock data:", err.message);
            const mockProfile = this.getMockProfile();
            this.updateProfileUI(mockProfile);
            return mockProfile;
        }
    }

    static getMockProfile() {
        return {
            name: 'Administrator',
            email: 'admin@library.com',
            role: 'Administrator'
        };
    }

    static updateProfileUI(profileData) {
        const nameEl = document.getElementById('adminName');
        const avatarEl = document.getElementById('adminAvatar');
        const welcomeEl = document.getElementById('welcomeMessage');

        const displayName = profileData.name || profileData.email || "Admin";
        
        if (nameEl) nameEl.textContent = displayName;
        
        if (welcomeEl && profileData.name) {
            welcomeEl.textContent = `Welcome back, ${profileData.name.split(' ')[0]}!`;
        }
        
        if (avatarEl) {
            const initials = profileData.name ? 
                profileData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 
                'AD';
            avatarEl.textContent = initials;
        }
    }

    // Notification system (shared)
    static showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;

        // Add styles if not already present
        if (!document.getElementById('adminNotificationStyle')) {
            const style = document.createElement('style');
            style.id = 'adminNotificationStyle';
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
                .connection-status {
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    z-index: 9999;
                    background: rgba(0,0,0,0.8);
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                .connection-status.text-success { color: #10b981 !important; }
                .connection-status.text-warning { color: #f59e0b !important; }
                .connection-status.text-danger { color: #ef4444 !important; }
                .connection-status.text-info { color: #3b82f6 !important; }
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

    static escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str).replace(/[&<>"']/g, function (s) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" })[s];
        });
    }

    // Initialize connection status for any admin page
    static async initializeAdminPage() {
        // Create connection status element if needed
        this.createConnectionStatusElement();
        
        // Initialize API
        this.initAPI();
        
        // Check connection
        const connectionStatus = await this.checkBackendConnection();
        
        // Load profile
        await this.loadAdminProfile();
        
        return connectionStatus;
    }
}

// Make it globally available
window.AdminUtils = AdminUtils;