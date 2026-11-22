// ============================================
// NAVAZ CHILAKALA PORTFOLIO - JavaScript (hooks unchanged; content is visible without JS)
// ============================================

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileMenu();
    initTypewriter();
    initCounterAnimation();
    initSmoothScroll();
    initContactForm();
    initModeToggle();
    initField();
});

// ============================================
// CONTACT FORM: posts to Formspree; success only when Formspree says so
// (without JavaScript the form still posts normally to the same endpoint)
// ============================================
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    const status = form.querySelector('#form-status');
    const button = form.querySelector('button[type="submit"]');
    const say = (text, state) => { status.textContent = text; if (state) status.dataset.state = state; else delete status.dataset.state; };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fields = [form.name, form.email, form.message];
        fields.forEach((f) => f.removeAttribute('aria-invalid'));
        const bad = fields.find((f) => !f.checkValidity());
        if (bad) {
            bad.setAttribute('aria-invalid', 'true');
            say(bad === form.email ? 'That email address looks incomplete. Write it as name@example.com.' : 'Please fill in your ' + bad.name + '.', 'error');
            bad.focus();
            return;
        }
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        say('Sending…');
        try {
            const r = await fetch(form.dataset.endpoint || form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
            if (r.ok) {
                form.reset();
                say('Thanks, your message was sent. I’ll reply to the email you gave.', 'ok');
            } else {
                const data = await r.json().catch(() => ({}));
                const msg = data && data.errors ? data.errors.map((x) => x.message).join(' ') : '';
                say((msg || 'That did not go through.') + ' You can also email navaz786cnch@gmail.com.', 'error');
            }
        } catch (err) {
            say('That did not go through. Check your connection, or email navaz786cnch@gmail.com.', 'error');
        } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    });
}

// ============================================
// LIGHT / DARK TOGGLE (persisted; the head script applies it before first paint)
// ============================================
function initModeToggle() {
    const btn = document.querySelector('[data-mode-toggle]');
    if (!btn) return;
    const root = document.documentElement;
    const osDark = window.matchMedia('(prefers-color-scheme: dark)');
    const current = () => root.dataset.mode || (osDark.matches ? 'dark' : 'light');
    const label = () => btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    label();
    btn.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        root.dataset.mode = next;
        try { localStorage.setItem('mode', next); } catch (e) {}
        label();
        document.dispatchEvent(new CustomEvent('modechange'));
    });
    osDark.addEventListener('change', () => { if (!root.dataset.mode) { label(); document.dispatchEvent(new CustomEvent('modechange')); } });
}

// ============================================
// HERO FIELD: HTTP/2 traffic as an ASCII field on an 8 x 16 cell.
// Raw requests drift in from the left in cobalt tints and resolve to green on the right.
// 30 fps, pauses off screen, one still frame under reduced motion.
// ============================================
function initField() {
    const canvas = document.querySelector('[data-field]');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const RAMP = ' .:-=+*#%@';
    const CW = 8, CH = 16;
    let cols = 0, rows = 0, dpr = 1, t = 0, running = false, visible = true, last = 0;
    let blue = [], green = [], paper = '';
    // generic HTTP vocabulary only: no endpoint, host or product is claimed
    const TOKENS = [
        { text: 'POST', reply: '200 OK', row: 11, x: 10, speed: 9 },
        { text: 'GET', reply: '200 OK', row: 23, x: 70, speed: 7 },
        { text: 'HTTP/2', reply: '201 Created', row: 12, x: 120, speed: 8 },
        { text: 'PUT', reply: '204', row: 22, x: 160, speed: 6 },
    ];

    function readColours() {
        const s = getComputedStyle(document.documentElement);
        const v = (n) => s.getPropertyValue(n).trim();
        blue = [v('--color-glyph-1'), v('--color-glyph-2'), v('--color-glyph-3'), v('--color-glyph-4'), v('--color-accent-deep')];
        green = [v('--color-glyph-1'), v('--color-glyph-g-2'), v('--color-glyph-g-3'), v('--color-glyph-g-4'), v('--color-green')];
        paper = v('--color-paper');
    }

    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
        cols = Math.ceil(r.width / CW);
        rows = Math.ceil(r.height / CH);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
        ctx.textBaseline = 'top';
    }

    // cheap smooth noise: summed sines, enough for a calm field
    function noise(x, y, time) {
        return (Math.sin(x * 0.11 + time * 0.9) + Math.sin(y * 0.23 - time * 0.6) + Math.sin((x + y) * 0.07 + time * 0.4) + Math.sin(x * 0.031 - y * 0.05 + time)) / 4;
    }

    function draw() {
        const w = cols * CW, h = rows * CH;
        ctx.clearRect(0, 0, w, h);
        for (let y = 0; y < rows; y++) {
            // a few request "lanes" are denser, like streams on a connection
            const lane = Math.max(0, Math.sin(y * 0.55 + 1.3)) ** 6;
            for (let x = 0; x < cols; x++) {
                const p = x / cols;                       // 0 = raw (left), 1 = resolved (right)
                let n = (noise(x - t * 6, y, t) + 1) / 2;  // drift to the right
                n = n * (0.55 + 0.6 * lane) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, p * 1.25)));
                const k = Math.min(RAMP.length - 1, Math.floor(n * RAMP.length));
                if (k <= 0) continue;
                const tint = p < 0.55 ? blue : green;
                ctx.fillStyle = tint[Math.min(tint.length - 1, Math.floor(k / 2))];
                ctx.fillText(RAMP[k], x * CW, y * CH);
            }
        }
        // a few real HTTP tokens ride the dense lanes: requests in cobalt on the raw side, replies in green once resolved
        TOKENS.forEach((tk, i) => {
            const span = cols + tk.text.length + 8;
            const cx = ((tk.x + t * tk.speed) % span) - tk.text.length;
            const p = (cx + tk.text.length / 2) / cols;
            if (p < 0.08 || p > 0.98) return;
            const resolved = p >= 0.55;
            const label = resolved ? tk.reply : tk.text;
            ctx.fillStyle = paper;
            ctx.fillRect(Math.round(cx) * CW - 2, tk.row * CH, label.length * CW + 4, CH);
            ctx.fillStyle = resolved ? green[4] : blue[4];
            ctx.fillText(label, Math.round(cx) * CW, tk.row * CH + 1);
        });
    }

    function frame(now) {
        if (!running) return;
        if (now - last > 33) { t += 0.033; draw(); last = now; }
        requestAnimationFrame(frame);
    }
    function start() { if (running || prefersReducedMotion || !visible) return; running = true; requestAnimationFrame(frame); }
    function stop() { running = false; }

    readColours(); resize(); draw();
    canvas.classList.add('is-live');
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(canvas);
    }
    start();
    window.addEventListener('resize', () => { resize(); draw(); });
    document.addEventListener('modechange', () => { readColours(); draw(); });
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
}

// ============================================
// NAVIGATION
// ============================================
function initNavigation() {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ============================================
// MOBILE MENU
// ============================================
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (!menuBtn || !mobileMenu) return;

    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        menuBtn.setAttribute('aria-expanded', String(mobileMenu.classList.contains('active')));
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuBtn.classList.remove('active');
            mobileMenu.classList.remove('active');
            menuBtn.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
}

// ============================================
// TYPEWRITER EFFECT
// ============================================
function initTypewriter() {
    const typewriter = document.getElementById('typewriter');
    if (!typewriter) return;

    return; // the role holds still (no auto-rotating text); the static role from the HTML stays

    const roles = [
        'Senior R&D Engineer',
        'Backend Engineer',
        'AI / GenAI Engineer',
        'Python and Java developer',
        'Agentic AI and MCP'
    ];

    let roleIndex = 0;
    let charIndex = roles[0].length;
    let isDeleting = false;
    let isPaused = true;

    function type() {
        const currentRole = roles[roleIndex];

        if (isPaused) {
            setTimeout(type, 1500);
            isPaused = false;
            isDeleting = true;
            return;
        }

        if (isDeleting) {
            typewriter.textContent = currentRole.substring(0, charIndex - 1);
            charIndex--;

            if (charIndex === 0) {
                isDeleting = false;
                roleIndex = (roleIndex + 1) % roles.length;
            }
        } else {
            typewriter.textContent = currentRole.substring(0, charIndex + 1);
            charIndex++;

            if (charIndex === currentRole.length) {
                isPaused = true;
            }
        }

        const typingSpeed = isDeleting ? 50 : 100;
        setTimeout(type, typingSpeed);
    }

    setTimeout(type, 2500);
}

// ============================================
// COUNTER ANIMATION
// ============================================
function initCounterAnimation() {
    const counters = document.querySelectorAll('.stat-number');
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return; // final values are already in the HTML

    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-target'));
                counter.textContent = '0';
                animateCounter(counter, target);
                counterObserver.unobserve(counter);
            }
        });
    }, observerOptions);

    counters.forEach(counter => counterObserver.observe(counter));
}

function animateCounter(element, target) {
    const duration = 1200;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(target * easeOutQuart);

        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ============================================
// SMOOTH SCROLL
// ============================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                window.scrollTo({
                    top: target.offsetTop - 68,
                    behavior: prefersReducedMotion ? 'auto' : 'smooth'
                });
            }
        });
    });
}

// ============================================
// CONSOLE MESSAGE
// ============================================
console.log(
    '%cNavaz Chilakala%c\nSenior R&D Engineer, Backend & AI\nnavaz786cnch@gmail.com',
    'font-weight: bold; font-size: 14px;',
    'font-size: 12px;'
);