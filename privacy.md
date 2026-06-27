# Privacy Policy for YouTube Remote Controller

Last Updated: June 27, 2026

## 日本語版 (Japanese Version)

本プライバシーポリシーは、**YouTube Remote Controller**（以下「本拡張機能」または「本ソフトウェア」）におけるユーザーデータの取り扱いについて説明するものです。本拡張機能および専用リモコンサイトをインストール・利用することにより、本ポリシーに同意したものとみなされます。

### 1. 情報の収集と送信について
本拡張機能および専用リモコンサイトは、開発者や第三者のアナリティクスサービスに対して、個人を特定できる情報（PII）を収集、保存、または送信することは一切ありません。
* **個人データ**: 氏名、メールアドレス、ブラウザの履歴、IPアドレス（WebRTC接続に必要な一時的な通信経路確立を除く）、Googleアカウント情報などは一切収集しません。
* **YouTubeのデータ**: 本拡張機能は、再生中のYouTube動画の情報（タイトル、再生時間、音量、チャンネル名、検索クエリなど）にアクセスしますが、これはリモコンデバイスと状態を同期・操作するためだけのものです。これらのデータはすべてデバイス内でローカルに処理され、外部サーバーに送信または保存されることはありません。

### 2. データの保存（ローカルストレージ）について
本拡張機能は、Chromeのローカルストレージ（`chrome.storage.local`）を、スマホリモコンUIはブラウザの `LocalStorage` APIを使用して設定情報を保存します。
* **保存される項目**: ユーザーが設定したリモコンUIのURL、およびランダムに生成されるペアリング用識別子（Peer ID）のみです。
* **アクセス制限**: 保存された設定情報はユーザーのローカル環境から外に出ることはなく、第三者と共有されることはありません。

### 3. P2P通信と外部サーバーの利用について
本拡張機能は、PCとスマートフォン間の直接通信に **WebRTC (PeerJS)** を使用しています。
* **シグナリングサーバー**: 初期の接続確立（ペアリング）の仲介時のみ、パブリックなPeerJSサーバーにアクセスします。
* **STUN/TURNサーバー**: 異なる回線間やNAT環境下での接続ルートを確保するため、パブリックなSTUN/TURNサーバー（Open Relay Project / Metered.ca）を利用して暗号化されたルートの中継を行います。これらの中継サーバーにおいて、デバイス間でやり取りされる具体的な操作コマンド（再生、一時停止、シーク、音量、再生速度、検索結果）のデータを記録・保存することはありません。

### 4. プライバシーポリシーの改定
本プライバシーポリシーは、必要に応じて更新されることがあります。変更があった場合は、本ドキュメントの冒頭にある「Last Updated」の日付が更新されます。

---

## English Version

This Privacy Policy explains how **YouTube Remote Controller** (referred to as "the Extension" / "this Software") handles data. By installing and using this extension and its companion remote controller website, you agree to the terms described below.

### 1. Information Collection and Transmission
This Extension and its companion remote controller website do not collect, store, or transmit any personally identifiable information (PII) to the developer or any third-party analytics services. 
* **Personal Data**: We do not collect names, email addresses, browser history, IP addresses (except as required by WebRTC networking), or Google accounts.
* **YouTube Data**: The Extension accesses information about the YouTube videos you play (such as title, duration, volume, channel name, and search queries) solely to sync them with your remote controller device. This data is processed locally on your devices and is never uploaded to any external server for analysis.

### 2. Data Storage
We use Chrome's local storage API (`chrome.storage.local`) and the remote browser's LocalStorage API to save configurations.
* **Stored Items**: Only your custom remote controller URL and a randomly generated connection identifier (Peer ID) are stored locally in your browser.
* **Access**: Stored configurations never leave your local environment and are not shared with third parties.

### 3. P2P Communication & Third-Party Servers
This Extension uses **WebRTC (PeerJS)** to establish a direct Peer-to-Peer (P2P) connection between your PC and your mobile device.
* **Signaling Server**: A public PeerJS signaling server is used only to facilitate the initial handshake (pairing) between the two devices.
* **STUN/TURN Servers**: To allow connection across different networks or behind NATs, public STUN and TURN servers (provided by Open Relay Project / Metered.ca) are used to relay the encrypted connection route. These servers do not log or store the operational command payloads (play, pause, seek, volume, speed, search results) sent between your devices.

### 4. Changes to This Privacy Policy
We may update this Privacy Policy from time to time. Any changes will be reflected in the updated "Last Updated" date at the top of this document.

---