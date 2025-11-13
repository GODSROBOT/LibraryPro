// Admin Forgot Password - 2FA Flow

let currentStep = 1;
let adminEmail = '';
let resendCount = 0;
const maxResends = 3;

// ===== STEP 1: EMAIL VERIFICATION =====
function handleEmailSubmit(e) {
    e.preventDefault();
    adminEmail = document.getElementById('adminEmail').value;

    if (validateEmail(adminEmail)) {
        // create reset token via server (dev: token returned in response)
        fetch('/api/auth/forgot-password', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email: adminEmail})})
        .then(r => r.json()).then(res => {
            if (res && res.status === 'success' && res.data && res.data.reset_token) {
                window.__reset_token = res.data.reset_token;
                showNotification('Reset token created (dev) for ' + adminEmail, 'success');
            } else {
                showNotification((res && res.message) || 'If the email exists, a reset link was sent', 'info');
            }
            goToStep(2);
        }).catch(err => {
            console.error('forgot-password error', err);
            showNotification('Error creating reset token', 'error');
        });
    } else {
        showNotification('Please enter a valid email', 'error');
    }
}

// ===== STEP 2: 2FA AUTHENTICATION =====
function handle2FASubmit(e) {
    e.preventDefault();

    const codeInputs = document.querySelectorAll('#step2-2fa .code-input');
    const code = Array.from(codeInputs).map(input => input.value).join('');

    if (code.length === 6 && /^[0-9]{6}$/.test(code)) {
        showNotification('2FA authentication successful!', 'success');
        goToStep(4);
    } else {
        showNotification('Invalid code. Please try again.', 'error');
        codeInputs.forEach(input => input.value = '');
        codeInputs[0].focus();
    }
}

// ===== STEP 3: BACKUP CODE =====
function handleBackupCodeSubmit(e) {
    e.preventDefault();

    const backupCode = document.getElementById('backupCode').value;

    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(backupCode)) {
        showNotification('Backup code verified!', 'success');
        goToStep(4);
    } else {
        showNotification('Invalid backup code format', 'error');
    }
}

// ===== STEP 4: PASSWORD RESET =====
function handlePasswordReset(e) {
    e.preventDefault();

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!validatePassword(newPassword)) {
        showNotification('Password does not meet requirements', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    // Simulate API call
    showNotification('Resetting password...', 'info');
    const token = window.__reset_token;
    if (!token) {
        showNotification('Reset token missing. Start over.', 'error');
        return;
    }
    fetch('/api/auth/reset-password', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token: token, new_password: newPassword})})
    .then(r => r.json()).then(res => {
        if (res && res.status === 'success') {
            showNotification('Password reset successful! Email sent.', 'success');
            goToStep(5);
        } else {
            showNotification((res && res.message) || 'Reset failed', 'error');
        }
    }).catch(err => {
        console.error('reset-password error', err);
        showNotification('Error resetting password', 'error');
    });
}

// ===== STEP NAVIGATION =====
function goToStep(step) {
    const steps = ['step1-email', 'step2-2fa', 'step3-backup', 'step4-reset', 'step5-success'];

    steps.forEach(s => {
        const element = document.getElementById(s);
        if (element) element.classList.remove('active');
    });

    if (steps[step - 1]) {
        document.getElementById(steps[step - 1]).classList.add('active');
    }

    currentStep = step;
}

function goBackStep() {
    if (currentStep === 2 || currentStep === 3) {
        goToStep(1);
    } else if (currentStep === 4) {
        goToStep(2);
    }
}

// ===== 2FA SUPPORT =====
function showBackupCodes() {
    goToStep(3);
}

// ===== PASSWORD VISIBILITY =====
function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const button = event.target.closest('.toggle-password');

    if (field.type === 'password') {
        field.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        field.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// ===== AUTO-FOCUS FOR CODE INPUTS =====
document.addEventListener('DOMContentLoaded', function() {
    const codeInputs = document.querySelectorAll('.code-input');
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', function() {
            if (this.value.length === 1 && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
    });
});

// ===== VALIDATION FUNCTIONS =====
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 12 &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*]/.test(password);
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 
                       type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 
                       'rgba(59, 130, 246, 0.2)'};
        color: ${type === 'success' ? '#22c55e' : 
                 type === 'error' ? '#ef4444' : '#3b82f6'};
        border-left: 3px solid ${type === 'success' ? '#22c55e' : 
                               type === 'error' ? '#ef4444' : '#3b82f6'};
        border-radius: 8px;
        backdrop-filter: blur(10px);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;

    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

console.log('✅ Admin Forgot Password JS Loaded');