document.querySelectorAll('[data-rally-embed]').forEach(container => {
  const frame = container.querySelector('iframe');
  const start = container.querySelector('.rally-start');
  start.addEventListener('click', () => {
    if (frame.hasAttribute('src')) return;
    frame.src = frame.dataset.src;
    frame.hidden = false;
    container.querySelector('.rally-start-screen').hidden = true;
  });
  window.addEventListener('message', event => {
    // The anonymous host has an opaque origin; validate the exact frame source.
    if (event.source !== frame.contentWindow || event.data?.type !== 'athlete-rally-height') return;
    const height = event.data.height;
    if (typeof height === 'number' && Number.isFinite(height)) {
      frame.style.height = `${Math.max(600, Math.min(2200, Math.ceil(height)))}px`;
    }
  });
});
