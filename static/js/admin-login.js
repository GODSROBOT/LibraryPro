// /static/js/admin-login.js
// Enhanced Admin Login integrated with LibraryAPI and /api/auth/admin routes
// Patched to prevent repeated redirects and repeated submissions.

document.addEventListener('DOMContentLoaded', function () {
    // Prevent double-initialization if this script is accidentally loaded twice
    if (document.body.dataset.adminLoginInit === '1') {
        console.warn('admin-login already initialized, skipping duplicate init.');
        return;
    }
    document.body.dataset.adminLoginInit = '1';

    const form = document.getElementById('loginForm');
    const tabButtons = Array.from(document.querySelectorAll('.tab-btn') || []);
    const passwordToggle = document.querySelector('.toggle-password');
    const passwordInput = document.getElementById('password');
    const usernameOrCodeInput = document.getElementById('usernameOrCode');
    const emailInput = document.getElementById('email');
    const rememberCheckbox = document.getElementById('rememberMe');
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const submitBtn = form ? form.querySelector('.btn-admin-login') : null;

    // guard to prevent multiple parallel submissions
    let isSubmitting = false;

    // Helper to show errors
    function showError(message) {
        if (!errorDiv) {
            alert(message);
            return;
        }
        errorText.textContent = message;
        errorDiv.style.display = 'flex';
        // hide after some time
        setTimeout(() => {
            if (errorDiv) errorDiv.style.display = 'none';
        }, 5000);
    }

    // Email validator
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Tab switching logic
    tabButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
            const tabName = this.dataset.tab;
            tabButtons.forEach((b) => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            const el = document.getElementById(tabName);
            if (el) el.classList.add('active');

            // clear inputs of the other tab
            if (tabName === 'username-tab') {
                emailInput && (emailInput.value = '');
            } else {
                usernameOrCodeInput && (usernameOrCodeInput.value = '');
            }
        });
    });

    // Password toggle
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function (e) {
            e.preventDefault();
            const icon = this.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon && icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon && icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }

    // Simple validation
    function validateLogin() {
        const activeTabBtn = document.querySelector('.tab-btn.active');
        const activeTab = activeTabBtn ? activeTabBtn.dataset.tab : 'username-tab';
        const pwd = (passwordInput && passwordInput.value || '').trim();
        if (!pwd) {
            showError('Password is required');
            return false;
        }
        if (activeTab === 'username-tab') {
            const val = (usernameOrCodeInput && usernameOrCodeInput.value || '').trim();
            if (!val) {
                showError('Username or Admin Code is required');
                return false;
            }
            if (val.length < 3) {
                showError('Invalid username or admin code');
                return false;
            }
        } else {
            const email = (emailInput && emailInput.value || '').trim();
            if (!email || !isValidEmail(email)) {
                showError('Please enter a valid email address');
                return false;
            }
        }
        return true;
    }

    // Use LibraryAPI if available to keep consistent client behavior
    // In your admin-login.js, ensure you're calling the admin login endpoint:
    async function callLoginAPI(payload) {
        // Use the ADMIN login endpoint specifically
        if (window.LibraryAPI) {
            try {
                const api = new window.LibraryAPI('/api');
                // Use the admin-specific login endpoint
                return await api.request('/auth/admin/login', 'POST', payload, false, { timeout: 15000 });
            } catch (err) {
                // normalize error
                if (err && err.message) throw err;
                const msg = err && err.data && err.data.message ? err.data.message : 'Login failed';
                const e = new Error(msg);
                e.raw = err;
                throw e;
            }
        }

        // Fallback: direct fetch to ADMIN endpoint
        const res = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });

        // ... rest of your code

        const ct = res.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await res.json().catch(() => null) : null;
        if (!res.ok) {
            const msg = (body && (body.message || (body.data && body.data.message))) || res.statusText || 'Login failed';
            const e = new Error(msg);
            e.raw = body;
            throw e;
        }
        return body;
    }

    // On load, check admin session and redirect if already logged in
    (async function checkAdminSession() {
        try {
            // If already redirecting, don't do anything
            if (window.__adminRedirecting) return;

            // Prefer LibraryAPI if available
            let body = null;
            if (window.LibraryAPI) {
                const api = new window.LibraryAPI('/api');
                // endpoint: '/auth/admin/check-session'
                body = await api.request('/auth/admin/check-session', 'GET', null, false, { timeout: 7000 }).catch(() => null);
            } else {
                const r = await fetch('/api/auth/admin/check-session', { credentials: 'same-origin' });
                if (r.ok) body = await r.json().catch(() => null);
            }

            const loggedIn = !!(body && (body.data?.logged_in || body.logged_in));
            // Only redirect if not already on admin root and not already redirecting
            if (loggedIn && !window.__adminRedirecting && window.location.pathname !== '/admin') {
                // protect against repeated redirects
                window.__adminRedirecting = true;
                window.location.href = '/admin';
            }
        } catch (e) {
            // ignore network/session check failures — keep user on login page
            console.warn('Admin session check failed', e);
        }
    })();

    // Form submission
    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            // hide previous error
            if (errorDiv) errorDiv.style.display = 'none';

            // Prevent double submits
            if (isSubmitting) {
                console.warn('Login already in progress, ignoring duplicate submit.');
                return;
            }

            if (!validateLogin()) return;

            const activeTabBtn = document.querySelector('.tab-btn.active');
            const activeTab = activeTabBtn ? activeTabBtn.dataset.tab : 'username-tab';

            // Build payload based on active tab
            let payload = {
                password: passwordInput.value,
                remember_me: !!(rememberCheckbox && rememberCheckbox.checked)
            };

            if (activeTab === 'username-tab') {
                payload.login_type = 'username_or_code';
                payload.username_or_code = usernameOrCodeInput.value.trim();
            } else {
                payload.login_type = 'email';
                payload.email = emailInput.value.trim().toLowerCase();
            }

            // loading state
            const originalText = submitBtn ? submitBtn.innerHTML : null;
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
                submitBtn.disabled = true;
            }
            isSubmitting = true;

            try {
                const res = await callLoginAPI(payload);
                const data = (res && res.data) ? res.data : (res || {});

                // store admin id locally (frontend convenience)
                const adminId = data.admin_id ?? data.adminId ?? res?.admin_id;
                if (adminId !== undefined && adminId !== null) {
                    localStorage.setItem('adminId', String(adminId));
                }

                // store tokens if returned
                const tokens = data.access_token || data.token || (data.tokens ? data.tokens.access : null);
                const refresh = data.refresh_token || (data.tokens ? data.tokens.refresh : null);
                if (tokens) {
                    localStorage.setItem('authToken', tokens);
                    if (refresh) localStorage.setItem('refreshToken', refresh);
                }

                // Protect from duplicate redirects: set redirect flag then navigate
                if (!window.__adminRedirecting) {
                    window.__adminRedirecting = true;
                    window.location.href = '/admin/dashboard';
                } else {
                    console.warn('Redirect already in progress');
                }
            } catch (err) {
                console.error('Login error', err);
                const msg = (err && err.message) ? err.message : 'Login failed';
                showError(msg);
            } finally {
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // Small UX validators
    usernameOrCodeInput && usernameOrCodeInput.addEventListener('blur', function () {
        const v = this.value.trim();
        if (v && v.length < 3) showError('Username or code must be at least 3 characters');
    });

    emailInput && emailInput.addEventListener('blur', function () {
        const v = this.value.trim();
        if (v && !isValidEmail(v)) showError('Please enter a valid email address');
    });

    console.log('Admin login enhanced page loaded successfully!');
});