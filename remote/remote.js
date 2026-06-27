document.addEventListener('DOMContentLoaded', () => {
  // タブ関連
  const tabRemoteBtn = document.getElementById('tab-remote-btn');
  const tabSearchBtn = document.getElementById('tab-search-btn');
  const tabQueueBtn = document.getElementById('tab-queue-btn');
  const remoteTabContent = document.getElementById('remote-tab-content');
  const searchTabContent = document.getElementById('search-tab-content');
  const queueTabContent = document.getElementById('queue-tab-content');

  // リモコン関連
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const videoTitle = document.getElementById('video-title');
  const channelNameLabel = document.getElementById('channel-name');
  const albumArtPlaceholder = document.getElementById('album-art-placeholder');
  const albumArtImg = document.getElementById('album-art-img');
  
  const currentTimeLabel = document.getElementById('current-time');
  const totalTimeLabel = document.getElementById('total-time');
  const seekSlider = document.getElementById('seek-slider');
  const sliderProgress = document.getElementById('slider-progress');
  
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const rewindBtn = document.getElementById('rewind-btn');
  const forwardBtn = document.getElementById('forward-btn');
  
  const muteBtn = document.getElementById('mute-btn');
  const volumeIcon = document.getElementById('volume-icon');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeProgress = document.getElementById('volume-progress');
  const speedSelect = document.getElementById('speed-select');
  const peerIdDisplay = document.getElementById('peer-id-display');

  // 検索関連
  const searchInput = document.getElementById('search-input');
  const searchSubmitBtn = document.getElementById('search-submit-btn');
  const searchResultsList = document.getElementById('search-results-list');
  const searchPlaceholder = document.getElementById('search-placeholder');
  const searchLoader = document.getElementById('search-loader');

  // キュー関連
  const queueListContainer = document.getElementById('queue-list-container');
  const queuePlaceholder = document.getElementById('queue-placeholder');
  const clearQueueBtn = document.getElementById('clear-queue-btn');

  // URLからPCのPeer IDを取得
  const urlParams = new URLSearchParams(window.location.search);
  const targetPeerId = urlParams.get('peerId');

  let peer = null;
  let conn = null;
  let queue = []; // 再生キューデータ
  let currentVideoState = {
    paused: true,
    duration: 0,
    currentTime: 0,
    volume: 1.0,
    muted: false,
    hasVideo: false,
    playbackRate: 1.0
  };
  
  let isUserSeeking = false;
  let isUserVolumeChange = false;

  // === 再生キューデータ管理 ===
  function loadQueue() {
    const savedQueue = localStorage.getItem('ytRemoteQueue');
    if (savedQueue) {
      try {
        queue = JSON.parse(savedQueue);
      } catch (e) {
        queue = [];
      }
    }
    renderQueueList();
  }

  function saveQueue() {
    localStorage.setItem('ytRemoteQueue', JSON.stringify(queue));
    renderQueueList();
  }

  function addToQueue(video) {
    // すでにキューに入っているか確認（重複防止）
    const exists = queue.some(item => item.videoId === video.videoId);
    if (exists) {
      // 一時的にフィードバックを出すなどの拡張が可能
      alert('この動画はすでにキューに登録されています。');
      return;
    }

    queue.push(video);
    saveQueue();

    // キュー追加時のフィードバック演出（簡易版）
    const originalText = statusText.textContent;
    setStatus('success', 'キューに追加しました');
    setTimeout(() => {
      if (conn && conn.open) {
        setStatus('success', 'PCと接続完了');
      } else {
        setStatus('error', 'PCから切断されました');
      }
    }, 1500);

    // PCで動画が再生されていない場合、キューの最初の動画を即座に自動再生
    if (!currentVideoState.hasVideo && queue.length === 1) {
      playNextInQueue();
    }
  }

  function removeFromQueue(index) {
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      saveQueue();
    }
  }

  function clearQueue() {
    queue = [];
    saveQueue();
  }

  // キューリストのUI描画
  function renderQueueList() {
    // 既存のアイテムを削除
    const cards = queueListContainer.querySelectorAll('.video-card');
    cards.forEach(card => card.remove());

    if (queue.length === 0) {
      queuePlaceholder.classList.remove('hidden');
      return;
    }

    queuePlaceholder.classList.add('hidden');

    queue.forEach((video, index) => {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <div class="video-card-clickable">
          <div class="card-thumbnail-container">
            <img src="${video.thumbnail || ''}" alt="Thumbnail" loading="lazy">
            <span class="card-duration">${video.lengthText}</span>
          </div>
          <div class="card-info">
            <h3 class="card-title">${video.title}</h3>
            <span class="card-channel">${video.channelName}</span>
          </div>
        </div>
        <button class="remove-queue-btn" title="キューから削除">
          <span class="material-icons-round">delete</span>
        </button>
      `;

      // タップしたら即時再生し、キューから削除
      const clickArea = card.querySelector('.video-card-clickable');
      clickArea.addEventListener('click', () => {
        sendCommand('playVideo', video.videoId);
        removeFromQueue(index);
        switchTab('remote');
      });

      // 削除ボタンタップ
      const removeBtn = card.querySelector('.remove-queue-btn');
      removeBtn.addEventListener('click', () => {
        removeFromQueue(index);
      });

      queueListContainer.appendChild(card);
    });
  }

  // キューの次の動画を再生する
  function playNextInQueue() {
    if (queue.length > 0) {
      const nextVideo = queue[0];
      sendCommand('playVideo', nextVideo.videoId);
      
      // キューの先頭を削除
      removeFromQueue(0);

      // キャスト中の仮表示
      videoTitle.textContent = 'PCに動画をキャスト中...';
      channelNameLabel.textContent = nextVideo.title;
      albumArtPlaceholder.classList.add('hidden');
      albumArtImg.src = nextVideo.thumbnail;
      albumArtImg.classList.remove('hidden');
    }
  }

  clearQueueBtn.addEventListener('click', clearQueue);

  // === タブ切り替え制御 ===
  function switchTab(tabName) {
    tabRemoteBtn.classList.remove('active');
    tabSearchBtn.classList.remove('active');
    tabQueueBtn.classList.remove('active');
    remoteTabContent.classList.add('hidden');
    searchTabContent.classList.add('hidden');
    queueTabContent.classList.add('hidden');

    if (tabName === 'remote') {
      tabRemoteBtn.classList.add('active');
      remoteTabContent.classList.remove('hidden');
    } else if (tabName === 'search') {
      tabSearchBtn.classList.add('active');
      searchTabContent.classList.remove('hidden');
    } else if (tabName === 'queue') {
      tabQueueBtn.classList.add('active');
      queueTabContent.classList.remove('hidden');
      renderQueueList();
    }
  }

  tabRemoteBtn.addEventListener('click', () => switchTab('remote'));
  tabSearchBtn.addEventListener('click', () => switchTab('search'));
  tabQueueBtn.addEventListener('click', () => switchTab('queue'));

  // Status表示の更新
  function setStatus(status, text) {
    statusDot.className = 'status-dot ' + status;
    statusText.textContent = text;
  }

  // 時間のフォーマット
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // 1. Peer IDが無い場合の案内ページ表示
  if (!targetPeerId) {
    document.getElementById('remote-app-container').classList.add('hidden');
    document.getElementById('pairing-guide-container').classList.remove('hidden');
    return;
  } else {
    document.getElementById('remote-app-container').classList.remove('hidden');
    document.getElementById('pairing-guide-container').classList.add('hidden');
  }

  // 2. PeerJSの初期化
  function initPeer() {
    setStatus('warning', '接続用IDを作成中...');
    peer = new Peer({
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

    peer.on('open', (myId) => {
      peerIdDisplay.textContent = `My ID: ${myId}`;
      connectToPC();
    });

    peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      setStatus('error', '通信エラーが発生しました');
    });
  }

  // 3. PCへのWebRTC接続
  function connectToPC() {
    setStatus('warning', 'PCに接続しています...');
    conn = peer.connect(targetPeerId, {
      reliable: true
    });

    conn.on('open', () => {
      setStatus('success', 'PCと接続完了');
      console.log('Connected to PC:', targetPeerId);
    });

    conn.on('data', (data) => {
      if (!data) return;
      
      if (data.type === 'STATE_UPDATE') {
        updateUI(data.state);
      } else if (data.type === 'SEARCH_RESULTS') {
        renderSearchResults(data.results);
      } else if (data.type === 'SEARCH_ERROR') {
        renderSearchError(data.message);
      } else if (data.type === 'VIDEO_ENDED') {
        // 動画終了時にキューの次の動画を自動キャスト
        console.log('Video ended notice from PC. Playing next in queue...');
        playNextInQueue();
      }
    });

    conn.on('close', () => {
      setStatus('error', 'PCから切断されました');
      videoTitle.textContent = 'PCのYouTube画面が閉じられたか、接続が切れました。';
      setTimeout(connectToPC, 3000);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setStatus('error', '接続エラー。再試行中...');
      setTimeout(connectToPC, 3000);
    });
  }

  // 4. 受信した状態データをUIに反映する
  function updateUI(state) {
    currentVideoState = state;

    // タイトルと投稿者名
    videoTitle.textContent = state.title;
    channelNameLabel.textContent = state.hasVideo && state.channelName ? state.channelName : 'YouTube Player';

    // サムネイルの表示
    if (state.hasVideo && state.videoId) {
      albumArtPlaceholder.classList.add('hidden');
      albumArtImg.src = `https://i.ytimg.com/vi/${state.videoId}/mqdefault.jpg`;
      albumArtImg.classList.remove('hidden');
    } else {
      albumArtPlaceholder.classList.remove('hidden');
      albumArtImg.classList.add('hidden');
      albumArtImg.src = '';
    }

    // 再生速度の同期表示
    if (state.playbackRate) {
      speedSelect.value = state.playbackRate.toString();
    }

    // 再生・一時停止ボタン
    if (state.paused) {
      playIcon.textContent = 'play_arrow';
    } else {
      playIcon.textContent = 'pause';
    }

    // シークバー
    if (!isUserSeeking) {
      currentTimeLabel.textContent = formatTime(state.currentTime);
      totalTimeLabel.textContent = formatTime(state.duration);
      
      if (state.duration > 0) {
        const percentage = (state.currentTime / state.duration) * 100;
        seekSlider.value = percentage;
        sliderProgress.style.width = percentage + '%';
      } else {
        seekSlider.value = 0;
        sliderProgress.style.width = '0%';
      }
    }

    // 音量バー
    if (!isUserVolumeChange) {
      const volPercent = state.muted ? 0 : Math.round(state.volume * 100);
      volumeSlider.value = state.muted ? 0 : volPercent;
      volumeProgress.style.width = (state.muted ? 0 : volPercent) + '%';
      
      if (state.muted || state.volume === 0) {
        volumeIcon.textContent = 'volume_off';
      } else if (state.volume < 0.5) {
        volumeIcon.textContent = 'volume_down';
      } else {
        volumeIcon.textContent = 'volume_up';
      }
    }
  }

  // 5. 操作コマンドの送信ヘルパー
  function sendCommand(action, value = null) {
    if (conn && conn.open) {
      conn.send({ action, value });
    } else {
      console.warn('Cannot send command: not connected to PC');
    }
  }

  // 6. 各種ボタンのイベント登録
  playBtn.addEventListener('click', () => {
    if (currentVideoState.paused) {
      sendCommand('play');
      playIcon.textContent = 'pause';
      currentVideoState.paused = false;
    } else {
      sendCommand('pause');
      playIcon.textContent = 'play_arrow';
      currentVideoState.paused = true;
    }
  });

  prevBtn.addEventListener('click', () => sendCommand('prev'));
  nextBtn.addEventListener('click', () => sendCommand('next'));
  rewindBtn.addEventListener('click', () => sendCommand('skipBackward'));
  forwardBtn.addEventListener('click', () => sendCommand('skipForward'));

  muteBtn.addEventListener('click', () => {
    const nextMuteState = !currentVideoState.muted;
    sendCommand('mute', nextMuteState);
    currentVideoState.muted = nextMuteState;
    volumeIcon.textContent = nextMuteState ? 'volume_off' : 'volume_up';
  });

  // 7. シークスライダーの処理
  seekSlider.addEventListener('input', () => {
    isUserSeeking = true;
    const percentage = seekSlider.value;
    sliderProgress.style.width = percentage + '%';
    
    if (currentVideoState.duration > 0) {
      const currentSecs = (percentage / 100) * currentVideoState.duration;
      currentTimeLabel.textContent = formatTime(currentSecs);
    }
  });

  seekSlider.addEventListener('change', () => {
    isUserSeeking = false;
    if (currentVideoState.duration > 0) {
      const percentage = seekSlider.value;
      const targetSeconds = (percentage / 100) * currentVideoState.duration;
      sendCommand('seek', targetSeconds);
    }
  });

  // 8. ボリュームスライダーの処理
  volumeSlider.addEventListener('input', () => {
    isUserVolumeChange = true;
    const volPercent = volumeSlider.value;
    volumeProgress.style.width = volPercent + '%';
    
    if (volPercent == 0) {
      volumeIcon.textContent = 'volume_off';
    } else if (volPercent < 50) {
      volumeIcon.textContent = 'volume_down';
    } else {
      volumeIcon.textContent = 'volume_up';
    }
  });

  volumeSlider.addEventListener('change', () => {
    isUserVolumeChange = false;
    const volPercent = volumeSlider.value;
    const volValue = volPercent / 100;
    sendCommand('volume', volValue);
    
    if (currentVideoState.muted && volPercent > 0) {
      sendCommand('mute', false);
      currentVideoState.muted = false;
    }
  });

  // 再生速度セレクターの変更処理
  speedSelect.addEventListener('change', () => {
    const speed = parseFloat(speedSelect.value);
    sendCommand('setSpeed', speed);
  });

  // === 9. 検索機能の処理 ===
  function executeSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchPlaceholder.classList.add('hidden');
    searchLoader.classList.remove('hidden');
    
    const cards = searchResultsList.querySelectorAll('.video-card');
    cards.forEach(card => card.remove());

    sendCommand('search', query);
  }

  searchSubmitBtn.addEventListener('click', executeSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  });

  // 検索結果の描画
  function renderSearchResults(results) {
    searchLoader.classList.add('hidden');
    
    const cards = searchResultsList.querySelectorAll('.video-card');
    cards.forEach(card => card.remove());

    if (!results || results.length === 0) {
      searchPlaceholder.classList.remove('hidden');
      searchPlaceholder.innerHTML = `
        <span class="material-icons-round">info</span>
        <p>動画が見つかりませんでした。<br>別のキーワードで試してください。</p>
      `;
      return;
    }

    results.forEach(video => {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <div class="video-card-clickable">
          <div class="card-thumbnail-container">
            <img src="${video.thumbnail || ''}" alt="Thumbnail" loading="lazy">
            <span class="card-duration">${video.lengthText}</span>
          </div>
          <div class="card-info">
            <h3 class="card-title">${video.title}</h3>
            <span class="card-channel">${video.channelName}</span>
          </div>
        </div>
        <button class="add-queue-btn" title="キューに追加">
          <span class="material-icons-round">add</span>
        </button>
      `;

      // 左側エリアタップ: 即時キャスト＆再生
      const clickArea = card.querySelector('.video-card-clickable');
      clickArea.addEventListener('click', () => {
        sendCommand('playVideo', video.videoId);
        switchTab('remote');
        
        videoTitle.textContent = 'PCに動画をキャスト中...';
        channelNameLabel.textContent = video.title;
        albumArtPlaceholder.classList.add('hidden');
        albumArtImg.src = video.thumbnail;
        albumArtImg.classList.remove('hidden');
        
        currentTimeLabel.textContent = '0:00';
        totalTimeLabel.textContent = video.lengthText;
        seekSlider.value = 0;
        sliderProgress.style.width = '0%';
      });

      // 右端の「＋」ボタンタップ: キューに追加
      const addBtn = card.querySelector('.add-queue-btn');
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 親要素のタップイベント発火（即再生）を防ぐ
        addToQueue(video);
      });

      searchResultsList.appendChild(card);
    });
  }

  // 検索エラー時の描画
  function renderSearchError(message) {
    searchLoader.classList.add('hidden');
    searchPlaceholder.classList.remove('hidden');
    searchPlaceholder.innerHTML = `
      <span class="material-icons-round">error_outline</span>
      <p>検索に失敗しました。<br><small style="color:var(--error-color)">${message}</small></p>
    `;
  }

  // 初期化開始
  loadQueue(); // キュー読み込み
  initPeer();
});
