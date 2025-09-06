// js/popup.js

// Fetch public IP
async function getIP() {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    return (await resp.json()).ip;
  } catch {
    return '';
  }
}

// Determine if IP is on-campus
function checkIP(ip) {
  const campusPrefixes = ['147.46.', '147.47.', '58.102.125.', '58.102.133.'];
  return campusPrefixes.some(prefix => ip.startsWith(prefix)) ? 'yes' : 'no';
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const btn      = document.getElementById('connectBtn');

  // 1) Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    statusEl.textContent = '탭 URL을 가져올 수 없습니다.';
    btn.disabled = true;
    return;
  }

  // 2) Check campus status
  const ip       = await getIP();
  const onCampus = checkIP(ip) === 'yes';

  // 3) Check domain support
  const urlObj = new URL(tab.url);
  const domain = urlObj.hostname.replace(/^www\./, '');
  let domains;
  try {
    domains = await (await fetch(chrome.runtime.getURL('urls.json'))).json();
  } catch {
    statusEl.textContent = '도메인 목록 로드 실패';
    btn.disabled = true;
    return;
  }
  const isSupported = domains.some(entry => {
    const bare = entry.startsWith('*.') ? entry.slice(2) : entry;
    return domain === bare || domain.endsWith(`.${bare}`);
  });

  // 4) Get connection state for this tab
  const { tabStates = {} } = await chrome.storage.local.get('tabStates');
  const { connected = false } = tabStates[tab.id] || {};

  // 5) Update UI
  if (connected) {
    statusEl.textContent = '현재 서울대학교 학외접속 서비스를 통하여 접속하였습니다.';
    btn.textContent      = '연결 완료';
    btn.disabled         = true;
  } else if (onCampus && isSupported) {
    statusEl.textContent = '학내IP로 접근하여 학외접속 없이 서비스 이용이 가능합니다.';
    btn.textContent      = '학외접속 불필요';
    btn.disabled         = true;
  } else if (isSupported) {
    statusEl.textContent = '현재 접속사이트는 서울대학교 학외접속을 지원합니다.';
    btn.textContent      = '학외접속 연결';
    btn.disabled         = false;
  } else {
    statusEl.textContent = '현재 접속사이트는 서울대학교 학외접속 지원 대상이 아닙니다.';
    btn.textContent      = '지원 안 함';
    btn.disabled         = true;
    return;
  }

  // 6) Button click handler
  btn.addEventListener('click', async () => {
    // Change toolbar icon to connected
    await chrome.action.setIcon({
      tabId: tab.id,
      path: {
        '48': chrome.runtime.getURL('images/19-on.png'),
        '128': chrome.runtime.getURL('images/19-on.png')
      }
    });

    // Save connected=true for this tab
    const newStates = { ...tabStates, [tab.id]: { domainSupported: isSupported, connected: true } };
    await chrome.storage.local.set({ tabStates: newStates });

    // Update UI message
    statusEl.textContent = '현재 서울대학교 학외접속 서비스를 통하여 접속하였습니다.';
    btn.textContent      = '연결 완료';
    btn.disabled         = true;

    // Perform redirect
    const proxyBase = 'https://libproxy.snu.ac.kr/link.n2s?url=';
    const targetUrl = proxyBase + encodeURIComponent(tab.url);
    await chrome.tabs.update(tab.id, { url: targetUrl });
  });
});