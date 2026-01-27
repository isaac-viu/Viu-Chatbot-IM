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

function hideLastUserMessage() {
  setTimeout(() => {
    try {
      const df = $('df-messenger');
      const chat = df.shadowRoot?.querySelector('df-messenger-chat-bubble')?.shadowRoot?.querySelector('df-messenger-chat-window') || df.shadowRoot?.querySelector('df-messenger-chat-window');
      const msgList = chat?.shadowRoot?.querySelector('df-message-list');
      const messages = msgList?.shadowRoot?.querySelectorAll('.message-list .message');

      if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          lastMsg.style.display = 'none';
          console.log('[UI] Hidden last user message');
        }
      }
    } catch (e) {
      console.log('[UI] Could not hide message:', e);
    }
  }, 100);
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

function updateLanguage() {
  const lang = $('language').value;
  const df = getDf();
  if (df) {
    df.setAttribute('language-code', lang);
    console.log('[UI] Language updated to:', lang);
  }
}

async function buildParams() {
  const base = {
    // required params
    language: $('language').value,

    // user info
    userId: $('userId').value,
    email: $('email').value,
    userTier: $('userTier').value,
    isDebugMode: $('debugMode').checked,

    // extra context params
    device: $('deviceType').value,
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

// Trigger Welcome only when chat is opened
window.addEventListener('df-chat-open-changed', async (e) => {
  console.log('[debug] df-chat-open-changed', e.detail);
  if (e.detail.isOpen && !welcomeSent) {
    const df = getDf();
    if (df) {
      // 1. Force language update to ensure correct locale
      updateLanguage();

      // 2. Set parameters first so they are attached to the session
      const params = await buildParams();
      df.setQueryParameters({ parameters: params });
      console.log('[UI] Parameters set on chat open');

      // 3. Check if user wants to skip welcome
      if ($('skipWelcome').checked) {
        console.log('[UI] Skipping WELCOME_EVENT (Checkbox is checked)');
        welcomeSent = true;
        return;
      }

      // 4. Send event by name (String) if not skipped
      df.sendRequest('event', "WELCOME_EVENT");

      welcomeSent = true;
      console.log('[UI] WELCOME_EVENT sent on open');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Auto-detect device on load to set default
  if (isMobile()) {
    if (/iPhone|iPad/i.test(navigator.userAgent)) {
      $('deviceType').value = 'ios_app';
    } else if (/Android/i.test(navigator.userAgent)) {
      $('deviceType').value = 'android_app';
    }
  }

  renderOut();
  updateLanguage();

  ['language', 'deviceType', 'region', 'omitRegion', 'userId', 'email', 'userTier', 'debugMode'].forEach(id => {
    $(id).addEventListener('change', () => {
      renderOut();
      if (id === 'language') updateLanguage();
    });
    if (id === 'userId' || id === 'email') {
      $(id).addEventListener('input', renderOut);
    }
  });

  $('newSessionBtn').addEventListener('click', () => {
    const oldDf = getDf();
    if (!oldDf) return;

    // 1. Capture attributes to restore later
    const projectId = oldDf.getAttribute('project-id');
    const agentId = oldDf.getAttribute('agent-id');
    const langCode = oldDf.getAttribute('language-code');
    const chatTitle = $('df-messenger-chat-bubble')?.getAttribute('chat-title') || "Demo Bot"; // Fallback if bubble missing

    console.log('[UI] Performing Hard Reset (Re-mounting component)...');

    // 2. Clear session (attempt)
    try { oldDf.startNewSession(); } catch (e) { }

    // 3. Remove old component
    oldDf.remove();
    welcomeSent = false; // Reset logic flag

    // 4. Re-create component after short delay
    setTimeout(() => {
      const newDf = document.createElement('df-messenger');
      newDf.setAttribute('project-id', projectId);
      newDf.setAttribute('agent-id', agentId);
      newDf.setAttribute('language-code', langCode);
      newDf.setAttribute('max-query-length', '256');

      // Re-create the bubble inside
      const bubble = document.createElement('df-messenger-chat-bubble');
      bubble.setAttribute('chat-title', chatTitle);
      bubble.setAttribute('anchor', 'top-left');
      bubble.setAttribute('allow-fullscreen', 'small');

      newDf.appendChild(bubble);
      document.body.appendChild(newDf);

      showToast('New session started (Hard Reset)');
      console.log('[UI] Component re-mounted.');
    }, 100);
  });
});
