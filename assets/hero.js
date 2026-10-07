// Hero background loop, full-length film dialog, header state, and scroll reveals.
const heroVideo = document.getElementById('hero-video');
const heroToggle = document.getElementById('hero-video-toggle');
const heroProgress = document.querySelector('.hero-progress span');
const setToggle = paused => {
  heroToggle.classList.toggle('is-paused', paused);
  heroToggle.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (heroVideo?.dataset.videoSrc) {
  const small = heroVideo.dataset.videoSrcSmall;
  const saveData = navigator.connection?.saveData;
  const useSmall = small && (window.matchMedia('(max-width: 900px)').matches || saveData);
  heroVideo.hidden = false;
  heroVideo.muted = true;
  heroVideo.src = useSmall ? small : heroVideo.dataset.videoSrc;
  heroVideo.preload = 'auto';
  heroToggle.hidden = false;
  let wantsPlayback = !reduceMotion.matches && !saveData;
  let onScreen = true;
  const updatePlayback = () => {
    if (wantsPlayback && onScreen && !document.hidden) {
      heroVideo.play().catch(() => setToggle(true));
    } else heroVideo.pause();
  };
  heroToggle.addEventListener('click', () => {
    wantsPlayback = heroVideo.paused;
    updatePlayback();
  });
  // Fade the video in over the poster only once frames are actually moving.
  heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'));
  heroVideo.addEventListener('play', () => setToggle(false));
  heroVideo.addEventListener('pause', () => setToggle(true));
  heroVideo.addEventListener('timeupdate', () => {
    if (heroProgress && heroVideo.duration) heroProgress.style.setProperty('--p', heroVideo.currentTime / heroVideo.duration);
  });
  heroVideo.addEventListener('error', () => {
    wantsPlayback = false;
    heroVideo.hidden = true;
    heroToggle.hidden = true;
  });
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    updatePlayback();
  }).observe(heroVideo);
  document.addEventListener('visibilitychange', updatePlayback);
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) { wantsPlayback = false; updatePlayback(); }
  });
  if (!wantsPlayback) setToggle(true);
  updatePlayback();
}

// Full-length film: the video is only requested when the visitor opens it.
const filmDialog = document.getElementById('film-dialog');
const filmVideo = document.getElementById('film-video');
if (filmDialog && filmVideo && typeof filmDialog.showModal === 'function') {
  const closeFilm = () => filmDialog.close();
  let resumeHero = false;
  document.querySelectorAll('[data-film-open]').forEach(button => button.addEventListener('click', () => {
    if (!filmVideo.src) filmVideo.src = filmVideo.dataset.src;
    filmDialog.showModal();
    document.body.classList.add('film-open');
    resumeHero = Boolean(heroVideo && !heroVideo.paused);
    heroVideo?.pause();
    filmVideo.play().catch(() => {});
  }));
  filmDialog.querySelector('[data-film-close]').addEventListener('click', closeFilm);
  filmDialog.addEventListener('click', event => { if (event.target === filmDialog) closeFilm(); });
  filmDialog.addEventListener('close', () => {
    filmVideo.pause();
    document.body.classList.remove('film-open');
    if (resumeHero) heroVideo.play().catch(() => {});
  });
} else {
  // No <dialog> support: fall back to opening the file directly.
  document.querySelectorAll('[data-film-open]').forEach(button => button.addEventListener('click', () => {
    if (filmVideo) location.href = filmVideo.dataset.src;
  }));
}

// Header turns solid once the visitor scrolls past the top of the hero.
const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero-cinematic');
if (header && hero) {
  const setSolid = () => header.classList.toggle('is-solid', window.scrollY > 40);
  setSolid();
  window.addEventListener('scroll', setSolid, { passive: true });
}

// Highlight the nav link for the section in view.
const navLinks = [...document.querySelectorAll('.site-header nav a[href^="#"]')];
const sections = navLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(section => spy.observe(section));
}

// Gentle reveal for research sections as they scroll into view.
if (!reduceMotion.matches && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll('.main-content > section, .main-content > figure, .main-content > .source-strip, .media-card, .method-steps article, .result-highlights > div, .results-grid > article');
  document.documentElement.classList.add('js-reveal');
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 3) * 70}ms`;
    reveal.observe(el);
  });
}

// Muted demo clips play while on screen and pause when scrolled away.
if ('IntersectionObserver' in window) {
  const clips = document.querySelectorAll('video[data-autoplay-visible]');
  const watcher = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting && !reduceMotion.matches) target.play().catch(() => {});
      else if (!isIntersecting) target.pause();
    });
  }, { threshold: 0.35 });
  clips.forEach(clip => watcher.observe(clip));
}
