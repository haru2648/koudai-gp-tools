/**
 * メインエントリーポイント
 * アプリケーションの初期化とルーティングを行います。
 */
import { LINE_CHANNEL_ID, CALLBACK_URL } from './js/config.js';
import { setupAuthStateObserver, handleLineCallback } from './js/auth.js';
import { initializeVotingApp } from './js/voting.js';
import { initializeAdminPage } from './js/admin.js';
import { initializeProxyMode } from './js/proxy.js';
import { showLoginPage, showAdminPage } from './js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // URLパラメータの取得
  const params = new URLSearchParams(window.location.search);
  const lineAuthCode = params.get('code');
  const isAdminMode = params.get('admin') === 'on';
  const isProxyMode = params.get('proxy') === 'on';
  const isDebugMode = params.get('debug') === 'on';

  // LINEログインURLの構築
  const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CHANNEL_ID,
    redirect_uri: CALLBACK_URL,
    state: '12345abcde',
    scope: 'profile openid',
  }).toString()}`;

  // === ルーティング処理 ===

  if (isProxyMode) {
    // 1. 代理投票モード
    initializeProxyMode();

  } else if (lineAuthCode) {
    // 2. LINE認証コールバック
    handleLineCallback(lineAuthCode)
      .then((userCredential) => {
        console.log('Firebaseへのログインに成功しました！');
        // URLからクエリパラメータを削除して見た目をきれいにする
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeVotingApp(userCredential.user, isDebugMode);
      })
      .catch((error) => {
        console.error("ログイン処理エラー:", error);
        const statusMessage = document.getElementById('login-status-message');
        if (statusMessage) statusMessage.textContent = `エラーが発生しました: ${error.message}`;
        showLoginPage(lineLoginUrl);
      });

  } else if (isAdminMode) {
    // 3. 管理者モード
    initializeAdminPage();
    showAdminPage();

  } else {
    // 4. 通常モード（ログイン状態監視）
    setupAuthStateObserver(
      (user) => {
        // ログイン済み
        initializeVotingApp(user, isDebugMode);
      },
      () => {
        // 未ログイン
        showLoginPage(lineLoginUrl);
      }
    );
  }
});