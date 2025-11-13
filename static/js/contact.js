/**
 * Contact Page JavaScript
 * Handles form validation, submission, and interactions
 */

// ===== Form Handling =====
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');

    // Form validation
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const validatePhone = (phone) => {
        if (!phone) return true; // Optional field
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    };

    // Form submission
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Hide previous alerts
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';

        // Get form values
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const subject = document.getElementById('subject').value;
        const message = document.getElementById('message').value.trim();
        const newsletter = document.getElementById('newsletter').checked;

        // Validation
        if (!fullName || fullName.length < 2) {
            showError('Please enter a valid name');
            return;
        }

        if (!validateEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }

        if (phone && !validatePhone(phone)) {
            showError('Please enter a valid phone number');
            return;
        }

        if (!subject) {
            showError('Please select a subject');
            return;
        }

        if (!message || message.length < 10) {
            showError('Please enter a message (at least 10 characters)');
            return;
        }

        // Show loading state
        const submitBtn = contactForm.querySelector('.btn-submit');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitBtn.disabled = true;

        // Prepare data
        const formData = {
            fullName,
            email,
            phone,
            subject,
            message,
            newsletter,
            timestamp: new Date().toISOString()
        };

        try {
            // Simulate API call (replace with actual API endpoint)
            await simulateAPICall(formData);

            // Show success message
            showSuccess();

            // Reset form
            contactForm.reset();

        } catch (error) {
            showError(error.message || 'An error occurred. Please try again.');
        } finally {
            // Reset button
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    // Show success message
    function showSuccess() {
        successAlert.style.display = 'flex';
        successAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto hide after 5 seconds
        setTimeout(() => {
            successAlert.style.display = 'none';
        }, 5000);
    }

    // Show error message
    function showError(msg) {
        errorMessage.textContent = msg;
        errorAlert.style.display = 'flex';
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto hide after 5 seconds
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    }

    // Simulate API call (replace with actual API)
    function simulateAPICall(data) {
        return new Promise((resolve, reject) => {
            console.log('Form submitted:', data);

            // Simulate network delay
            setTimeout(() => {
                // Simulate success (90% chance)
                if (Math.random() < 0.9) {
                    resolve({ success: true });
                } else {
                    reject(new Error('Network error. Please try again.'));
                }
            }, 1500);
        });
    }

    // Real-time validation feedback
    const inputs = contactForm.querySelectorAll('.form-control-custom');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.required && !this.value.trim()) {
                this.style.borderColor = '#ff4444';
            } else if (this.type === 'email' && !validateEmail(this.value)) {
                this.style.borderColor = '#ff4444';
            } else {
                this.style.borderColor = 'rgba(255, 208, 0, 0.3)';
            }
        });

        input.addEventListener('focus', function() {
            this.style.borderColor = 'var(--accent)';
        });
    });
});

// ===== FAQ Accordion =====
document.addEventListener('DOMContentLoaded', function() {
    const accordionButtons = document.querySelectorAll('.accordion-button-custom');

    accordionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const target = this.getAttribute('data-bs-target');
            const collapse = document.querySelector(target);

            // Toggle collapsed class
            this.classList.toggle('collapsed');

            // Animate icon rotation
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = this.classList.contains('collapsed') ? 
                    'rotate(0deg)' : 'rotate(180deg)';
            }
        });
    });
});

// ===== Scroll Animations =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe sections
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(40px)';
    section.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    observer.observe(section);
});

// Add visible class effect
const style = document.createElement('style');
style.textContent = `
    section.visible {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

// ===== Navbar Scroll Effect =====
window.addEventListener('scroll', function() {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ===== Back to Top Button =====
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', function() {
    if (window.scrollY > 300) {
        backToTop.style.display = 'flex';
    } else {
        backToTop.style.display = 'none';
    }
});

backToTop.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// ===== Character Counter for Textarea =====
document.addEventListener('DOMContentLoaded', function() {
    const messageField = document.getElementById('message');
    if (messageField) {
        const counterDiv = document.createElement('div');
        counterDiv.className = 'char-counter';
        counterDiv.style.cssText = 'text-align: right; color: var(--muted-2); font-size: 0.85rem; margin-top: 5px;';
        messageField.parentElement.appendChild(counterDiv);

        const updateCounter = () => {
            const length = messageField.value.length;
            const maxLength = 1000;
            counterDiv.textContent = `${length} / ${maxLength} characters`;

            if (length > maxLength * 0.9) {
                counterDiv.style.color = 'var(--accent)';
            } else {
                counterDiv.style.color = 'var(--muted-2)';
            }
        };

        messageField.addEventListener('input', updateCounter);
        updateCounter();
    }
});

// ===== Copy Email on Click =====
document.addEventListener('DOMContentLoaded', function() {
    const emailElements = document.querySelectorAll('.info-text');

    emailElements.forEach(el => {
        if (el.textContent.includes('@')) {
            el.style.cursor = 'pointer';
            el.title = 'Click to copy';

            el.addEventListener('click', function() {
                const email = this.textContent.trim();

                // Copy to clipboard
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(email).then(() => {
                        // Show feedback
                        const originalText = this.textContent;
                        this.textContent = '✓ Copied!';
                        this.style.color = '#4caf50';

                        setTimeout(() => {
                            this.textContent = originalText;
                            this.style.color = 'var(--accent)';
                        }, 2000);
                    });
                }
            });
        }
    });
});

// ===== Social Media Click Tracking =====
document.addEventListener('DOMContentLoaded', function() {
    const socialLinks = document.querySelectorAll('.social-icon-large, .footer .social-icons a');

    socialLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const platform = this.querySelector('i').className.split(' ')[1].replace('fa-', '');
            console.log(`Social media clicked: ${platform}`);

            // Add your analytics or redirect logic here
            alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} coming soon!`);
        });
    });
});

// ===== Form Auto-save (Optional) =====
let autoSaveTimeout;
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contactForm');
    const inputs = form.querySelectorAll('input, textarea, select');

    // Load saved data
    const loadFormData = () => {
        inputs.forEach(input => {
            const savedValue = localStorage.getItem(`contact_${input.id}`);
            if (savedValue && input.type !== 'checkbox') {
                input.value = savedValue;
            } else if (input.type === 'checkbox' && savedValue === 'true') {
                input.checked = true;
            }
        });
    };

    // Save form data
    const saveFormData = () => {
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                localStorage.setItem(`contact_${input.id}`, input.checked);
            } else {
                localStorage.setItem(`contact_${input.id}`, input.value);
            }
        });
    };

    // Auto-save on input
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(saveFormData, 1000);
        });
    });

    // Clear saved data on successful submission
    form.addEventListener('submit', function() {
        inputs.forEach(input => {
            localStorage.removeItem(`contact_${input.id}`);
        });
    });

    // Load data on page load
    loadFormData();
});

console.log('Contact page loaded successfully!');