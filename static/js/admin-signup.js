// /static/js/admin-signup.js
// Admin Signup integrated with LibraryAPI and /api/auth/admin/signup

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('signupForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  const passwordStrengthDiv = document.querySelector('.password-strength');
  const errorDiv = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const successDiv = document.getElementById('successMessage');

  // ===== Password Strength Checker =====
  function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength >= 5) return 'strong';
    if (strength >= 3) return 'medium';
    return 'weak';
  }

  function updatePasswordStrength() {
    const pw = passwordInput.value;
    if (!pw) {
      passwordStrengthDiv.classList.remove('show');
      return;
    }
    passwordStrengthDiv.classList.add('show');
    const level = checkPasswordStrength(pw);
    strengthFill.className = 'strength-fill ' + level;
    strengthText.className = 'strength-text ' + level;
    strengthText.textContent = level.charAt(0).toUpperCase() + level.slice(1);
  }

  // ===== Toggle Password Visibility for any .toggle-input buttons =====
  function setupPasswordToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-input');
    toggleButtons.forEach(button => {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        const fieldId = this.dataset.toggle;
        const field = document.getElementById(fieldId);
        const icon = this.querySelector('i');
        if (!field) return;
        if (field.type === 'password') {
          field.type = 'text';
          icon && icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          field.type = 'password';
          icon && icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    });
  }

  // ===== Validators & UI helpers =====
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showError(message) {
    if (!errorDiv) {
      alert(message);
      return;
    }
    errorText.textContent = message;
    errorDiv.style.display = 'flex';
    // shake
    form && form.classList.add('shake');
    setTimeout(() => form && form.classList.remove('shake'), 300);
    setTimeout(() => { if (errorDiv) errorDiv.style.display = 'none'; }, 5000);
  }

  function showSuccessAndRedirect(delayMs = 1500) {
    if (successDiv) successDiv.style.display = 'flex';
    setTimeout(() => {
      // redirect to admin login page
      window.location.href = '/admin/authentication/login.html';
    }, delayMs);
  }

  // ===== Form validation =====
  function validateForm() {
    const adminCode = document.getElementById('adminCode').value.trim();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const terms = document.getElementById('terms') ? document.getElementById('terms').checked : true;

    if (!adminCode) {
      showError('Admin code is required');
      return false;
    }
    if (username.length < 3 || username.length > 30) {
      showError('Username must be 3-30 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]*$/.test(username)) {
      showError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      return false;
    }
    if (password.length < 8) {
      showError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      showError('Password must include uppercase, lowercase and a number');
      return false;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return false;
    }
    const strength = checkPasswordStrength(password);
    if (strength === 'weak') {
      showError('Password is too weak. Add uppercase, numbers, or special characters');
      return false;
    }
    if (!terms) {
      showError('You must agree to the terms and conditions');
      return false;
    }
    return true;
  }

  // ===== API call (LibraryAPI preferred) =====
  async function callSignupAPI(payload) {
    // Use LibraryAPI if available
    if (window.LibraryAPI) {
      try {
        const api = new window.LibraryAPI('/api');
        // endpoint: /api/auth/admin/signup -> request('/auth/admin/signup', ...)
        const res = await api.request('/auth/admin/signup', 'POST', payload, false, { timeout: 15000 });
        return res;
      } catch (err) {
        throw err && err.message ? err : new Error(err && err.data && err.data.message ? err.data.message : 'Signup failed');
      }
    }

    // fallback to fetch
    const resp = await fetch('/api/auth/admin/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const body = (resp.headers.get('content-type') || '').includes('application/json') ? await resp.json() : null;
    if (!resp.ok) {
      const msg = (body && (body.message || (body.data && body.data.message))) || resp.statusText || 'Signup failed';
      const e = new Error(msg);
      e.raw = body;
      throw e;
    }
    return body;
  }

  // ===== Form submit handler =====
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      // hide previous error
      if (errorDiv) errorDiv.style.display = 'none';

      if (!validateForm()) return;

      const payload = {
        admin_code: document.getElementById('adminCode').value.trim(),
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: passwordInput.value,
        confirm_password: confirmPasswordInput.value
      };

      const submitBtn = form.querySelector('.btn-admin-signup');
      const originalText = submitBtn ? submitBtn.innerHTML : null;
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        submitBtn.disabled = true;
      }

      try {
        const res = await callSignupAPI(payload);
        const data = (res && res.data) ? res.data : (res || {});

        // Store tokens and admin data
        const access = data.access_token;
        const refresh = data.refresh_token;
        if (access) {
          localStorage.setItem('authToken', access);
          localStorage.setItem('userRole', 'admin');
          if (refresh) localStorage.setItem('refreshToken', refresh);
        }

        // Store admin info
        const adminId = data.admin_id;
        const username = data.username;
        if (adminId) {
          localStorage.setItem('userId', String(adminId));
          localStorage.setItem('adminId', String(adminId));
        }
        if (username) {
          localStorage.setItem('userName', username);
        }

        // Show success and redirect to admin dashboard
        showSuccessAndRedirect(1300);
      } catch (err) {
        console.error('Signup error', err);
        const msg = (err && err.message) ? err.message : 'Signup failed';
        showError(msg);
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  }

  // Listeners
  passwordInput && passwordInput.addEventListener('input', updatePasswordStrength);
  document.getElementById('username')?.addEventListener('blur', function () {
    const v = this.value.trim();
    if (v && !/^[a-zA-Z0-9_]*$/.test(v)) showError('Username can only contain letters, numbers, and underscores');
  });
  document.getElementById('email')?.addEventListener('blur', function () {
    const v = this.value.trim();
    if (v && !isValidEmail(v)) showError('Please enter a valid email address');
  });

  setupPasswordToggle();
  console.log('Admin signup script loaded and integrated.');
});
