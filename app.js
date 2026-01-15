const $ = (id) => document.getElementById(id);

function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

async function getBrowserInfo() {
  // Prefer UA-CH if available; fallback to userAgent only
  const ua = navigator.userAgent || "";
  let browserBrand = "";
  let browserVersion = "";
  let platform = navigator.platform || "";

  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const high = await navigator.userAgentData.getHighEntropyValues([
        "platform", "fullVersionList", "uaFullVersion"
      ]);
      const brands = high.fullVersionList || navigator.userAgentData.brands || [];
      const main = brands.find(b => !/Not.*Brand/i.test(b.brand)) || brands[0] || {};
      browserBrand = main.brand || "";
      browserVersion = high.uaFullVersion || main.version || "";
      platform = high.platform || platform;
      return { browserBrand, browserVersion, platform, userAgent: ua };
    } catch (e) {
      // ignore and fallback
    }
  }

  // Very light fallback parsing (optional)
  // Keep userAgent always, leave brand/version empty if unknown
  return { browserBrand, browserVersion, platform, userAgent: ua };
}

async function buildParams() {
  const base = {
    // required params
    language: $('language').value,

    // extra context params
    device: isMobile() ? "mobile" : "desktop",
    pageUrl: location.href,
    pagePath: location.pathname,
    pageTitle: document.title
  };

  // region: omit entirely if simulate is enabled
  if (!$('omitRegion').checked) {
    base.region = $('region').value;
  }

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

// Debug hooks (optional)
window.addEventListener('df-messenger-loaded', () => console.log('[debug] df-messenger-loaded'));
window.addEventListener('df-messenger-error', (e) => console.log('[debug] df-messenger-error:', e?.detail?.error || e));
window.addEventListener('df-request-sent', (e) => console.log('[debug] df-request-sent requestBody:', e?.detail?.data?.requestBody));

document.addEventListener('DOMContentLoaded', () => {
  renderOut();

  ['language', 'region', 'omitRegion'].forEach(id => {
    $(id).addEventListener('change', renderOut);
  });

  $('applyBtn').addEventListener('click', async () => {
    const df = getDf();
    if (!df) return;

    const params = await buildParams();
    df.setQueryParameters({ parameters: params });

    console.log('[Apply] setQueryParameters:', params);
    alert('Applied! Next message will include these parameters.');
  });

  $('newSessionBtn').addEventListener('click', () => {
    const df = getDf();
    if (!df) return;

    df.startNewSession();
    alert('New session started (history cleared).');
  });

  $('sendHelloBtn').addEventListener('click', () => {
    const df = getDf();
    if (!df) return;

    df.sendQuery('hello');
  });
});
