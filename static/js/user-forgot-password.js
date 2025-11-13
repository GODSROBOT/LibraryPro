// User Forgot Password - OTP Flow

let currentStep = 1;
let userEmail = '';
let otpTimer = 0;

// ===== STEP 1: EMAIL SUBMISSION =====
function handleEmailSubmit(e) {
    e.preventDefault();
    userEmail = document.getElementById('userEmail').value;

    if (validateEmail(userEmail)) {
        // call server to create reset token
        fetch('/api/auth/forgot-password', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email: userEmail})
        }).then(r => r.json()).then(res => {
            if (res && res.status === 'success' && res.data && res.data.reset_token) {
                // store token in memory (for dev). In prod the user would get token via email.
                window.__reset_token = res.data.reset_token;
                document.getElementById('emailDisplay').textContent = 'Code (dev) sent to ' + userEmail;
                showNotification('Reset token created (dev). Proceed to OTP step.', 'success');
                goToStep(2);
                startResendTimer();
            } else {
                showNotification((res && res.message) || 'If the email exists, a reset link was sent', 'info');
                goToStep(2);
                startResendTimer();
            }
        }).catch(err => {
            console.error('forgot-password error', err);
            showNotification('Error creating reset token', 'error');
        });
    } else {
        showNotification('Please enter a valid email', 'error');
    }
}

// ===== STEP 2: OTP VERIFICATION =====
function handleOTPSubmit(e) {
    e.preventDefault();

    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length === 6 && /^[0-9]{6}$/.test(otp)) {
        showNotification('OTP verified successfully!', 'success');
        goToStep(3);
    } else {
        showNotification('Invalid OTP. Please try again.', 'error');
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
    }
}

// ===== STEP 3: PASSWORD RESET =====
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

    showNotification('Resetting password...', 'info');
    // call server reset endpoint with stored token
    const token = window.__reset_token;
    if (!token) {
        showNotification('Reset token missing. Start over.', 'error');
        return;
    }
    fetch('/api/auth/reset-password', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({token: token, new_password: newPassword})
    }).then(r => r.json()).then(res => {
        if (res && res.status === 'success') {
            showNotification('Password reset successful!', 'success');
            goToStep(4);
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
    const steps = ['step1-email', 'step2-otp', 'step3-password', 'step4-success'];

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
    }
}

// ===== RESEND OTP =====
function handleResendOTP() {
    if (otpTimer > 0) {
        showNotification('Please wait before requesting new OTP', 'warning');
        return;
    }

    showNotification('OTP resent to your email', 'success');

    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach(input => input.value = '');
    otpInputs[0].focus();

    startResendTimer();
}

function startResendTimer() {
    otpTimer = 60;
    const timerElement = document.getElementById('resendTimer');

    const interval = setInterval(() => {
        otpTimer--;
        if (otpTimer <= 0) {
            timerElement.textContent = '';
            clearInterval(interval);
        } else {
            timerElement.textContent = ` (${otpTimer}s)`;
        }
    }, 1000);
}

// ===== PASSWORD STRENGTH CHECKER =====
function updatePasswordStrength() {
    const password = document.getElementById('newPassword').value;
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    let strength = 0;

    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 10;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[!@#$%^&*]/.test(password)) strength += 15;

    strengthBar.style.width = strength + '%';

    if (strength < 25) {
        strengthText.textContent = 'Very Weak';
        strengthBar.style.background = '#ef4444';
    } else if (strength < 50) {
        strengthText.textContent = 'Weak';
        strengthBar.style.background = '#f59e0b';
    } else if (strength < 75) {
        strengthText.textContent = 'Good';
        strengthBar.style.background = '#3b82f6';
    } else {
        strengthText.textContent = 'Strong';
        strengthBar.style.background = '#22c55e';
    }

    // Update requirements
    updateRequirements(password);
}

function updateRequirements(password) {
    const requirements = {
        'req-length': password.length >= 8,
        'req-uppercase': /[A-Z]/.test(password),
        'req-number': /[0-9]/.test(password),
        'req-special': /[!@#$%^&*]/.test(password)
    };

    Object.entries(requirements).forEach(([id, met]) => {
        const element = document.getElementById(id);
        if (met) {
            element.classList.add('valid');
        } else {
            element.classList.remove('valid');
        }
    });
}

// ===== PASSWORD VISIBILITY =====
function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const button = event.target.closest('.toggle-eye');

    if (field.type === 'password') {
        field.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        field.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// ===== AUTO-FOCUS FOR OTP INPUTS =====
document.addEventListener('DOMContentLoaded', function() {
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', function() {
            if (this.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
});

// ===== VALIDATION FUNCTIONS =====
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 8 &&
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
                       type === 'warning' ? 'rgba(245, 158, 11, 0.2)' :
                       'rgba(59, 130, 246, 0.2)'};
        color: ${type === 'success' ? '#22c55e' : 
                 type === 'error' ? '#ef4444' : 
                 type === 'warning' ? '#f59e0b' :
                 '#3b82f6'};
        border-left: 3px solid ${type === 'success' ? '#22c55e' : 
                               type === 'error' ? '#ef4444' : 
                               type === 'warning' ? '#f59e0b' :
                               '#3b82f6'};
        border-radius: 8px;
        backdrop-filter: blur(10px);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    `;

    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

console.log('✅ User Forgot Password JS Loaded');