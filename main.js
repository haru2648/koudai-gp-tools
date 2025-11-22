/**
 * メインエントリーポイント
 * アプリケーションの初期化とルーティングを行います。
 */
import { initializeFirebase, auth, onAuthStateChanged } from './js/firebase-client.js';
import { handleLineLoginCallback, handleProxyLogin } from './js/auth.js';
import { initializeVotingApp } from './js/voting.js';
import { initializeAdminPage } from './js/admin.js';
import { showLoginPage, showProxyLoginPage, showAdminPage, updateUiText } from './js/ui.js';
import { fetchUiText } from './js/api.js';

// デバッグモードの判定
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.get('debug') === 'on';

/**
 * アプリケーションの初期化
 */
async function initialize() {
  console.log('Initializing app...');

  // UIテキストの読み込みと適用
  try {
    const uiText = await fetchUiText();
    updateUiText(uiText);
  } catch (e) {
    console.error('UI Text fetch error:', e);
  }

  // 管理者ページ判定
  if (window.location.pathname.endsWith('admin.html') || urlParams.has('admin')) {
    showAdminPage();
    initializeAdminPage(isDebugMode);
    return;
  }

  // 代理投票モード判定
  if (urlParams.get('proxy') === 'on') {
    handleProxyLogin(isDebugMode);
    return;
  }

  // LINEログインのコールバック判定
  if (urlParams.has('code') && urlParams.has('state')) {
    handleLineLoginCallback(isDebugMode);
    return;
  }

  // 通常のログイン状態監視
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('User is signed in:', user.uid);
      if (user.isAnonymous) {
        // 匿名ログインは代理投票モードで扱われるため、ここでは何もしないか、
        // 代理投票ロジックに任せる。
        // ただし、ページリロード時はここに来る可能性がある。
        // 代理投票モードのフラグがあればそちらへ。
        if (localStorage.getItem('proxy_auth_token')) {
          handleProxyLogin(isDebugMode);
        } else {
          // 通常の匿名ログイン（ありえないはずだが）
          initializeVotingApp(user, isDebugMode);
        }
      } else {
        initializeVotingApp(user, isDebugMode);
      }
    } else {
      console.log('User is signed out.');
      showLoginPage('https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=2006393297&redirect_uri=https://koudaisai-gp-2025.web.app/&state=12345abcde&scope=profile%20openid');
    }
  });
}

// アプリ起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}