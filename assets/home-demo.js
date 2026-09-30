// Load the rally simulation straight into the page once the visitor nears it.
document.querySelectorAll('[data-rally-embed]').forEach(container => {
  const host = container.querySelector('.rally-inline-host');
  const start = container.querySelector('.rally-start');
  const cover = container.querySelector('.rally-start-screen');
  const status = cover.querySelector('.rally-download');
  const base = new URL(host.dataset.base, location.href);
  let loading = false;
  const loadScript = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error(`无法加载 ${name}，请检查网络后重试。`)); };
    document.body.append(script);
  });
  const startDemo = async () => {
    if (loading) return;
    loading = true;
    start.hidden = true;
    cover.classList.add('is-loading');
    status.textContent = '正在加载仿真… / Loading simulation…';
    try {
      await loadScript('embed-ui.js');
      const ui = window.__ATHLETE_EMBED_UI__;
      const root = host.shadowRoot ?? host.attachShadow({mode:'open'});
      const style = document.createElement('style');
      style.textContent = ui.css;
      root.innerHTML = ui.html;
      root.prepend(style);
      window.__ATHLETE_ROOT__ = root;
      window.__ATHLETE_PACKED__ = [];
      host.hidden = false;
      cover.hidden = true;
      for (let i = 0; i < ui.scripts.length; i++) {
        root.getElementById('load-text').textContent = `加载模型与物理引擎 ${i + 1}/${ui.scripts.length}…`;
        await loadScript(ui.scripts[i]);
      }
    } catch (error) {
      loading = false;
      host.hidden = true;
      cover.hidden = false;
      cover.classList.remove('is-loading');
      start.hidden = false;
      start.textContent = '重试 / Retry';
      status.textContent = error.message;
    }
  };
  start.addEventListener('click', startDemo);
  // Data-saver visitors keep the manual button; everyone else loads on approach.
  if (navigator.connection?.saveData) {
    start.hidden = false;
    status.textContent = '已开启省流量模式，点击后加载约 17 MB 的模型与物理引擎。';
  } else if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { near.disconnect(); startDemo(); }
    }, { rootMargin: '600px 0px' });
    near.observe(container);
  } else startDemo();
});
