/**
 * Error Pages JavaScript
 * Particle generation, animations, and interactions
 */

// ===== Particle Generation =====
function generateParticles() {
    const container = document.getElementById('particlesContainer');
    if (!container) return;

    const particleCount = Math.min(window.innerWidth / 50, 20);

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const randomDelay = Math.random() * 20;
        const randomDuration = 15 + Math.random() * 10;
        const randomDrift = (Math.random() - 0.5) * 100;

        particle.style.setProperty('--drift', randomDrift + 'px');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = randomDuration + 's';
        particle.style.animationDelay = randomDelay + 's';

        container.appendChild(particle);
    }
}

// ===== Error Code Counter Animation =====
function animateErrorCode() {
    const errorCode = document.querySelector('.error-code');
    if (!errorCode) return;

    const targetCode = errorCode.getAttribute('data-code');
    const digits = targetCode.split('');
    let currentIndex = 0;

    function updateDigit() {
        if (currentIndex < digits.length) {
            errorCode.textContent = digits.slice(0, currentIndex + 1).join('');
            currentIndex++;
            setTimeout(updateDigit, 200);
        }
    }

    // Trigger animation after page load
    setTimeout(updateDigit, 300);
}

// ===== Typewriter Effect for Error Message =====
function typewriterEffect() {
    const message = document.querySelector('.error-message');
    if (!message) return;

    const text = message.textContent;
    message.textContent = '';
    let index = 0;

    function type() {
        if (index < text.length) {
            message.textContent += text[index];
            index++;
            setTimeout(type, 30);
        }
    }

    setTimeout(type, 500);
}

// ===== Smooth Scroll for Links =====
function setupLinks() {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            // Don't prevent default for external links or javascript: links
            if (this.protocol === 'javascript:' || this.target === '_blank') {
                return;
            }

            // Smooth scroll effect
            const href = this.getAttribute('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('http')) {
                // Add visual feedback
                this.style.opacity = '0.8';
                setTimeout(() => {
                    this.style.opacity = '1';
                }, 200);
            }
        });
    });
}

// ===== Button Ripple Effect =====
function setupButtonRipple() {
    const buttons = document.querySelectorAll('.btn');

    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.6)';
            ripple.style.pointerEvents = 'none';

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            // Remove ripple after animation
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// ===== Scroll Detection =====
function setupScrollDetection() {
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateScrollElements();
                ticking = false;
            });
            ticking = true;
        }
    });
}

function updateScrollElements() {
    const scrolled = window.scrollY;
    const elements = document.querySelectorAll('[data-scroll]');

    elements.forEach(el => {
        el.style.transform = `translateY(${scrolled * 0.5}px)`;
    });
}

// ===== Auto-redirect After Delay (Optional) =====
function setupAutoRedirect() {
    const autoRedirectElement = document.querySelector('[data-auto-redirect]');
    if (!autoRedirectElement) return;

    const redirectUrl = autoRedirectElement.getAttribute('data-auto-redirect');
    const redirectDelay = parseInt(autoRedirectElement.getAttribute('data-redirect-delay') || 10000);

    setTimeout(() => {
        window.location.href = redirectUrl;
    }, redirectDelay);
}

// ===== Countdown Timer (for Maintenance Page) =====
function setupCountdown() {
    const countdownElement = document.querySelector('.status-time');
    if (!countdownElement || !countdownElement.textContent.includes('45')) return;

    let timeLeft = 45 * 60; // 45 minutes in seconds

    setInterval(() => {
        timeLeft--;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        countdownElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} minutes`;

        if (timeLeft <= 0) {
            countdownElement.textContent = 'Coming back now!';
            countdownElement.style.color = '#22c55e';
        }
    }, 1000);
}

// ===== Keyboard Shortcuts =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // H key - Go to home
        if (e.key === 'h' || e.key === 'H') {
            const homeBtn = document.querySelector('a[href="index.html"]');
            if (homeBtn) homeBtn.click();
        }

        // B key - Go back
        if (e.key === 'b' || e.key === 'B') {
            window.history.back();
        }

        // C key - Contact support
        if (e.key === 'c' || e.key === 'C') {
            const contactBtn = document.querySelector('a[href="contact.html"]');
            if (contactBtn) contactBtn.click();
        }
    });
}

// ===== Console Messages =====
function printConsoleMessages() {
    console.clear();
    console.log(
        '%cDigital Library',
        'font-size: 24px; font-weight: bold; color: #ffd000; text-shadow: 0 0 10px #ffd000;'
    );
    console.log(
        '%cError encountered. Don't worry, we're on it!',
        'font-size: 12px; color: #bfc4c9;'
    );
    console.log(
        '%cUse H to go home, B to go back, or C to contact support',
        'font-size: 11px; color: #888888; font-style: italic;'
    );
}

// ===== Parallax Effect =====
function setupParallax() {
    const elements = document.querySelectorAll('.float-book, .float-circle, .float-square');

    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX - window.innerWidth / 2) / 100;
        const y = (e.clientY - window.innerHeight / 2) / 100;

        elements.forEach((el, index) => {
            el.style.transform = `translate(${x * (index + 1)}px, ${y * (index + 1)}px)`;
        });
    });
}

// ===== Theme Toggle (Optional) =====
function setupThemeToggle() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    if (prefersDark.matches) {
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.style.colorScheme = 'light';
    }

    prefersDark.addEventListener('change', (e) => {
        document.documentElement.style.colorScheme = e.matches ? 'dark' : 'light';
    });
}

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', function() {
    generateParticles();
    animateErrorCode();
    typewriterEffect();
    setupLinks();
    setupButtonRipple();
    setupScrollDetection();
    setupKeyboardShortcuts();
    setupParallax();
    setupThemeToggle();
    printConsoleMessages();

    // Optional: Setup auto-redirect if specified
    // setupAutoRedirect();

    // Optional: Setup countdown for maintenance
    // setupCountdown();

    // Trigger initial animations
    window.dispatchEvent(new Event('scroll'));

    // Add touch feedback for mobile
    if ('ontouchstart' in window) {
        document.addEventListener('touchstart', function() {}, false);
    }

    console.log('✨ Error page loaded and ready!');
});

// ===== Handle Window Resize =====
window.addEventListener('resize', () => {
    const container = document.getElementById('particlesContainer');
    if (container && container.children.length < 5) {
        generateParticles();
    }
});

// ===== Performance Monitoring =====
if ('PerformanceObserver' in window) {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.debug('Performance:', entry);
            }
        });
        observer.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (e) {
        // Performance API not fully supported
    }
}
