// ===========================
// Enhanced Animations JavaScript
// ===========================

document.addEventListener('DOMContentLoaded', function() {

    // ===== Navbar Scroll Effect =====
    const navbar = document.getElementById('mainNav');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
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
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 300) {
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
    }

    // ===== Intersection Observer for Fade-in Animations =====
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

    document.querySelectorAll('section').forEach(section => {
        observer.observe(section);
    });

    // ===== Particle Background =====
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;

        const particleCount = window.innerWidth < 768 ? 30 : 50;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            // Random starting position
            const startX = Math.random() * 100;
            particle.style.left = startX + '%';

            // Random drift amount
            const drift = (Math.random() - 0.5) * 100;
            particle.style.setProperty('--drift', drift + 'px');

            // Random animation duration
            const duration = 15 + Math.random() * 20;
            particle.style.animationDuration = duration + 's';

            // Random delay
            const delay = Math.random() * 10;
            particle.style.animationDelay = delay + 's';

            // Random size
            const size = 2 + Math.random() * 3;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            particlesContainer.appendChild(particle);
        }
    }

    createParticles();

    // ===== Pricing Toggle =====
    const billingToggle = document.getElementById('billingToggle');

    if (billingToggle) {
        billingToggle.addEventListener('change', function() {
            const isYearly = this.checked;

            document.querySelectorAll('.plan-card').forEach(card => {
                const priceElement = card.querySelector('.price-value');
                const monthlyPrice = parseFloat(card.getAttribute('data-monthly'));
                const yearlyPrice = parseFloat(card.getAttribute('data-yearly'));

                const targetPrice = isYearly ? yearlyPrice : monthlyPrice;
                const currentPrice = parseFloat(priceElement.textContent);

                // Animate price change
                animatePrice(priceElement, currentPrice, targetPrice, 500);
            });
        });
    }

    function animatePrice(element, start, end, duration) {
        const startTime = performance.now();
        const difference = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;

            const currentValue = start + (difference * easeProgress);
            element.textContent = currentValue.toFixed(2);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ===== Smooth Anchor Scrolling =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Skip if it's just "#"
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ===== Button Ripple Effect =====
    document.querySelectorAll('.btn-subscribe, .btn-gradient-outline').forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // ===== Parallax Effect on Hero =====
    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const parallax = scrolled * 0.5;
            hero.style.transform = `translateY(${parallax}px)`;
        });
    }

    // ===== Card Tilt Effect (Desktop Only) =====
    // if (window.innerWidth > 768) {
    //     document.querySelectorAll('.glass-card').forEach(card => {
    //         card.addEventListener('mousemove', function(e) {
    //             const rect = this.getBoundingClientRect();
    //             const x = e.clientX - rect.left;
    //             const y = e.clientY - rect.top;

    //             const centerX = rect.width / 2;
    //             const centerY = rect.height / 2;

    //             const rotateX = (y - centerY) / 20;
    //             const rotateY = (centerX - x) / 20;

    //             this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.02)`;
    //         });

    //         card.addEventListener('mouseleave', function() {
    //             this.style.transform = '';
    //         });
    //     });
    // }

    // ===== Add Custom Cursor Effect (Optional) =====
    if (window.innerWidth > 1024) {
        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        document.body.appendChild(cursor);

        const cursorFollower = document.createElement('div');
        cursorFollower.className = 'cursor-follower';
        document.body.appendChild(cursorFollower);

        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;
        let followerX = 0, followerY = 0;

        document.addEventListener('mousemove', function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animate() {
            // Smooth cursor movement
            cursorX += (mouseX - cursorX) * 0.3;
            cursorY += (mouseY - cursorY) * 0.3;

            followerX += (mouseX - followerX) * 0.1;
            followerY += (mouseY - followerY) * 0.1;

            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';

            cursorFollower.style.left = followerX + 'px';
            cursorFollower.style.top = followerY + 'px';

            requestAnimationFrame(animate);
        }

        animate();

        // Expand cursor on interactive elements
        document.querySelectorAll('a, button, .glass-card').forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.style.transform = 'scale(1.5)';
                cursorFollower.style.transform = 'scale(1.5)';
            });

            el.addEventListener('mouseleave', () => {
                cursor.style.transform = 'scale(1)';
                cursorFollower.style.transform = 'scale(1)';
            });
        });
    }

    // ===== Add CSS for Custom Cursor =====
    if (window.innerWidth > 1024) {
        const style = document.createElement('style');
        style.textContent = `
            .custom-cursor {
                width: 10px;
                height: 10px;
                border: 2px solid #FFD000;
                border-radius: 50%;
                position: fixed;
                pointer-events: none;
                z-index: 10000;
                transition: transform 0.2s ease;
                transform: translate(-50%, -50%);
            }

            .cursor-follower {
                width: 40px;
                height: 40px;
                border: 1px solid rgba(255, 208, 0, 0.3);
                border-radius: 50%;
                position: fixed;
                pointer-events: none;
                z-index: 9999;
                transition: transform 0.3s ease;
                transform: translate(-50%, -50%);
            }

            body {
                cursor: none;
            }

            a, button, .glass-card {
                cursor: none;
            }
        `;
        document.head.appendChild(style);
    }

    // ===== Performance Optimization: Reduce animations on low-end devices =====
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        document.body.classList.add('reduce-animations');
    }

    console.log('✨ Enhanced animations loaded successfully!');
});

// ===== Respect Reduced Motion Preference =====
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');
}

// ===== Global Logout Helper =====
window.performLogout = async function() {
    try {
        const api = new LibraryAPI();
        await api.logout();
    } catch (e) {
        // ignore
    } finally {
        window.location.href = '/auth/login.html';
    }
}