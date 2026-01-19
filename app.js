const $ = (id) => document.getElementById(id);
let welcomeSent = false;

function showToast(message) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // Remove element after animation finishes (300ms in + 2400ms delay + 300ms out = 3000ms)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

async function getBrowserInfo() {
  let browserBrand = "";
  let browserVersion = "";

  // Try Network Information API (UA Client Hints) - works in Chrome/Edge
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const high = await navigator.userAgentData.getHighEntropyValues([
        "fullVersionList", "uaFullVersion"
      ]);
      const brands = high.fullVersionList || navigator.userAgentData.brands || [];
      const main = brands.find(b => !/Not.*Brand/i.test(b.brand)) || brands[0] || {};
      browserBrand = main.brand || "";
      browserVersion = high.uaFullVersion || main.version || "";
    } catch (e) {
      // ignore
    }
  }

  return { browserBrand, browserVersion };
}

async function buildParams() {
  const base = {
    // required params
    language: $('language').value,

    // user info
    userId: $('userId').value,
    userTier: $('userTier').value,
    isDebugMode: $('debugMode').checked,

    // extra context params
    device: isMobile() ? "mobile" : "desktop",
    pageUrl: location.href
  };

  // region: omit entirely if simulate is enabled
  if (!$('omitRegion').checked) {
    base.region = $('region').value;
  }

  // Add browser info (brand & version only)
  const browser = await getBrowserInfo();
  return { ...base, ...browser };
}

async function renderOut() {
  const params = await buildParams();
  $('out').textContent = JSON.stringify(params, null, 2);
}

function getDf() {
  return document.querySelector('df-messenger');
}

// Debug hooks: Show ACTUAL JSON sent/received to/from Google in the UI
window.addEventListener('df-request-sent', (e) => {
  const body = e?.detail?.data?.requestBody;
  if (body) {
    console.log('[debug] df-request-sent requestBody:', body);
    const existing = $('debug-out').textContent;
    const newEntry = `--- Request at ${new Date().toLocaleTimeString()} ---\n${JSON.stringify(body, null, 2)}\n\n`;
    $('debug-out').textContent = newEntry + existing;
  }
});

window.addEventListener('df-response-received', (e) => {
  const body = e?.detail?.data;
  if (body) {
    console.log('[debug] df-response-received:', body);
    const existing = $('debug-in').textContent;
    const newEntry = `--- Response at ${new Date().toLocaleTimeString()} ---\n${JSON.stringify(body, null, 2)}\n\n`;
    $('debug-in').textContent = newEntry + existing;
  }
});

window.addEventListener('df-messenger-loaded', async () => {
  console.log('[debug] df-messenger-loaded');
  const df = getDf();
  if (df) {
    const params = await buildParams();
    df.setQueryParameters({ parameters: params });
    console.log('[Init] Early parameters set on load');
  }
});

window.addEventListener('df-messenger-error', (e) => console.log('[debug] df-messenger-error:', e?.detail?.error || e));

document.addEventListener('DOMContentLoaded', () => {
  renderOut();

  ['language', 'region', 'omitRegion', 'userId', 'userTier', 'debugMode'].forEach(id => {
    $(id).addEventListener('change', renderOut);
    if (id === 'userId') {
      $(id).addEventListener('input', renderOut);
    }
  });

  async function applyNow() {
    const df = getDf();
    if (!df) return;

    const params = await buildParams();

    // 1. Set parameters for future messages
    df.setQueryParameters({ parameters: params });

    // 2. Proactively sync parameters by sending an event
    // This makes the bot "know" the parameters immediately without user typing.
    df.sendRequest('event', {
      event: "session-sync",
      languageCode: $('language').value || "en",
      parameters: params
    });

    console.log('[Apply] setQueryParameters and sent session-sync event:', params);
    return params;
  }

  $('applyBtn').addEventListener('click', async () => {
    await applyNow();
    showToast('Applied and synced! The bot now knows your parameters.');
  });

  $('newSessionBtn').addEventListener('click', async () => {
    const df = getDf();
    if (!df) return;

    // 1. Start new session first (clears history)
    df.startNewSession();

    // 2. Start manual initialization flow after a delay to ensure session is cleared
    // We move setQueryParameters INSIDE the timeout to avoid race conditions with startNewSession
    setTimeout(async () => {
      // Re-build and Re-set parameters
      const params = await buildParams();
      df.setQueryParameters({ parameters: params });
      console.log('[New Session] setQueryParameters delayed:', params);

      // 3. Send a text query to force parameter transmission
      // (Events seem to ignore queryParams in this version, so we use text)
      df.sendQuery("Hello");
      console.log('[New Session] Sent "Hello" query to sync params');
    }, 500);

    showToast('New session started & parameters synced!');
  });
});
