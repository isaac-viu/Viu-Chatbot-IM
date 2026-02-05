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
  let info = {
    browserBrand: "",
    browserVersion: "",
    deviceModel: "",
    osPlatform: "",
    osVersion: ""
  };

  // 1. Try Modern API (Client Hints) - Chrome, Edge, Android Webview
  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      const high = await navigator.userAgentData.getHighEntropyValues([
        "fullVersionList", "uaFullVersion", "model", "platform", "platformVersion"
      ]);
      const brands = high.fullVersionList || navigator.userAgentData.brands || [];

      // Prioritize specific brands over generic "Chromium"
      const specificBrand = brands.find(b =>
        /Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand)
      );
      const main = specificBrand || brands.find(b => !/Not.*Brand/i.test(b.brand)) || brands[0] || {};

      info.browserBrand = main.brand || "";
      info.browserVersion = high.uaFullVersion || main.version || "";
      info.deviceModel = high.model || "";      // e.g., "Pixel 6"
      info.osPlatform = high.platform || "";    // e.g., "Android"
      info.osVersion = high.platformVersion || "";
    } catch (e) {
      console.log('UA Data error', e);
    }
  }

  // 2. Fallback / Augment with User Agent string (Safari, Firefox, Old Android)
  // If Client Hints didn't provide the model/platform, try regex
  if (!info.deviceModel || !info.osPlatform || !info.osVersion) {
    const ua = navigator.userAgent;

    if (/iPhone/i.test(ua)) {
      info.deviceModel = "iPhone";
      info.osPlatform = "iOS";
      const match = ua.match(/OS (\d+[._]\d+)/);
      if (match) info.osVersion = match[1].replace(/_/g, '.');
    } else if (/iPad/i.test(ua)) {
      info.deviceModel = "iPad";
      info.osPlatform = "iOS";
      const match = ua.match(/OS (\d+[._]\d+)/);
      if (match) info.osVersion = match[1].replace(/_/g, '.');
    } else if (/Mac/i.test(ua)) {
      if (!info.deviceModel) info.deviceModel = "Mac"; // Client hints might say "MacIntel" or empty
      if (!info.osPlatform) info.osPlatform = "macOS";
    } else if (/Android/i.test(ua)) {
      if (!info.osPlatform) info.osPlatform = "Android";

      const vMatch = ua.match(/Android\s([0-9.]+)/);
      if (vMatch && !info.osVersion) info.osVersion = vMatch[1];

      // Try to find model in UA (standard format: "Android x.x; Model Name Build/...")
      const mMatch = ua.match(/Android\s[0-9.]+;\s([^;]+)\)/); // Simple capture
      if (mMatch && !info.deviceModel) {
        // Sometimes usually "SM-G998B" or "Pixel 6"
        info.deviceModel = mMatch[1].trim().split(' Build')[0];
      }
    } else if (/Windows/i.test(ua)) {
      if (!info.osPlatform) info.osPlatform = "Windows";
    }

    // 3. Fallback Browser Name detection (if Client Hints didn't work)
    if (!info.browserBrand) {
      if (/CriOS/i.test(ua)) { // Chrome on iOS
        info.browserBrand = "Chrome (iOS)";
        const match = ua.match(/CriOS\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/FxiOS/i.test(ua)) { // Firefox on iOS
        info.browserBrand = "Firefox (iOS)";
        const match = ua.match(/FxiOS\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
        info.browserBrand = "Chrome";
        const match = ua.match(/Chrome\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
        info.browserBrand = "Safari";
        const match = ua.match(/Version\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/Firefox/i.test(ua)) {
        info.browserBrand = "Firefox";
        const match = ua.match(/Firefox\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/Edg/i.test(ua) && !/Edge/i.test(ua)) { // Edge (Chromium)
        info.browserBrand = "Edge";
        const match = ua.match(/Edg\/(\d+)/);
        if (match) info.browserVersion = match[1];
      } else if (/Edge/i.test(ua)) { // Legacy Edge
        info.browserBrand = "Edge";
        const match = ua.match(/Edge\/(\d+)/);
        if (match) info.browserVersion = match[1];
      }
    }
  }

  return info;
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
  incrementMessageCount(); // Count the message!
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

// --- Stats Logic ---
function updateStatsDisplay() {
  $('sessionCountDisplay').textContent = localStorage.getItem('sessionCount') || 0;
  $('messageCountDisplay').textContent = sessionStorage.getItem('messageCount') || 0;
}

function incrementMessageCount() {
  let count = parseInt(sessionStorage.getItem('messageCount') || 0) + 1;
  sessionStorage.setItem('messageCount', count);
  updateStatsDisplay();
}

function incrementSessionCount() {
  let count = parseInt(localStorage.getItem('sessionCount') || 0) + 1;
  localStorage.setItem('sessionCount', count);
  updateStatsDisplay();
}
// -------------------

// --- UI Injection Logic ---
function injectCustomUI() {
  try {
    const df = $('df-messenger');
    if (!df) return false;

    // Retry chain to find the chat window in Shadow DOM
    const bubble = df.shadowRoot?.querySelector('df-messenger-chat-bubble');
    const chatWindow = bubble?.shadowRoot?.querySelector('df-messenger-chat-window')
      || df.shadowRoot?.querySelector('df-messenger-chat-window');

    if (!chatWindow) {
      console.log('[UI] Chat Window not found yet...');
      return false;
    }

    // 1. Inject Header Elements (Logo + Subtitle)
    const header = chatWindow.shadowRoot?.querySelector('.chat-wrapper > .chat-header') || chatWindow.shadowRoot?.querySelector('.header');

    if (header) {
      // 0. Inject Logo
      if (!header.querySelector('.custom-logo')) {
        const logo = document.createElement('img');
        logo.className = 'custom-logo';
        logo.src = 'https://viu.com/favicon.ico';
        logo.style.height = '24px';
        logo.style.width = '24px';
        logo.style.marginRight = '12px';
        header.insertBefore(logo, header.firstChild);
        console.log('[UI] Logo injected');
      }

      // 1. Inject Subtitle
      if (!header.querySelector('.custom-subtitle')) {
        const subtitle = document.createElement('div');
        subtitle.className = 'custom-subtitle';
        subtitle.textContent = 'Powered by Generative AI';
        subtitle.style.fontSize = '10px';
        subtitle.style.opacity = '0.7';
        subtitle.style.marginTop = '2px';
        subtitle.style.fontWeight = '400';
        subtitle.style.flexBasis = '100%';
        subtitle.style.paddingLeft = '36px';
        header.appendChild(subtitle);
        console.log('[UI] Subtitle injected');
      }
    } else {
      console.log('[UI] Header not found in chat window');
    }

    // 2. Force Timestamps & Layout
    if (!chatWindow.shadowRoot.querySelector('#custom-styles')) {
      const style = document.createElement('style');
      style.id = 'custom-styles';
      style.textContent = `
        .message-list .message .time { display: block !important; opacity: 0.7; font-size: 10px; margin-top: 4px; }
        .chat-wrapper > .chat-header { 
           display: flex !important;
           flex-flow: row wrap !important; 
           align-items: center !important; 
           justify-content: flex-start !important;
           padding: 16px !important;
           min-height: 60px;
        }
        /* Hide default icon inside header if it interferes */
        .chat-wrapper > .chat-header > .icon { display: none; }
      `;
      chatWindow.shadowRoot.appendChild(style);
      console.log('[UI] Custom styles injected');
    }

    return true; // Success

  } catch (e) {
    console.log('[UI] Injection failed:', e);
    return false;
  }
}

// Polling helper
function startInjectionPoller() {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const success = injectCustomUI();
    if (success || attempts > 20) { // Try for 10 seconds (20 * 500ms)
      clearInterval(interval);
      if (!success) console.log('[UI] Giving up on injection after 20 attempts');
    }
  }, 500);
}
// --------------------------

window.addEventListener('df-messenger-loaded', async () => {
  console.log('[debug] df-messenger-loaded');

  // Track Session Count (Lifetime)
  if (!sessionStorage.getItem('sessionInitialized')) {
    incrementSessionCount();
    sessionStorage.setItem('sessionInitialized', 'true');
    sessionStorage.setItem('messageCount', 0); // Reset messages on new session
  }
  updateStatsDisplay();

  const df = getDf();
  if (df) {
    // Fix: Use new JS API for GCS Uploads (replaces deprecated gcs-upload attribute)
    if (globalThis.dfInstallUtil) {
      globalThis.dfInstallUtil('gcs-bucket-upload', { bucketName: 'viu-pmo-poc-chat-uploads' });
      console.log('[Init] GCS Upload Utility installed');
    }

    const params = await buildParams();
    df.setQueryParameters({ parameters: params });
    console.log('[Init] Early parameters set on load');

    // Start polling for UI elements
    startInjectionPoller();
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
      // df.sendRequest('event', "WELCOME_EVENT");

      // Switch to "Hi" query for more reliable greeting
      df.sendRequest('query', "Hi");

      welcomeSent = true;
      console.log('[UI] "Hi" query sent on open');

      // Re-run injection in case of re-render
      startInjectionPoller();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Auto-detect device on load to set default
  if (isMobile()) {
    $('deviceType').value = 'mobileWeb';
  } else {
    $('deviceType').value = 'pcWeb';
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
    // const gcsUpload = oldDf.getAttribute('gcs-upload'); // Deprecated
    const chatTitle = $('df-messenger-chat-bubble')?.getAttribute('chat-title') || "Viu Services Bot"; // Fallback if bubble missing

    console.log('[UI] Performing Hard Reset (Re-mounting component)...');

    // 2. Clear session (attempt)
    try { oldDf.startNewSession(); } catch (e) { }

    // 3. Wipe Memory (Fix for "Ghost Sessions")
    // This prevents the new bot from finding old session IDs in storage
    sessionStorage.clear();
    // Don't clear localStorage (we want to keep Lifetime Session Count)
    // localStorage.clear();

    // Reset message count for the new session
    sessionStorage.setItem('messageCount', 0);
    sessionStorage.setItem('sessionInitialized', 'true'); // Mark as active
    incrementSessionCount(); // Use our helper to increment lifetime count

    // 4. Remove old component
    oldDf.remove();
    welcomeSent = false;

    // 5. Re-create component after short delay
    setTimeout(() => {
      const newDf = document.createElement('df-messenger');
      newDf.setAttribute('project-id', projectId);
      newDf.setAttribute('agent-id', agentId);
      newDf.setAttribute('language-code', langCode);
      newDf.setAttribute('max-query-length', '256');
      // if (gcsUpload) newDf.setAttribute('gcs-upload', gcsUpload); // Deprecated - handled by dfInstallUtil on load

      // FORCE NEW SESSION ID to prevent ghost sessions
      const newSessionId = `reset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      newDf.setAttribute('session-id', newSessionId);

      // Re-create the bubble inside
      const bubble = document.createElement('df-messenger-chat-bubble');
      bubble.setAttribute('chat-title', chatTitle);
      bubble.setAttribute('anchor', 'top-left');
      bubble.setAttribute('allow-fullscreen', 'small');

      // Enable features on new bubble
      bubble.setAttribute('enable-file-upload', '');
      bubble.setAttribute('enable-audio-input', '');

      newDf.appendChild(bubble);
      document.body.appendChild(newDf);

      showToast('New session started (Hard Reset)');
      console.log('[UI] Component re-mounted.');
    }, 50);
  });
});