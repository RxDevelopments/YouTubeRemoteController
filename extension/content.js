(function() {
  console.log("YouTube Remote Controller: Loaded");

  let peer = null;
  let peerId = null;
  let conn = null; // スマホとの接続オブジェクト
  let remoteUrl = "";

  // 1. ローカルストレージから設定をロード
  chrome.storage.local.get(['remoteUrl'], (result) => {
    if (result.remoteUrl) {
      remoteUrl = result.remoteUrl;
    }
  });

  // 2. PeerJSの初期化とホストサーバー接続
  function initPeer() {
    // ページ遷移やリロードでIDが変わらないよう、ストレージに固定のPeerIDを保存・再利用する
    chrome.storage.local.get(['myPeerId'], (result) => {
      let myId = result.myPeerId;
      if (!myId) {
        // なければ新規に生成して保存
        myId = 'yt-remote-' + Math.random().toString(36).substring(2, 8);
        chrome.storage.local.set({ myPeerId: myId });
      }
      peerId = myId;

      // PeerJS インスタンス作成 (STUNに加え、異なるネットワーク間でも100%接続を中継する無料のパブリックTURNサーバーを設定)
      peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
              ],
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });

      peer.on('open', (id) => {
        console.log('YouTube Remote Controller: Peer ID registered -', peerId);
      });

      peer.on('connection', (connection) => {
        console.log('YouTube Remote Controller: Smartphone connected!');
        
        // 既存の接続があれば閉じる
        if (conn) {
          conn.close();
        }
        
        conn = connection;
        setupConnectionHandlers();
      });

      peer.on('error', (err) => {
        console.error('YouTube Remote Controller: PeerJS Error', err);
        if (err.type === 'unavailable-id') {
          // IDが衝突している（別のタブで同じIDのピアがすでに起動しているなど）場合、少し待って再接続
          setTimeout(initPeer, 5000);
        }
      });

      peer.on('disconnected', () => {
        console.log('YouTube Remote Controller: PeerJS disconnected, reconnecting...');
        peer.reconnect();
      });
    });
  }

  // 3. スマホとの通信イベントハンドラ
  function setupConnectionHandlers() {
    conn.on('data', (data) => {
      // スマホからの操作コマンド受信
      console.log('YouTube Remote Controller: Command received', data);
      handleRemoteCommand(data);
    });

    conn.on('close', () => {
      console.log('YouTube Remote Controller: Smartphone disconnected');
      conn = null;
    });

    conn.on('error', (err) => {
      console.error('YouTube Remote Controller: Connection error', err);
      conn = null;
    });

    // 接続時に即座に現在のYouTubeの状態を送る
    setTimeout(sendCurrentState, 500);
  }

  // 4. YouTubeの動画プレイヤーと状態の取得
  function getVideoElement() {
    // YouTubeの動画再生要素。広告動画ではないメイン動画を優先的に探す
    const video = document.querySelector('ytd-player video') || document.querySelector('video');
    return video;
  }

  function getMovieTitle() {
    let title = document.title;
    if (title.endsWith(' - YouTube')) {
      title = title.substring(0, title.length - 10);
    }
    return title;
  }

  // 5. スマホに現在のYouTube状態を送信（同期用）
  function sendCurrentState() {
    if (!conn || conn.open === false) return;

    const video = getVideoElement();
    // 動画要素が存在し、再生可能な状態（ソースが設定されている）か確認
    const hasVideo = !!(video && video.src && !isNaN(video.duration) && window.location.pathname === '/watch');

    // 動画IDとチャンネル名の抽出
    let videoId = '';
    let channelName = 'YouTube Player';
    if (hasVideo) {
      const urlParams = new URLSearchParams(window.location.search);
      videoId = urlParams.get('v') || '';
      
      // チャンネル名要素をページから探す
      const channelElement = document.querySelector('ytd-watch-metadata #channel-name a') || 
                             document.querySelector('.ytp-title-channel-name') ||
                             document.querySelector('#owner-name a') ||
                             document.querySelector('ytd-video-owner-renderer #channel-name a');
      if (channelElement) {
        channelName = channelElement.textContent.trim();
      }
    }

    const state = {
      title: hasVideo ? getMovieTitle() : '動画が再生されていません',
      duration: hasVideo ? (video.duration || 0) : 0,
      currentTime: hasVideo ? (video.currentTime || 0) : 0,
      paused: hasVideo ? video.paused : true,
      volume: hasVideo ? video.volume : 1.0,
      muted: hasVideo ? video.muted : false,
      playbackRate: hasVideo ? video.playbackRate : 1.0,
      hasVideo: hasVideo,
      videoId: videoId,
      channelName: channelName
    };

    conn.send({
      type: 'STATE_UPDATE',
      state: state
    });
  }

  // 6. YouTube検索処理（APIキー不要、HTMLからJSONデータをパース）
  async function searchYouTube(query) {
    if (!query) return;
    
    console.log('YouTube Remote Controller: Searching YouTube for:', query);
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);
      const html = await response.text();
      
      // HTMLから ytInitialData = { ... }; のJSON文字列部分を抽出する
      const match = html.match(/ytInitialData\s*=\s*({.+?});/);
      if (!match) {
        throw new Error('検索データの解析に失敗しました(ytInitialDataが見つかりません)');
      }
      
      const data = JSON.parse(match[1]);
      const results = [];
      
      // JSONから動画情報を抽出する
      const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      
      if (contents && Array.isArray(contents)) {
        for (const section of contents) {
          const itemSection = section.itemSectionRenderer;
          if (itemSection && Array.isArray(itemSection.contents)) {
            for (const item of itemSection.contents) {
              const video = item.videoRenderer;
              if (video && video.videoId) {
                const videoId = video.videoId;
                const title = video.title?.runs?.[0]?.text || video.title?.simpleText || '不明なタイトル';
                // サムネイル画像（解像度が高いものを優先、なければ最初のもの）
                const thumbnails = video.thumbnail?.thumbnails;
                const thumbnail = thumbnails ? thumbnails[thumbnails.length - 1].url : '';
                const lengthText = video.lengthText?.simpleText || video.lengthText?.runs?.[0]?.text || '0:00';
                const channelName = video.ownerText?.runs?.[0]?.text || '不明なチャンネル';
                
                results.push({
                  videoId,
                  title,
                  thumbnail,
                  lengthText,
                  channelName
                });
                
                // 最大15件
                if (results.length >= 15) break;
              }
            }
          }
          if (results.length >= 15) break;
        }
      }
      
      console.log(`YouTube Remote Controller: Found ${results.length} videos`);
      
      // スマホへ検索結果を送信
      if (conn && conn.open) {
        conn.send({
          type: 'SEARCH_RESULTS',
          results: results
        });
      }
    } catch (error) {
      console.error('YouTube Remote Controller: Search error', error);
      if (conn && conn.open) {
        conn.send({
          type: 'SEARCH_ERROR',
          message: error.message
        });
      }
    }
  }

  // 7. スマホからのコマンドを実行
  function handleRemoteCommand(message) {
    const video = getVideoElement();

    // どの画面にいても処理できるコマンド
    if (message.action === 'search') {
      searchYouTube(message.value);
      return;
    } else if (message.action === 'playVideo') {
      const videoId = message.value;
      if (videoId) {
        console.log('YouTube Remote Controller: Casting video ID -', videoId);
        // 新しい動画ページへ遷移（SPA遷移だと崩れる可能性があるため、確実なlocation書き換え）
        window.location.href = `/watch?v=${videoId}`;
      }
      return;
    }

    // 動画再生中のみ有効なコマンド
    if (!video) return;

    switch (message.action) {
      case 'play':
        video.play();
        break;
      case 'pause':
        video.pause();
        break;
      case 'seek':
        if (typeof message.value === 'number') {
          video.currentTime = message.value;
        }
        break;
      case 'volume':
        if (typeof message.value === 'number') {
          video.volume = Math.max(0, Math.min(1, message.value));
          if (video.volume > 0) video.muted = false;
        }
        break;
      case 'mute':
        video.muted = !!message.value;
        break;
      case 'setSpeed':
        if (typeof message.value === 'number') {
          video.playbackRate = message.value;
        }
        break;
      case 'next':
        const nextBtn = document.querySelector('.ytp-next-button');
        if (nextBtn) nextBtn.click();
        break;
      case 'prev':
        const prevBtn = document.querySelector('.ytp-prev-button');
        if (prevBtn && prevBtn.getAttribute('aria-disabled') !== 'true') {
          prevBtn.click();
        } else {
          window.history.back();
        }
        break;
      case 'skipForward':
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'skipBackward':
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      default:
        console.warn('YouTube Remote Controller: Unknown action', message.action);
    }

    // 操作後は即座に同期
    setTimeout(sendCurrentState, 100);
  }

  // 8. 定期的な状態の同期（再生時間などを1秒ごとにスマホに伝える）
  setInterval(() => {
    if (conn && conn.open) {
      sendCurrentState();
    }
  }, 1000);

  // YouTube上のビデオ要素のイベントハンドラを監視してリアルタイム同期
  document.addEventListener('play', (e) => { if (e.target.tagName === 'VIDEO') sendCurrentState(); }, true);
  document.addEventListener('pause', (e) => { if (e.target.tagName === 'VIDEO') sendCurrentState(); }, true);
  document.addEventListener('volumechange', (e) => { if (e.target.tagName === 'VIDEO') sendCurrentState(); }, true);
  // 動画の終了イベントをキャプチャしてスマホに通知
  document.addEventListener('ended', (e) => {
    if (e.target.tagName === 'VIDEO') {
      console.log('YouTube Remote Controller: Video ended');
      if (conn && conn.open) {
        conn.send({
          type: 'VIDEO_ENDED'
        });
      }
    }
  }, true);
  // YouTubeのSPAページ遷移（リロードなしの動画切り替え）を検知して即座にスマホと同期
  document.addEventListener('yt-navigate-finish', sendCurrentState);

  // 9. ポップアップ（popup.js）からの問い合わせ対応
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PEER_INFO') {
      sendResponse({
        peerId: peerId,
        isConnected: !!(conn && conn.open),
        remoteUrl: remoteUrl
      });
    } else if (message.type === 'UPDATE_REMOTE_URL') {
      remoteUrl = message.remoteUrl;
      sendResponse({ success: true });
    }
    return true;
  });

  // 初期化開始
  initPeer();

})();
