/**
 * メインエントリーポイント
 * アプリケーションの初期化とルーティングを行います。
 */
import { auth, onAuthStateChanged } from './js/firebase-client.js';
import { handleLineCallback } from './js/auth.js';
import { initializeVotingApp } from './js/voting.js';
import { initializeAdminPage } from './js/admin.js';
import { initializeProxyMode } from './js/proxy.js';
import { showLoginPage, showProxyLoginPage, showAdminPage, updateUiText, applyTheme } from './js/ui.js';
import { fetchUiText, fetchThemeSettings } from './js/cms.js';

// デバッグモードの判定
const urlParams = new URLSearchParams(window.location.search);
const isDebugMode = urlParams.get('debug') === 'on';

/**
 * アプリケーションの初期化
 */
async function initialize() {
  console.log('Initializing app...');

  // テーマ設定の適用（非同期だが、UI表示前に適用したいためawaitしない、または最優先で実行）
  fetchThemeSettings().then(settings => applyTheme(settings)).catch(e => console.error('Theme load error:', e));

  // 管理者ページ判定（最優先）
  if (window.location.pathname.endsWith('admin.html') || urlParams.has('admin')) {
    showAdminPage();
    initializeAdminPage(isDebugMode);
    fetchUiText().then(uiText => updateUiText(uiText)).catch(e => console.error(e));
    return;
  }

  // 代理投票モード判定
  if (urlParams.get('proxy') === 'on') {
    initializeProxyMode();
    return;
  }

  // UIテキストの読み込みと適用（通常ユーザー向け）
  try {
    const uiText = await fetchUiText();
    updateUiText(uiText);
  } catch (e) {
    console.error('UI Text fetch error:', e);
  }

  // LINEログインのコールバック判定
  if (urlParams.has('code') && urlParams.has('state')) {
    const code = urlParams.get('code');
    handleLineCallback(code)
      .then((userCredential) => {
        console.log('LINE Login success:', userCredential.user.uid);
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeVotingApp(userCredential.user, isDebugMode);
      })
      .catch((error) => {
        console.error('LINE Login error:', error);
        const loginUrl = 'https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=2006393297&redirect_uri=https://koudaisai-gp-2025.web.app/&state=12345abcde&scope=profile%20openid';
        showLoginPage(loginUrl);
        alert('ログインに失敗しました: ' + error.message);
      });
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
          initializeProxyMode();
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