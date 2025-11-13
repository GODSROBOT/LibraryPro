// ===========================
// Auth Pages JavaScript
// ===========================

document.addEventListener('DOMContentLoaded', function () {

    // ===== Navbar Scroll Effect =====
    const navbar = document.getElementById('mainNav');
    let lastScroll = 0;

    window.addEventListener('scroll', function () {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });

    // ===== Back to Top Button =====
    const backToTop = document.getElementById('backToTop');

    if (backToTop) {
        window.addEventListener('scroll', function () {
            if (window.pageYOffset > 300) {
                backToTop.style.display = 'flex';
            } else {
                backToTop.style.display = 'none';
            }
        });

        backToTop.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // ===== Create Particles =====
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;

        const particleCount = window.innerWidth < 768 ? 20 : 40;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            const startX = Math.random() * 100;
            particle.style.left = startX + '%';

            const drift = (Math.random() - 0.5) * 100;
            particle.style.setProperty('--drift', drift + 'px');

            const duration = 15 + Math.random() * 20;
            particle.style.animationDuration = duration + 's';

            const delay = Math.random() * 10;
            particle.style.animationDelay = delay + 's';

            const size = 2 + Math.random() * 3;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            particlesContainer.appendChild(particle);
        }
    }

    createParticles();

    // ===== Toggle Password Visibility =====
    window.togglePassword = function (fieldId) {
        const field = document.getElementById(fieldId);
        if (field.type === 'password') {
            field.type = 'text';
        } else {
            field.type = 'password';
        }
    };

    // ===== Form Validation =====
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const isAdminEl = document.getElementById('is-admin');
            const isAdmin = isAdminEl ? isAdminEl.checked : false;

            if (!email || !password) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            try {
                const api = new LibraryAPI();
                const response = await api.login(email, password, isAdmin);

                if (!response || response.status !== 'success') {
                    showNotification(response?.message || 'Login failed. Please check your credentials.', 'error');
                    return;
                }

                // keep tokens from response (if provided by API)
                const accessToken = response.data?.access_token || response.access_token || null;
                const refreshToken = response.data?.refresh_token || response.refresh_token || null;

                showNotification('Login successful! Redirecting...', 'success');

                // Try to bootstrap a server session for SSR pages; don't block redirect on failure.
                if (accessToken) {
                    try {
                        const bs = await api.bootstrapSession(accessToken);
                        if (!bs || bs.status !== 'success') {
                            console.warn('bootstrap failed, continuing to dashboard');
                        }
                    } catch (err) {
                        console.warn('bootstrap request error:', err);
                    }
                } else {
                    // If API didn't return tokens (rare), still attempt bootstrap (it may rely on cookie)
                    try {
                        await api.bootstrapSession();
                    } catch (err) {
                        console.warn('bootstrap request error (no token):', err);
                    }
                }

                // Single redirect based on role
                if (isAdmin) {
                    window.location.href = '/admin/dashboard';
                } else {
                    window.location.href = '/dashboard';
                }
            } catch (error) {
                showNotification(error?.message || 'An error occurred during login.', 'error');
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const fullname = document.getElementById('fullname').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const terms = document.getElementById('terms').checked;
            
            // Location fields
            const country = document.getElementById('country').value;
            const state = document.getElementById('state').value;
            const city = document.getElementById('city').value;
            const postal_code = document.getElementById('postal_code').value;

            if (!fullname || !email || !password || !confirmPassword) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }

            if (password.length < 8) {
                showNotification('Password must be at least 8 characters', 'error');
                return;
            }

            if (!terms) {
                showNotification('Please accept Terms & Conditions', 'error');
                return;
            }

            const api = new LibraryAPI();
            
            // Prepare registration data
            const registrationData = {
                name: fullname,
                email: email,
                password: password,
                password_confirm: confirmPassword
            };
            
            // Add location data if provided
            if (country) registrationData.country = country;
            if (state) registrationData.state = state;
            if (city) registrationData.city = city;
            if (postal_code) registrationData.postal_code = postal_code;
            
            // Create a custom register method that includes location data
            api.customRegister = function(data) {
                return this.request('/auth/register', 'POST', data);
            };
            
            api.customRegister(registrationData)
                .then(response => {
                    if (response.status === 'success') {
                        showNotification('Account created successfully! Redirecting...', 'success');
                        setTimeout(() => {
                            window.location.href = '/auth/login';
                        }, 1500);
                    } else {
                        showNotification(response.message, 'error');
                    }
                })
                .catch(error => {
                    showNotification(error.message, 'error');
                });
        });

        // Password strength indicator
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('input', function () {
                const strength = calculatePasswordStrength(this.value);
                updatePasswordStrength(strength);
            });
        }
    }

    // ===== Password Strength Calculator =====
    function calculatePasswordStrength(password) {
        let strength = 0;

        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[!@#$%^&*]/.test(password)) strength++;

        return strength;
    }

    function updatePasswordStrength(strength) {
        const strengthBar = document.querySelector('.strength-bar::after');
        const strengthText = document.querySelector('.strength-text');

        if (!strengthBar || !strengthText) return;

        const percentages = [0, 20, 40, 60, 80, 100];
        const colors = ['#ff4444', '#ffaa00', '#ffcc00', '#99cc00', '#00cc44'];
        const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];

        const width = percentages[strength];
        const color = colors[Math.max(0, strength - 1)];
        const text = texts[strength];

        document.documentElement.style.setProperty('--strength-width', width + '%');
        document.documentElement.style.setProperty('--strength-color', color);
        strengthText.textContent = text;
    }

    // ===== Notification System =====
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 10px;
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 208, 0, 0.3);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }

            .notification-success {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
            }

            .notification-error {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }

            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 500;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // ===== Social Login Handlers =====
    document.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            showNotification('Social login feature coming soon!', 'info');
        });
    });

    console.log('✨ Auth page loaded successfully!');
});
