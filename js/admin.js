/**
 * 管理者ページロジック
 */
import { ADMIN_RESET_TOKEN } from './config.js';
import { resetAllVotes } from './api.js';

/**
 * 管理者ページを初期化する
 */
export function initializeAdminPage() {
    // UIの表示は ui.js の showAdminPage で行われる前提だが、
    // ここではイベントリスナーの設定を行う
    setupAdminPageListeners();
}

function setupAdminPageListeners() {
    const adminResetButton = document.getElementById('admin-reset-button');
    const adminTokenInput = document.getElementById('admin-token');
    const adminBackButton = document.getElementById('admin-back-button');
    const debugStatus = document.getElementById('debug-status');

    const isDebugMode = (new URLSearchParams(window.location.search)).get('debug') === 'on';

    if (debugStatus) {
        const statusText = isDebugMode ? '有効' : '無効';
        const statusColor = isDebugMode ? 'green' : 'red';
        debugStatus.textContent = `デバッグモード: ${statusText}`;
        debugStatus.style.color = statusColor;
    }

    if (adminResetButton && adminTokenInput) {
        adminResetButton.onclick = async () => {
            const token = adminTokenInput.value;
            if (token !== ADMIN_RESET_TOKEN) {
                alert("リセットトークンが違います。");
                return;
            }

            if (!confirm("本当にすべての投票データをGoogle スプレッドシートから削除しますか？\nこの操作は元に戻せません！")) {
                return;
            }

            adminResetButton.disabled = true;
            adminResetButton.textContent = 'リセット処理中...';

            try {
                await resetAllVotes(token);
                alert("リセットリクエストを送信しました。\nGoogle スプレッドシートを確認してください。");
                adminTokenInput.value = '';
            } catch (error) {
                console.error('リセットAPIエラー:', error);
                alert(`リセット処理中にエラーが発生しました。\n詳細: ${error.message}`);
            } finally {
                adminResetButton.disabled = false;
                adminResetButton.textContent = '全投票データをリセット';
            }
        };
    }

    const adminResetLocalButton = document.getElementById('admin-reset-local-button');
    if (adminResetLocalButton) {
        adminResetLocalButton.onclick = () => {
            if (confirm("本当にこのブラウザの「投票済み」と「抽選券使用済み」の状態をリセットしますか？\n（他のユーザーには影響しません）")) {
                localStorage.removeItem('koudsaiVote2025'); // ※古いキー名かもしれないが念のため
                localStorage.removeItem('koudsaiLotteryUsed');
                // Firestoreのキャッシュクリアなどはできないが、localStorageを使っている部分があればここでクリア
                alert("このブラウザの投票状態をリセットしました。\n投票ページに戻って確認してください。");
            }
        };
    }

    if (adminBackButton) {
        adminBackButton.onclick = () => { window.location.href = './'; };
    }

    // 代理投票モードのパスワードリセットボタン
    const adminResetProxyAuthButton = document.getElementById('admin-reset-proxy-auth-button');
    if (adminResetProxyAuthButton) {
        adminResetProxyAuthButton.onclick = () => {
            if (confirm("本当にこのブラウザの代理投票パスワードの保存情報をリセットしますか？")) {
                localStorage.removeItem('proxyAuthSuccess');
                alert("代理投票パスワードの保存情報をリセットしました。\n次回代理投票モードでアクセスする際に、パスワードの入力が再度必要になります。");
            }
        };
    }
}
