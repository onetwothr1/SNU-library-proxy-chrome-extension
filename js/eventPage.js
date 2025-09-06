// js/eventPage.js

// Returns user's public IP address
async function getIP() {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return data.ip;
  } catch (e) {
    console.error('Failed to get IP:', e);
    return '';
  }
}

// Determines if IP is on-campus
function checkIP(ip) {
  const campusPrefixes = ['147.46.', '147.47.', '58.102.125.', '58.102.133.'];
  const onCampus = campusPrefixes.some(p => ip.startsWith(p)) ? 'yes' : 'no';
  chrome.storage.local.set({ onCampus });
  return onCampus;
}

// 탭이 로드되거나 활성화될 때마다 도메인 지원 여부 체크
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkAndSetIcon(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        if (tab.url) checkAndSetIcon(tab.id, tab.url);
    });
});

async function checkAndSetIcon(tabId, url) {
    // If already accessed via proxy redirect domain, mark as connected
    if (url.includes('ssl.libproxy.snu.ac.kr')) {
        // Set toolbar icon to connected
        await chrome.action.setIcon({
            tabId,
            path: {
                '48': chrome.runtime.getURL('images/19-on.png'),
                '128': chrome.runtime.getURL('images/19-on.png')
            }
        });
        // Save tab state as connected
        chrome.storage.local.get('tabStates', result => {
            const tabStates = result.tabStates || {};
            tabStates[tabId] = {
                domainSupported: true,
                connected: true
            };
            chrome.storage.local.set({
                tabStates
            });
        });
        return;
    }

    // 1) 캠퍼스 내/외부 여부 확인
    const ip = await getIP();
    const onCampus = checkIP(ip);  // returns 'yes' or 'no'

    // 2) 도메인 지원 여부 계산
    let supported = false;
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, '');
      const resp = await fetch(chrome.runtime.getURL('urls.json'));
      const domains = await resp.json();
      supported = domains.some(entry => {
        const bare = entry.startsWith('*.') ? entry.slice(2) : entry;
        return domain === bare || domain.endsWith(`.${bare}`);
      });
    } catch (e) {
      console.error('Error computing supported:', e);
    }
    // 3) 툴바 아이콘 업데이트
    const iconFile = supported || onCampus === 'yes' ? '19-go.png' : '19.png';
    chrome.action.setIcon({
        tabId,
        path: {
            '48': chrome.runtime.getURL(`images/${iconFile}`),
            '128': chrome.runtime.getURL(`images/${iconFile}`)
        }
    });

    // 4) 탭별 상태 저장 (connected는 초기 false)
    chrome.storage.local.get('tabStates', result => {
        const tabStates = result.tabStates || {};
        tabStates[tabId] = {
            domainSupported: supported,
            connected: false,
            onCampus: onCampus
        };
        chrome.storage.local.set({
            tabStates
        });
    });
}

// 4) 탭 제거 시 상태 정리
chrome.tabs.onRemoved.addListener(tabId => {
    chrome.storage.local.get('tabStates', result => {
        const tabStates = result.tabStates || {};
        delete tabStates[tabId];
        chrome.storage.local.set({
            tabStates
        });
    });
});

// 5) 팝업에서 상태 요청용 메시지 핸들러 (원하는 경우)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'getTabState' && sender.tab) {
        chrome.storage.local.get('tabStates', result => {
            const st = (result.tabStates || {})[sender.tab.id] || {};
            sendResponse(st);
        });
        return true; // 비동기 응답
    }
});