const $ = (id) => document.getElementById(id);

function getBrowserInfo() {
  return {
    pageUrl: location.href,
    pagePath: location.pathname,
    pageTitle: document.title,
    userAgent: navigator.userAgent,
  };
}

function buildParams() {
  const p = {
    region: $('region').value,
    countryCode: $('countryCode').value,
    userId: ($('userId').value || '').trim(),
    ...getBrowserInfo(),
  };
  if (!p.userId) delete p.userId;
  return p;
}

function renderOut(params) {
  $('out').textContent = JSON.stringify(params, null, 2);
}

function getDf() {
  return document.querySelector('df-messenger');
}

// dropdown/input 改變就更新 preview
['region', 'countryCode'].forEach((id) => {
  $(id).addEventListener('change', () => renderOut(buildParams()));
});
$('userId').addEventListener('input', () => renderOut(buildParams()));

// 等 df-messenger 真係 ready 先 enable buttons
window.addEventListener('df-messenger-loaded', () => {
  $('applyBtn').disabled = false;
  $('newSessionBtn').disabled = false;
  $('sendHelloBtn').disabled = false;

  renderOut(buildParams());
});

// Apply：寫入 session parameters（之後每次 request 都會帶住）
$('applyBtn').addEventListener('click', () => {
  const df = getDf();
  const params = buildParams();

  df.setQueryParameters({ parameters: params });

  renderOut(params);
  alert('Applied! 下一句你 send 出去嘅 message 就會帶住呢啲 parameters。');
});

// Start new session：清對話歷史，方便你測「新參數」效果
$('newSessionBtn').addEventListener('click', () => {
  const df = getDf();
  df.startNewSession();
  alert('New session started (history cleared).');
});

// Send “hello”：用嚟即刻觸發 bot 回覆（你亦可以改成任意文字）
$('sendHelloBtn').addEventListener('click', () => {
  const df = getDf();
  df.sendQuery('hello');
});

// Debug：睇下每次送出 requestBody（確認 parameters 有冇跟到）
window.addEventListener('df-request-sent', (event) => {
  console.log('DF requestBody:', event.detail?.data?.requestBody);
});
