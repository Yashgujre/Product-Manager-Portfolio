const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });
}

const reveals = document.querySelectorAll('.reveal');
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
  { threshold: 0.15 }
);

reveals.forEach((node) => revealObserver.observe(node));

const sectionIds = ['overview', 'metrics', 'experience', 'case-studies', 'framework', 'contact'];
const navLinks = Array.from(document.querySelectorAll('.nav-pills a'));

const setActive = () => {
  const y = window.scrollY + 120;
  let activeId = sectionIds[0];

  sectionIds.forEach((id) => {
    const section = document.getElementById(id);
    if (section && section.offsetTop <= y) activeId = id;
  });

  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${activeId}`;
    link.classList.toggle('active', isActive);
  });
};

setActive();
window.addEventListener('scroll', setActive);

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
