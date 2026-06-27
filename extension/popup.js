document.addEventListener('DOMContentLoaded', async () => {
  const remoteUrlInput = document.getElementById('remote-url-input');
  const saveUrlBtn = document.getElementById('save-url-btn');
  const statusBadge = document.getElementById('status-badge');
  const qrSection = document.getElementById('qr-section');
  const qrcodeContainer = document.getElementById('qrcode');
  const qrLoader = document.getElementById('qr-loader');
  const peerIdVal = document.getElementById('peer-id-val');
  const copyIdBtn = document.getElementById('copy-id-btn');
  const noYtSection = document.getElementById('no-yt-section');

  let activeTabId = null;
  let qrcodeInstance = null;

  // 1. ローカルストレージから保存されたURLを読み込む
  chrome.storage.local.get(['remoteUrl'], (result) => {
    if (result.remoteUrl) {
      remoteUrlInput.value = result.remoteUrl;
    }
  });

  // 2. 現在のタブがYouTubeの動画再生画面か確認する
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (activeTab && activeTab.url && activeTab.url.includes('youtube.com')) {
    activeTabId = activeTab.id;
    // Content Scriptと通信して接続情報を取得する
    getPeerInfoFromContentScript();
  } else {
    // YouTubeの画面でない場合、エラー画面を表示
    noYtSection.classList.remove('hidden');
    qrSection.classList.add('hidden');
    statusBadge.textContent = '対象外タブ';
    statusBadge.className = 'badge warning';
  }

  // Content Scriptから接続情報を取得する関数
  async function getPeerInfoFromContentScript() {
    if (!activeTabId) return;

    try {
      // Content Scriptからのレスポンスを非同期で待機（未準備の場合は例外が発生）
      const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_PEER_INFO' });
      
      if (!response) {
        throw new Error('No response from content script');
      }

      if (response.peerId) {
        peerIdVal.textContent = response.peerId;
        qrLoader.classList.add('hidden');
        qrSection.classList.remove('hidden');
        
        // 接続状態の更新
        if (response.isConnected) {
          statusBadge.textContent = '接続中';
          statusBadge.className = 'badge success';
        } else {
          statusBadge.textContent = '待機中';
          statusBadge.className = 'badge warning';
        }

        // QRコード生成
        generateQRCode(response.peerId);
      } else {
        // PeerID生成中の場合
        qrLoader.classList.remove('hidden');
        statusBadge.textContent = 'ID生成中';
        statusBadge.className = 'badge warning';
        setTimeout(getPeerInfoFromContentScript, 1000); // 1秒後に再試行
      }
    } catch (err) {
      // Content Scriptがまだ起動していない（ページ読み込み中など）のエラーを安全にキャッチして再試行
      console.log('YouTube Remote Controller: Content Script not ready, retrying...', err);
      statusBadge.textContent = '準備中...';
      statusBadge.className = 'badge warning';
      setTimeout(getPeerInfoFromContentScript, 1000); // 1秒後に再試行
    }
  }

  // QRコードの生成・更新
  function generateQRCode(peerId) {
    const remoteBaseUrl = remoteUrlInput.value.trim();
    if (!remoteBaseUrl) {
      qrcodeContainer.innerHTML = '<p style="color:#666;font-size:12px;padding:20px 0;">URLを入力して「保存」してください</p>';
      return;
    }

    // QRコードに渡す接続用フルURL
    // ベースURLの末尾のスラッシュを考慮して結合
    const separator = remoteBaseUrl.endsWith('/') ? '' : '/';
    const fullUrl = `${remoteBaseUrl}${separator}?peerId=${peerId}`;

    qrcodeContainer.innerHTML = '';
    
    // qrcode.jsを使ってQRコードを作成
    qrcodeInstance = new QRCode(qrcodeContainer, {
      text: fullUrl,
      width: 150,
      height: 150,
      colorDark : '#000000',
      colorLight : '#ffffff',
      correctLevel : QRCode.CorrectLevel.H
    });
  }

  // URLの保存ボタンの処理
  saveUrlBtn.addEventListener('click', () => {
    const remoteUrl = remoteUrlInput.value.trim();
    chrome.storage.local.set({ remoteUrl }, () => {
      // Content Scriptにも通知
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'UPDATE_REMOTE_URL', remoteUrl });
      }
      
      // Peer IDがすでに表示されていれば、QRコードを更新
      const peerId = peerIdVal.textContent;
      if (peerId && peerId !== '----') {
        generateQRCode(peerId);
      }
      
      // 保存した旨をボタンに一時的に表示
      const originalText = saveUrlBtn.textContent;
      saveUrlBtn.textContent = '保存完了';
      saveUrlBtn.style.backgroundColor = 'var(--success-color)';
      setTimeout(() => {
        saveUrlBtn.textContent = originalText;
        saveUrlBtn.style.backgroundColor = '';
      }, 1500);
    });
  });

  // IDのコピーボタンの処理
  copyIdBtn.addEventListener('click', () => {
    const peerId = peerIdVal.textContent;
    if (peerId && peerId !== '----') {
      navigator.clipboard.writeText(peerId).then(() => {
        // コピー成功時の演出
        const originalSvg = copyIdBtn.innerHTML;
        copyIdBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--success-color)">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;
        setTimeout(() => {
          copyIdBtn.innerHTML = originalSvg;
        }, 1500);
      });
    }
  });
});
