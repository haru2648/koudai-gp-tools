/**
 * UI関連のヘルパー関数
 */

/**
 * 指定されたメッセージでアラートを表示する
 * @param {string} message 
 */
export function showAlert(message) {
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    if (customAlertMessage && customAlertOverlay) {
        customAlertMessage.textContent = message;
        customAlertOverlay.classList.remove('hidden');

        // OKボタンのリスナーを設定（一度だけ）
        const alertOkBtn = document.getElementById('alert-ok-btn');
        if (alertOkBtn) {
            // 既存のリスナーが重複しないように新しい要素に置換するか、
            // 単純にクリックで閉じる処理だけならここで設定しても良いが、
            // 呼び出しごとにリスナーが増えるのを防ぐため、
            // main.jsなどの初期化時に設定するのがベスト。
            // ここでは単純に overlay を隠す処理だけ記述する。
            alertOkBtn.onclick = () => customAlertOverlay.classList.add('hidden');
        }
    } else {
        alert(message);
    }
}

/**
 * 確認ダイアログを表示する
 * @param {string} title 
 * @param {string} message 
 * @param {Function} onOk OKボタンが押されたときのコールバック
 * @param {Function} onCancel キャンセルボタンが押されたときのコールバック
 */
export function showConfirm(title, message, onOk, onCancel) {
    const confirmTitle = document.querySelector('#custom-confirm-box .confirm-title');
    const confirmMessage = document.querySelector('#custom-confirm-box .confirm-message');
    const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.innerHTML = message;
    if (customConfirmOverlay) customConfirmOverlay.classList.remove('hidden');

    if (confirmOkBtn) {
        confirmOkBtn.onclick = () => {
            if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden');
            if (onOk) onOk();
        };
    }
    if (confirmCancelBtn) {
        confirmCancelBtn.onclick = () => {
            if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden');
            if (onCancel) onCancel();
        };
    }
}

/**
 * ログインページを表示する
 * @param {string} lineLoginUrl LINEログインのURL
 */
export function showLoginPage(lineLoginUrl) {
    const loginButton = document.getElementById('line-login-button');
    if (loginButton) {
        loginButton.href = lineLoginUrl;
    }
    // ログイン画面以外を非表示にする
    document.getElementById('login-container')?.classList.remove('hidden');
    document.getElementById('selection-contents')?.classList.add('hidden');
    document.getElementById('thank-you-message')?.classList.add('hidden');
    document.getElementById('admin-page')?.classList.add('hidden');
    document.getElementById('proxy-login-page')?.classList.add('hidden');
}

/**
 * 投票ページ（企画選択画面）を表示する
 */
export function showVotingPage() {
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents')?.classList.remove('hidden');
    document.getElementById('thank-you-message')?.classList.add('hidden');
    document.getElementById('admin-page')?.classList.add('hidden');
    document.getElementById('proxy-login-page')?.classList.add('hidden');
}

/**
 * サンクスページを表示する
 */
export function showThanksPage() {
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents')?.classList.add('hidden');
    document.getElementById('thank-you-message')?.classList.remove('hidden');
    document.getElementById('admin-page')?.classList.add('hidden');
    document.getElementById('proxy-login-page')?.classList.add('hidden');
}

/**
 * 管理者ページを表示する
 */
export function showAdminPage() {
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents')?.classList.add('hidden');
    document.getElementById('thank-you-message')?.classList.add('hidden');
    document.getElementById('admin-page')?.classList.remove('hidden');
    document.getElementById('proxy-login-page')?.classList.add('hidden');
}

/**
 * 代理投票ログインページを表示する
 */
export function showProxyLoginPage() {
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents')?.classList.add('hidden');
    document.getElementById('thank-you-message')?.classList.add('hidden');
    document.getElementById('admin-page')?.classList.add('hidden');
    document.getElementById('proxy-login-page')?.classList.remove('hidden');
}
/**
 * モーダルを閉じる
 */
export function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.add('hidden');
}

/**
 * UIテキストを更新する
 * @param {Object} textData 
 */
export function updateUiText(textData) {
    if (!textData) return;

    if (textData.pageTitle) {
        document.title = textData.pageTitle;
        document.querySelectorAll('header h1').forEach(el => el.textContent = textData.pageTitle);
    }

    if (textData.description) {
        const descEl = document.querySelector('.description');
        if (descEl) descEl.textContent = textData.description;
    }

    // 必要に応じて他のフィールドも追加
}
