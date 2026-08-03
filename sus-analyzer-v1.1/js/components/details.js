/* components/details.js —— 详情面板（纯 UI 渲染） */
window.WM = window.WM || {};
WM.Details = (function () {
  "use strict";

  function renderMeta(meta) {
    const el = document.getElementById('meta-panel');
    el.innerHTML = '<h3>谱面信息</h3>' + buildMetaRows(meta).map(r =>
      `<div class="meta-row"><span class="meta-key">${r.key}</span><span class="meta-val">${r.val}</span></div>`
    ).join('');
  }

  function buildMetaRows(m) {
    return [
      { key: '标题', val: m.title || '—' },
      { key: '艺术家', val: m.artist || '—' },
      { key: '谱师', val: m.designer || '—' },
      { key: 'BPM', val: m.bpm || '—' },
      { key: '音频偏移', val: (m.waveOffset || 0) + ' ms' }
    ];
  }

  function renderDifficulty(sections) {
    const el = document.getElementById('difficulty-panel');
    if (sections.length === 0) {
      el.innerHTML = '<h3>难点段</h3><p class="empty">未检测到明显难点段</p>';
      return;
    }
    el.innerHTML = '<h3>难点段（密度 > 均值+1σ）</h3>' + sections.map((s, i) =>
      `<div class="detail-item"><span class="detail-tag">段${i + 1}</span>` +
      `${(s.startTime / 1000).toFixed(1)}s ~ ${(s.endTime / 1000).toFixed(1)}s · 峰值 ${s.peak} note/5s</div>`
    ).join('');
  }

  function renderDoublePress(dp) {
    const el = document.getElementById('double-press-panel');
    let html = '<h3>双押统计</h3>';
    html += `<div class="detail-item">双押/多押次数：<b>${dp.count}</b></div>`;
    html += `<div class="detail-item">最大同时按下：<b>${dp.maxSimultaneous}</b> 个</div>`;
    if (dp.densestWindow) {
      const w = dp.densestWindow;
      html += `<div class="detail-item">最密双押段：${(w.startTime / 1000).toFixed(1)}s ~ ${(w.endTime / 1000).toFixed(1)}s · ${w.count} 次</div>`;
    }
    el.innerHTML = html;
  }

  function renderSlides(slides) {
    const el = document.getElementById('slide-panel');
    el.innerHTML = '<h3>滑键链统计</h3>' +
      `<div class="detail-item">滑键链数量：<b>${slides.count}</b></div>` +
      `<div class="detail-item">最长滑键链：<b>${slides.longestLength}</b> 个 note</div>` +
      `<div class="detail-item">最长持续：<b>${(slides.longestDuration / 1000).toFixed(2)}</b> 秒</div>`;
  }

  return { renderMeta, renderDifficulty, renderDoublePress, renderSlides };
})();
