document.querySelectorAll('[data-rally-embed]').forEach(container => {
  const host = container.querySelector('.rally-inline-host');
  const start = container.querySelector('.rally-start');
  const cover = container.querySelector('.rally-start-screen');
  const base = new URL(host.dataset.base, location.href);
  const loadScript = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error(`无法加载 ${name}，请检查网络后重试。`)); };
    document.body.append(script);
  });
  start.addEventListener('click', async () => {
    if (start.disabled) return;
    start.disabled = true;
    start.textContent = '正在加载…';
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
      host.hidden = true;
      cover.hidden = false;
      start.disabled = false;
      start.textContent = '重试 / Retry';
      cover.querySelector('.rally-download').textContent = error.message;
    }
  });
});
