// No media request is made while the background is only a poster.
const heroVideo = document.getElementById('hero-video');
const heroToggle = document.getElementById('hero-video-toggle');
const heroStatus = document.querySelector('.hero-video-status');
if (heroVideo?.dataset.videoSrc) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  heroVideo.hidden = false;
  heroVideo.muted = true;
  heroVideo.src = heroVideo.dataset.videoSrc;
  heroVideo.preload = 'metadata';
  heroToggle.hidden = false;
  heroStatus.textContent = 'DEMONSTRATION · SILENT LOOP';
  let wantsPlayback = !reduceMotion.matches;
  let onScreen = true;
  const updatePlayback = () => {
    if (wantsPlayback && onScreen && !document.hidden) {
      heroVideo.play().catch(() => { heroToggle.textContent = 'Play background'; });
    } else heroVideo.pause();
  };
  heroToggle.addEventListener('click', () => {
    wantsPlayback = heroVideo.paused;
    updatePlayback();
  });
  heroVideo.addEventListener('play', () => { heroToggle.textContent = 'Pause background'; });
  heroVideo.addEventListener('pause', () => { heroToggle.textContent = 'Play background'; });
  heroVideo.addEventListener('error', () => {
    wantsPlayback = false;
    heroVideo.hidden = true;
    heroStatus.textContent = 'Video unavailable · Showing cover';
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
}
