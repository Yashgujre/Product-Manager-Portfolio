const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
document.documentElement.setAttribute('data-theme', 'dark');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });
}

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.getAttribute('data-delay') || 0);
        entry.target.style.transitionDelay = `${delay}ms`;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.01,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  reveals.forEach((node) => revealObserver.observe(node));
} else {
  reveals.forEach((node) => node.classList.add('visible'));
}

const navLinks = Array.from(document.querySelectorAll('.nav-pills a'));
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
navLinks.forEach((link) => {
  const target = link.getAttribute('href');
  const targetPath = target ? target.split('/').pop() : '';
  link.classList.toggle('active', targetPath === currentPath);
});

const caseModal = document.getElementById('case-modal');
const caseLinks = document.querySelectorAll('[data-case-link]');
const caseModalClose = document.querySelector('[data-case-modal-close]');

const closeCaseModal = () => {
  if (!caseModal) return;
  caseModal.setAttribute('aria-hidden', 'true');
};

const openCaseModal = () => {
  if (!caseModal) return;
  caseModal.setAttribute('aria-hidden', 'false');
};

caseLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openCaseModal();
  });
});

if (caseModalClose) {
  caseModalClose.addEventListener('click', closeCaseModal);
}

if (caseModal) {
  caseModal.addEventListener('click', (event) => {
    if (event.target === caseModal) closeCaseModal();
  });
}

const parseMetricValue = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const animateCounter = (el) => {
  const target = parseMetricValue(el.textContent.trim());
  if (target === 0) return;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const decimals = String(target).includes('.') ? 1 : 0;
  const duration = 1100;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = (target * eased).toFixed(decimals);
    el.textContent = `${prefix}${value}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

const counterEls = document.querySelectorAll('[data-counter]');
if (counterEls.length) {
  const seen = new WeakSet();
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        animateCounter(entry.target);
      });
    },
    { threshold: 0.25 }
  );
  counterEls.forEach((el) => counterObserver.observe(el));
}

const progressEls = document.querySelectorAll('[data-progress]');
if (progressEls.length) {
  const progressObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const value = entry.target.getAttribute('data-progress') || '0';
        entry.target.style.width = `${Math.min(Number(value), 100)}%`;
        progressObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.2 }
  );
  progressEls.forEach((el) => progressObserver.observe(el));
}

const roiInvestment = document.querySelector('[data-roi-investment]');
const roiBenefit = document.querySelector('[data-roi-benefit]');
const roiYears = document.querySelector('[data-roi-years]');
const roiResult = document.querySelector('[data-roi-result]');

const updateRoi = () => {
  if (!roiInvestment || !roiBenefit || !roiYears || !roiResult) return;
  const investment = Number(roiInvestment.value) || 0;
  const benefit = Number(roiBenefit.value) || 0;
  const years = Number(roiYears.value) || 1;
  const totalInvestment = investment * years;
  const totalBenefit = benefit * years;
  const roi = totalInvestment > 0 ? ((totalBenefit - totalInvestment) / totalInvestment) * 100 : 0;
  roiResult.textContent = `${Math.round(roi)}%`;
};

[roiInvestment, roiBenefit, roiYears].forEach((input) => {
  if (input) input.addEventListener('input', updateRoi);
});
updateRoi();

const rotator = document.querySelector('[data-rotator]');
if (rotator) {
  const messages = [
    'Operational speed gains of 30-40% in critical workflows',
    'Up to 292% ROI delivered in enterprise operating environments',
    'Risk reduction and compliance controls sustained at scale',
    'Reliability performance maintained at 99.7% to 99.98% uptime',
  ];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % messages.length;
    rotator.style.opacity = '0';
    setTimeout(() => {
      rotator.querySelector('span').textContent = messages[i];
      rotator.style.opacity = '1';
    }, 170);
  }, 2600);
}
