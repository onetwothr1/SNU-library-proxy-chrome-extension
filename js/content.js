// js/content.js

(function () {
    // 1) 현재 페이지 URL을 가져와 iframe src에 쿼리로 전달
    const pageUrl = encodeURIComponent(window.location.href);
  
    // 2) 이미 삽입된 iframe이 있으면 중복 삽입 방지
    if (document.getElementById('snu_proxy_frame')) return;
  
    // 3) iframe 생성 및 스타일 설정
    const iframe = document.createElement('iframe');
    iframe.id = 'snu_proxy_frame';
    iframe.src = chrome.runtime.getURL(`notification.html?${pageUrl}`);
    Object.assign(iframe.style, {
      position: 'fixed',
      bottom:   '10px',
      right:    '10px',
      width:    '320px',
      height:   '200px',
      border:   'none',
      zIndex:   '2147483647',
      boxShadow:'0 0 5px rgba(0,0,0,0.3)',
      borderRadius: '4px',
      background: '#fff'
    });
  
    // 4) 페이지에 추가
    document.body.appendChild(iframe);
  
    // 5) 백그라운드 또는 popup에서 오는 메시지 처리
    window.addEventListener('message', event => {
      // 웹페이지가 아닌 extension origin에서 온 메시지만 처리
      if (event.origin !== chrome.runtime.getURL('').slice(0, -1)) return;
  
      const { type, payload } = event.data || {};
      if (type === 'redirect') {
        // 백그라운드로 명령 전송
        chrome.runtime.sendMessage({ type: 'redirect', url: payload.url });
      }
      if (type === 'hide') {
        iframe.remove();
      }
    });
  })();