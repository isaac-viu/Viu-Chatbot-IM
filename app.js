const $ = (id) => document.getElementById(id);
let welcomeSent = false;

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
    $('debug-out').textContent = JSON.stringify(body, null, 2);
  }
});

window.addEventListener('df-response-received', (e) => {
  const body = e?.detail?.data;
  if (body) {
    console.log('[debug] df-response-received:', body);
    $('debug-in').textContent = JSON.stringify(body, null, 2);
  }
});

window.addEventListener('df-messenger-loaded', async () => {
  console.log('[debug] df-messenger-loaded');
  const df = getDf();
  if (!df) return;

  // Apply parameters immediately so they are ready
  const params = await buildParams();
  df.setQueryParameters({ parameters: params });
});

window.addEventListener('df-chat-open-changed', (event) => {
  if (event.detail.isOpen && !welcomeSent) {
    const df = getDf();
    if (df) {
      df.sendRequest({
        queryInput: {
          event: { event: "sys.welcome-default" },
          languageCode: $('language').value || "en"
        }
      });
      console.log('[Init] Triggered sys.welcome-default on chat open');
      welcomeSent = true;
    }
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
    df.setQueryParameters({ parameters: params });

    console.log('[Apply] setQueryParameters:', params);
    return params;
  }

  $('applyBtn').addEventListener('click', async () => {
    await applyNow();
    alert('Applied! Parameters will be sent with your next message.');
  });

  $('newSessionBtn').addEventListener('click', async () => {
    const df = getDf();
    if (!df) return;

    // Reset welcome flag so it triggers again on next open
    welcomeSent = false;

    // 1. Start new session
    df.startNewSession();

    // 2. IMPORTANT: Re-apply parameters immediately
    await applyNow();

    alert('New session started & parameters re-applied!');
  });
});
