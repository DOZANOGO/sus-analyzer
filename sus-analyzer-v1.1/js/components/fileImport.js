/* components/fileImport.js —— 文件导入区（UI 交互，无业务逻辑） */
window.WM = window.WM || {};
WM.FileImport = (function () {
  "use strict";
  let onAnalyze, onClear;

  function init(callbacks) {
    onAnalyze = callbacks.onAnalyze;
    onClear = callbacks.onClear;
    bindFileInput();
    bindDragDrop();
    bindButtons();
  }

  function bindFileInput() {
    document.getElementById('file-input').addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });
  }

  function bindDragDrop() {
    const zone = document.getElementById('drop-zone');
    zone.addEventListener('click', () => document.getElementById('file-input').click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function bindButtons() {
    document.getElementById('analyze-btn').addEventListener('click', () => onAnalyze(getText()));
    document.getElementById('sample-btn').addEventListener('click', () => {
      setText(generateSample()); onAnalyze(getText());
    });
    document.getElementById('clear-btn').addEventListener('click', clear);
  }

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = e => { setText(e.target.result); onAnalyze(e.target.result); };
    reader.readAsText(file);
  }

  function getText() { return document.getElementById('paste-area').value; }
  function setText(t) { document.getElementById('paste-area').value = t; }
  function clear() {
    setText('');
    document.getElementById('file-input').value = '';
    onClear();
  }

  /** 生成真 SUS 格式示例（含 tap/critical/flick/slide/trace slide） */
  function generateSample() {
    const L = ['#TITLE "示例谱面 DEMO"', '#ARTIST "SUS Analyzer"', '#DESIGNER "Analyzer"',
      '#WAVEOFFSET 0', '#REQUEST "ticks_per_beat 480"', '#00002: 4', '#BPM01: 120', '#00008: 01'];
    appendTaps(L, 0, 20, 2);       // 前 20 小节 tap
    appendSlide(L, 5, '8', '0');   // 第 5 小节普通滑键
    appendFlick(L, 8, '8');        // 第 8 小节 flick
    appendTraceSlide(L, 12, 'a', '0'); // 第 12 小节 trace 滑键
    appendCritical(L, 15, '5');    // 第 15 小节 critical
    return L.join('\n');
  }

  function appendTaps(L, startM, endM, stepM) {
    for (let m = startM; m < endM; m += stepM) {
      const lane = (m % 6 + 2).toString(36);
      L.push('#' + pad3(m) + '1' + lane + ': 11001100');
    }
  }

  function appendSlide(L, m, lane, id) {
    L.push('#' + pad3(m) + '3' + lane + id + ': 13000000');
    L.push('#' + pad3(m + 1) + '3' + lane + id + ': 33000000');
    L.push('#' + pad3(m + 2) + '3' + lane + id + ': 23000000');
  }

  function appendTraceSlide(L, m, lane, id) {
    L.push('#' + pad3(m) + '9' + lane + id + ': 13000000');
    L.push('#' + pad3(m + 1) + '9' + lane + id + ': 23000000');
  }

  function appendFlick(L, m, lane) {
    L.push('#' + pad3(m) + '5' + lane + ': 3100');
  }

  function appendCritical(L, m, lane) {
    L.push('#' + pad3(m) + '1' + lane + ': 2100');
  }

  function pad3(n) { return String(n).padStart(3, '0'); }

  return { init };
})();
