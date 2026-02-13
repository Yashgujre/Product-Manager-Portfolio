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
  const match = String(value).match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : 0;
};

const animateCounter = (el) => {
  const source = el.dataset.target || el.textContent.trim();
  if (!el.dataset.target) el.dataset.target = source;
  const target = parseMetricValue(source);
  if (target === 0) return;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const decimals = String(source).includes('.') ? 1 : 0;
  const duration = 1100;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = (target * eased).toFixed(decimals);
    el.textContent = `${prefix}${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.dataset.animated = 'true';
    }
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

const xpRoot = document.querySelector('[data-xp-root]');
if (xpRoot) {
  const xpCanvas = xpRoot.querySelector('[data-xp-canvas]');
  const xpCards = Array.from(xpRoot.querySelectorAll('.xp-card'));
  const viewedEl = xpRoot.querySelector('[data-xp-viewed]');
  const activeFiltersEl = xpRoot.querySelector('[data-xp-active-filters]');
  const nextBtn = xpRoot.querySelector('[data-xp-next]');

  const filterIndustry = xpRoot.querySelector('[data-xp-filter="industry"]');
  const filterChallenge = xpRoot.querySelector('[data-xp-filter="challenge"]');
  const filterOutcome = xpRoot.querySelector('[data-xp-filter="outcome"]');
  const filterTime = xpRoot.querySelector('[data-xp-filter="time"]');
  const filterSearch = xpRoot.querySelector('[data-xp-filter="search"]');
  const timeLabel = xpRoot.querySelector('[data-xp-time-label]');

  const viewButtons = Array.from(xpRoot.querySelectorAll('[data-xp-view]'));
  const exploreButtons = Array.from(xpRoot.querySelectorAll('[data-xp-explore]'));
  const highlight = xpRoot.querySelector('[data-xp-highlight] span');

  const state = {
    industry: 'all',
    challenge: 'all',
    outcome: 'all',
    maxTime: Number(filterTime?.value || 18),
    query: '',
    view: 'journey',
    storyIndex: 0,
  };

  const viewedCards = new Set();

  const updateViewed = () => {
    if (!viewedEl) return;
    viewedEl.textContent = `${viewedCards.size} / ${xpCards.length}`;
  };

  const collapseCard = (card) => {
    const panel = card.querySelector('.xp-expanded');
    const button = card.querySelector('[data-xp-toggle]');
    if (panel) panel.hidden = true;
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Explore Full Story ->';
    }
    card.classList.remove('expanded');
  };

  const expandCard = (card) => {
    if (state.view === 'story') {
      xpCards.forEach((other) => {
        if (other !== card) collapseCard(other);
      });
    }
    const panel = card.querySelector('.xp-expanded');
    const button = card.querySelector('[data-xp-toggle]');
    if (!panel || !button) return;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'Collapse Story';
    card.classList.add('expanded');

    panel.querySelectorAll('[data-counter]').forEach((counterEl) => {
      if (counterEl.dataset.animated === 'true') return;
      animateCounter(counterEl);
    });

    panel.querySelectorAll('[data-progress]').forEach((fill) => {
      fill.style.width = '0%';
      requestAnimationFrame(() => {
        const value = Number(fill.getAttribute('data-progress') || '0');
        fill.style.width = `${Math.min(value, 100)}%`;
      });
    });
  };

  xpCards.forEach((card) => {
    const toggle = card.querySelector('[data-xp-toggle]');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const isOpen = !card.querySelector('.xp-expanded')?.hidden;
        if (isOpen) {
          collapseCard(card);
        } else {
          expandCard(card);
        }
      });
    }

    const stepButtons = Array.from(card.querySelectorAll('[data-xp-phase]'));
    const stepPanels = Array.from(card.querySelectorAll('[data-xp-phase-panel]'));
    stepButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-xp-phase');
        stepButtons.forEach((b) => b.classList.toggle('active', b === btn));
        stepPanels.forEach((panel) => {
          panel.classList.toggle('active', panel.getAttribute('data-xp-phase-panel') === target);
        });
      });
    });

    const compareBlocks = card.querySelectorAll('[data-xp-compare]');
    compareBlocks.forEach((block) => {
      const modeButtons = Array.from(block.querySelectorAll('[data-xp-compare-mode]'));
      const values = Array.from(block.querySelectorAll('[data-xp-compare-value]'));
      modeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-xp-compare-mode') || 'before';
          modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
          values.forEach((value) => {
            value.textContent = mode === 'after' ? value.dataset.after || '' : value.dataset.before || '';
          });
        });
      });
    });

    card.addEventListener('mousemove', (event) => {
      if (window.matchMedia('(max-width: 900px)').matches) return;
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rx = ((centerY - event.clientY) / rect.height) * 2.6;
      const ry = ((event.clientX - centerX) / rect.width) * 2.6;
      card.style.setProperty('--xp-rx', `${rx}deg`);
      card.style.setProperty('--xp-ry', `${ry}deg`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--xp-rx', '0deg');
      card.style.setProperty('--xp-ry', '0deg');
    });
  });

  const getVisibleCards = () =>
    xpCards.filter((card) => !card.classList.contains('filtered-out'));

  const updateStoryVisibility = () => {
    const visibleCards = getVisibleCards();
    if (state.view !== 'story') {
      xpCards.forEach((card) => card.classList.remove('story-hidden'));
      return;
    }

    if (!visibleCards.length) return;
    if (state.storyIndex >= visibleCards.length) state.storyIndex = 0;
    const activeCard = visibleCards[state.storyIndex];

    xpCards.forEach((card) => {
      card.classList.toggle('story-hidden', card !== activeCard);
      if (card !== activeCard) collapseCard(card);
    });
    expandCard(activeCard);
  };

  const renderActiveFilters = () => {
    if (!activeFiltersEl) return;
    const chips = [];
    if (state.industry !== 'all') chips.push({ key: 'industry', label: `industry: ${state.industry}` });
    if (state.challenge !== 'all') chips.push({ key: 'challenge', label: `challenge: ${state.challenge}` });
    if (state.outcome !== 'all') chips.push({ key: 'outcome', label: `outcome: ${state.outcome}` });
    if (state.maxTime < 24) chips.push({ key: 'time', label: `timeline: <= ${state.maxTime} months` });
    if (state.query) chips.push({ key: 'search', label: `search: ${state.query}` });

    activeFiltersEl.innerHTML = chips
      .map((chip) => `<span class=\"xp-chip\">${chip.label} <button type=\"button\" data-xp-clear=\"${chip.key}\" aria-label=\"Clear ${chip.key}\">x</button></span>`)
      .join('');
  };

  const applyFilters = () => {
    xpCards.forEach((card) => {
      const industry = card.dataset.industry || '';
      const challenges = (card.dataset.challenges || '').split(' ');
      const outcomes = (card.dataset.outcomes || '').split(' ');
      const timeline = Number(card.dataset.time || '0');
      const search = (card.dataset.search || '').toLowerCase();

      const matchIndustry = state.industry === 'all' || industry === state.industry;
      const matchChallenge = state.challenge === 'all' || challenges.includes(state.challenge);
      const matchOutcome = state.outcome === 'all' || outcomes.includes(state.outcome);
      const matchTime = timeline <= state.maxTime;
      const matchSearch = !state.query || search.includes(state.query);

      const visible = matchIndustry && matchChallenge && matchOutcome && matchTime && matchSearch;
      card.classList.toggle('filtered-out', !visible);
      if (!visible) collapseCard(card);
    });

    renderActiveFilters();
    updateStoryVisibility();
  };

  const updateViewMode = () => {
    if (!xpCanvas) return;
    xpCanvas.classList.remove('view-journey', 'view-matrix', 'view-story', 'view-comparison');
    xpCanvas.classList.add(`view-${state.view}`);
    viewButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-xp-view') === state.view);
    });
    updateStoryVisibility();
  };

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.getAttribute('data-xp-view') || 'journey';
      updateViewMode();
    });
  });

  if (filterIndustry) {
    filterIndustry.addEventListener('change', () => {
      state.industry = filterIndustry.value;
      applyFilters();
    });
  }

  if (filterChallenge) {
    filterChallenge.addEventListener('change', () => {
      state.challenge = filterChallenge.value;
      applyFilters();
    });
  }

  if (filterOutcome) {
    filterOutcome.addEventListener('change', () => {
      state.outcome = filterOutcome.value;
      applyFilters();
    });
  }

  if (filterTime && timeLabel) {
    filterTime.addEventListener('input', () => {
      state.maxTime = Number(filterTime.value || '24');
      timeLabel.textContent = `${state.maxTime} months`;
      applyFilters();
    });
  }

  if (filterSearch) {
    filterSearch.addEventListener('input', () => {
      state.query = filterSearch.value.trim().toLowerCase();
      applyFilters();
    });
  }

  if (activeFiltersEl) {
    activeFiltersEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const clear = target.getAttribute('data-xp-clear');
      if (!clear) return;

      if (clear === 'industry' && filterIndustry) {
        state.industry = 'all';
        filterIndustry.value = 'all';
      }
      if (clear === 'challenge' && filterChallenge) {
        state.challenge = 'all';
        filterChallenge.value = 'all';
      }
      if (clear === 'outcome' && filterOutcome) {
        state.outcome = 'all';
        filterOutcome.value = 'all';
      }
      if (clear === 'time' && filterTime && timeLabel) {
        state.maxTime = 24;
        filterTime.value = '24';
        timeLabel.textContent = '24 months';
      }
      if (clear === 'search' && filterSearch) {
        state.query = '';
        filterSearch.value = '';
      }

      applyFilters();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const visibleCards = getVisibleCards();
      if (!visibleCards.length) return;

      if (state.view === 'story') {
        state.storyIndex = (state.storyIndex + 1) % visibleCards.length;
        updateStoryVisibility();
        visibleCards[state.storyIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const nextVisible = visibleCards.find((card) => card.getBoundingClientRect().top > 140) || visibleCards[0];
      nextVisible.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if ('IntersectionObserver' in window) {
    const viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const card = entry.target;
          if (card.classList.contains('filtered-out') || card.classList.contains('story-hidden')) return;
          const cardId = card.getAttribute('id');
          if (cardId) viewedCards.add(cardId);
          updateViewed();
        });
      },
      { threshold: 0.45 }
    );
    xpCards.forEach((card) => viewObserver.observe(card));
  }

  const highlightMap = {
    industry: [
      'Healthcare: intervention turnaround improved by 30-40% with measurable quality impact.',
      'Financial technology: credit decisions shifted from days to sub-500ms.',
      'Pharmaceutical operations: reconciliation effort reduced from 40 hours to 4 hours per week.',
    ],
    challenge: [
      'Data integration: fragmented systems unified into governable product workflows.',
      'Workflow automation: manual reviews and reporting moved into scalable operating models.',
      'Compliance and risk: controls embedded into architecture, not added as afterthoughts.',
    ],
    outcome: [
      'Revenue impact: up to $1.6M in year-one revenue gains from decisioning optimization.',
      'Cost reduction: $400K annual savings and major manual effort reductions across operations.',
      'Efficiency and mitigation: 95% automation and 78% audit risk reduction in regulated environments.',
    ],
  };

  let highlightIndex = 0;
  let highlightMode = 'industry';
  let highlightTimer = null;

  const runHighlightTicker = () => {
    if (!highlight) return;
    const messages = highlightMap[highlightMode];
    if (!messages?.length) return;
    highlightIndex = (highlightIndex + 1) % messages.length;
    highlight.parentElement.style.opacity = '0';
    setTimeout(() => {
      highlight.textContent = messages[highlightIndex];
      highlight.parentElement.style.opacity = '1';
    }, 170);
  };

  const resetHighlightTicker = () => {
    if (!highlight) return;
    const messages = highlightMap[highlightMode];
    highlightIndex = 0;
    highlight.textContent = messages[highlightIndex];
    if (highlightTimer) clearInterval(highlightTimer);
    highlightTimer = setInterval(runHighlightTicker, 3200);
  };

  exploreButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      exploreButtons.forEach((b) => b.classList.toggle('active', b === btn));
      highlightMode = btn.getAttribute('data-xp-explore') || 'industry';
      resetHighlightTicker();
    });
  });

  updateViewMode();
  applyFilters();
  updateViewed();
  resetHighlightTicker();
}
