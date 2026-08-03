/* components/charts.js —— Canvas 图表（类型分布柱状图 + 密度曲线折线图） */
window.WM = window.WM || {};
WM.Charts = (function () {
  "use strict";
  let typeCanvas, densityCanvas, typeCtx, densityCtx;
  let zoom = 1, panRatio = 0, currentStats = null;
  const PAD = { left: 50, right: 15, top: 25, bottom: 30 };

  function init() {
    typeCanvas = document.getElementById('type-chart');
    densityCanvas = document.getElementById('density-chart');
    resetupCanvases();
    bindZoom();
    bindPan();
    window.addEventListener('resize', () => { resetupCanvases(); if (currentStats) redrawAll(); });
  }

  function resetupCanvases() {
    typeCtx = setupHiDPI(typeCanvas);
    densityCtx = setupHiDPI(densityCanvas);
  }

  function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    canvas._w = rect.width; canvas._h = rect.height;
    return ctx;
  }

  function bindZoom() {
    document.getElementById('zoom-in').addEventListener('click', () => { zoom = Math.min(20, zoom * 1.5); redrawDensity(); });
    document.getElementById('zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom / 1.5); if (zoom === 1) panRatio = 0; redrawDensity(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { zoom = 1; panRatio = 0; redrawDensity(); });
  }

  function bindPan() {
    let dragging = false, lastX = 0;
    densityCanvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; });
    window.addEventListener('mousemove', e => {
      if (!dragging || zoom <= 1) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      panRatio = Math.max(0, Math.min(1, panRatio - dx / (densityCanvas._w * (zoom - 1))));
      redrawDensity();
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  /* ---------- 类型分布柱状图 ---------- */

  function drawTypeChart(stats) {
    typeCtx = setupHiDPI(typeCanvas);
    const ctx = typeCtx, w = typeCanvas._w, h = typeCanvas._h;
    ctx.clearRect(0, 0, w, h);
    const order = WM.Stats.TYPE_ORDER;
    const names = WM.SusParser.CATEGORY_NAMES;
    const max = Math.max(...order.map(t => stats.typeCounts[t] || 0), 1);
    const barW = w / order.length * 0.6, gap = w / order.length * 0.4;
    const chartH = h - 70;
    for (let i = 0; i < order.length; i++) drawTypeBar(ctx, i, order[i], names, stats, max, barW, gap, chartH);
  }

  function drawTypeBar(ctx, i, cat, names, stats, max, barW, gap, chartH) {
    const count = stats.typeCounts[cat] || 0;
    const barH = (count / max) * chartH;
    const x = i * (barW + gap) + gap / 2;
    const y = 30 + chartH - barH;
    ctx.fillStyle = WM.Stats.TYPE_COLORS[cat];
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    if (count > 0) ctx.fillText(`${count} (${stats.typePercentages[cat].toFixed(1)}%)`, x + barW / 2, y - 6);
    ctx.fillStyle = '#aaa'; ctx.font = '11px sans-serif';
    ctx.fillText(names[cat], x + barW / 2, y + barH + 20);
  }

  /* ---------- 密度曲线折线图 ---------- */

  function drawDensityChart(stats) {
    currentStats = stats;
    densityCtx = setupHiDPI(densityCanvas);
    const ctx = densityCtx, w = densityCanvas._w, h = densityCanvas._h;
    ctx.clearRect(0, 0, w, h);
    const curve = stats.densityCurve;
    if (curve.points.length === 0) { drawEmpty(ctx, w, h); return; }
    const range = getVisibleRange(curve);
    const maxCount = Math.max(...curve.points.map(p => p.count), 1);
    drawDensGrid(ctx, w, h, maxCount, range);
    drawDensHighlight(ctx, w, h, stats, range, maxCount);
    drawDensArea(ctx, w, h, curve, range, maxCount);
    drawDensLine(ctx, w, h, curve, range, maxCount);
    drawDensPeak(ctx, w, h, curve, range, maxCount);
  }

  function getVisibleRange(curve) {
    const total = curve.points.length;
    const visible = Math.max(1, Math.floor(total / zoom));
    const maxStart = Math.max(0, total - visible);
    const startIdx = Math.round(panRatio * maxStart);
    return { startIdx, endIdx: Math.min(startIdx + visible - 1, total - 1), total, visible };
  }

  function drawDensGrid(ctx, w, h, maxCount, range) {
    const chartH = h - PAD.top - PAD.bottom;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.fillStyle = '#888'; ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = PAD.top + chartH - chartH * i / 5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(w - PAD.right, y); ctx.stroke();
      ctx.fillText(Math.round(maxCount * i / 5), PAD.left - 6, y + 4);
    }
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(range.visible / 8));
    for (let i = range.startIdx; i <= range.endIdx; i += step) ctx.fillText(i + 's', idxToX(i, w, range), h - PAD.bottom + 18);
  }

  function drawDensHighlight(ctx, w, h, stats, range, maxCount) {
    const chartH = h - PAD.top - PAD.bottom;
    for (const sec of stats.difficultySections) {
      if (sec.endIdx < range.startIdx || sec.startIdx > range.endIdx) continue;
      const x1 = idxToX(Math.max(sec.startIdx, range.startIdx), w, range);
      const x2 = idxToX(Math.min(sec.endIdx, range.endIdx), w, range);
      ctx.fillStyle = 'rgba(255,82,82,0.12)';
      ctx.fillRect(x1, PAD.top, x2 - x1, chartH);
    }
  }

  function drawDensArea(ctx, w, h, curve, range, maxCount) {
    ctx.beginPath();
    ctx.moveTo(idxToX(range.startIdx, w, range), countToY(0, h, maxCount));
    for (let i = range.startIdx; i <= range.endIdx; i++)
      ctx.lineTo(idxToX(i, w, range), countToY(curve.points[i].count, h, maxCount));
    ctx.lineTo(idxToX(range.endIdx, w, range), countToY(0, h, maxCount));
    ctx.closePath();
    ctx.fillStyle = 'rgba(124,77,255,0.12)'; ctx.fill();
  }

  function drawDensLine(ctx, w, h, curve, range, maxCount) {
    ctx.beginPath();
    for (let i = range.startIdx; i <= range.endIdx; i++) {
      const x = idxToX(i, w, range), y = countToY(curve.points[i].count, h, maxCount);
      i === range.startIdx ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#7c4dff'; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawDensPeak(ctx, w, h, curve, range, maxCount) {
    const p = curve.peakIdx;
    if (p < range.startIdx || p > range.endIdx) return;
    const x = idxToX(p, w, range), y = countToY(curve.points[p].count, h, maxCount);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = '#ff5252'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('峰值 ' + curve.points[p].count, x, y - 12);
  }

  function drawEmpty(ctx, w, h) {
    ctx.fillStyle = '#666'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('暂无密度数据', w / 2, h / 2);
  }

  function idxToX(idx, w, range) { return PAD.left + (idx - range.startIdx) / Math.max(1, range.visible - 1) * (w - PAD.left - PAD.right); }
  function countToY(count, h, max) { return PAD.top + (h - PAD.top - PAD.bottom) - count / max * (h - PAD.top - PAD.bottom); }
  function redrawDensity() { if (currentStats) drawDensityChart(currentStats); }
  function redrawAll() { if (currentStats) { drawTypeChart(currentStats); drawDensityChart(currentStats); } }

  return { init, drawTypeChart, drawDensityChart };
})();
