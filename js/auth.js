/**
 * 認証関連のロジック
 */
import { auth, functions, httpsCallable, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from './firebase-client.js';

/**
 * LINEログインのコールバックを処理する
 * @param {string} code LINEから返された認証コード
 * @returns {Promise<UserCredential>} Firebaseのユーザー情報
 */
export async function handleLineCallback(code) {
    const lineLoginCallback = httpsCallable(functions, 'lineLoginCallback');
    const result = await lineLoginCallback({ code: code });
    const firebaseToken = result.data.token;
    return await signInWithCustomToken(auth, firebaseToken);
}

/**
 * 匿名ログインを行う（代理投票用）
 * @returns {Promise<UserCredential>}
 */
export async function loginAnonymously() {
    return await signInAnonymously(auth);
}

/**
 * 認証状態の変更を監視する
 * @param {Function} onLogin ログイン時に呼ばれるコールバック (user) => void
 * @param {Function} onLogout ログアウト時（または未ログイン時）に呼ばれるコールバック () => void
 */
export function setupAuthStateObserver(onLogin, onLogout) {
    onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
            console.log('ログイン状態を検知しました。', user.uid);
            onLogin(user);
        } else {
            // 匿名ユーザーの場合は、通常の投票アプリとしては「未ログイン」扱いにする場合もあるが、
            // ここでは単純に user が falsy か anonymous ならログアウト扱いとする
            // ただし、代理投票モードは別ルートで制御されるため、メインのフローではこれでOK
            console.log('未ログイン状態（または匿名）です。');
            onLogout();
        }
    });
}

/**
 * 現在のユーザーを取得する
 * @returns {User}
 */
export function getCurrentUser() {
    return auth.currentUser;
}
