// ===========================
// About Page JavaScript
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

    // ===== Create Particles =====
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;

        const particleCount = window.innerWidth < 768 ? 30 : 50;

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

    // ===== Animated Counter =====
    function animateCounter(element, target) {
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current).toLocaleString();
            }
        }, 30);
    }

    // Trigger counters when visible
    const counterObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.counted) {
                entry.target.dataset.counted = 'true';
                const target = parseInt(entry.target.dataset.target);
                animateCounter(entry.target, target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.counter').forEach(counter => {
        counterObserver.observe(counter);
    });

    // ===== Smooth Anchor Scrolling =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

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

    // ===== Card Tilt Effect (Desktop) =====
    if (window.innerWidth > 768) {
        document.querySelectorAll('.glass-card').forEach(card => {
            card.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;

                this.style.transform = \`perspective(1000px) rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) translateY(-10px) scale(1.02)\`;
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        });
    }

    // ===== Parallax Effect on Hero =====
    const hero = document.querySelector('.about-hero');
    if (hero) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const parallax = scrolled * 0.5;
            hero.style.transform = \`translateY(\${parallax}px)\`;
        });
    }

    console.log('✨ About page loaded successfully!');
});
