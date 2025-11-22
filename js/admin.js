/**
 * 管理者ページとCMSのロジック
 */
import { doc, setDoc, firestore, deleteDoc, collection, getDocs } from './firebase-client.js';
import { ADMIN_RESET_TOKEN } from './config.js';
import { showAlert, showConfirm } from './ui.js';
import { fetchNomineesData } from './api.js';
import {
    migrateDataToFirestore,
    fetchUiText,
    saveUiText,
    fetchNomineesFromFirestore,
    addNominee,
    updateNominee,
    deleteNominee
} from './cms.js';

/**
 * 管理者ページを初期化する
 */
export function initializeAdminPage(isDebugMode) {
    const debugStatus = document.getElementById('debug-status');
    if (debugStatus) {
        debugStatus.innerHTML = isDebugMode ?
            '<span style="color: red;">ON (投票/抽選チェック無効)</span>' :
            'OFF';
    }

    setupAdminListeners();
    setupCmsListeners();
}

/**
 * 基本的な管理者機能のリスナー設定
 */
function setupAdminListeners() {
    // 全投票データリセット
    const resetBtn = document.getElementById('admin-reset-button');
    if (resetBtn) {
        resetBtn.onclick = () => {
            const tokenInput = document.getElementById('admin-token');
            const token = tokenInput.value;

            if (token !== ADMIN_RESET_TOKEN) {
                showAlert('リセットトークンが間違っています。');
                return;
            }

            showConfirm(
                '全データ削除の確認',
                '本当にすべての投票データを削除しますか？<br>この操作は取り消せません！',
                async () => {
                    try {
                        const querySnapshot = await getDocs(collection(firestore, "votes"));
                        const deletePromises = [];
                        querySnapshot.forEach((doc) => {
                            deletePromises.push(deleteDoc(doc.ref));
                        });
                        await Promise.all(deletePromises);

                        showAlert('全投票データを削除しました。');
                    } catch (error) {
                        console.error('Reset error:', error);
                        showAlert(`リセット中にエラーが発生しました: ${error.message}`);
                    }
                },
                () => { }
            );
        };
    }

    // ローカル状態リセット
    const resetLocalBtn = document.getElementById('admin-reset-local-button');
    if (resetLocalBtn) {
        resetLocalBtn.onclick = () => {
            showAlert('ブラウザのキャッシュクリア等はブラウザの設定から行ってください。\nFirestore上の自分の投票データを消す場合は、別途実装が必要です。');
        };
    }

    // 代理投票ログアウト
    const resetProxyBtn = document.getElementById('admin-reset-proxy-auth');
    if (resetProxyBtn) {
        resetProxyBtn.onclick = () => {
            localStorage.removeItem('proxy_auth_token');
            showAlert('代理投票の認証情報を削除しました。');
        };
    }

    // 戻るボタン
    const backBtn = document.getElementById('admin-back-button');
    if (backBtn) {
        backBtn.onclick = () => {
            location.reload();
        };
    }
}

/**
 * CMS機能のリスナー設定
 */
function setupCmsListeners() {
    // タブ切り替え
    const tabs = document.querySelectorAll('.admin-tab-btn');
    tabs.forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.admin-tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

            tab.classList.add('active');
            document.getElementById(`admin-tab-${tab.dataset.tab}`).classList.remove('hidden');

            if (tab.dataset.tab === 'cms') {
                loadCmsData();
            }
        };
    });

    // データ移行
    const migrateBtn = document.getElementById('cms-migrate-btn');
    if (migrateBtn) {
        migrateBtn.onclick = async () => {
            showConfirm('データ移行', 'data.jsonの内容でFirestoreを上書き・追加しますか？', async () => {
                try {
                    const jsonData = await fetchNomineesData(); // api.jsから取得
                    await migrateDataToFirestore(jsonData);
                    showAlert('移行が完了しました。');
                    loadNomineesList(); // リスト更新
                } catch (e) {
                    showAlert('移行エラー: ' + e.message);
                }
            });
        };
    }

    // UIテキスト保存
    const saveUiBtn = document.getElementById('cms-save-ui-btn');
    if (saveUiBtn) {
        saveUiBtn.onclick = async () => {
            const title = document.getElementById('cms-ui-title').value;
            const description = document.getElementById('cms-ui-description').value;
            try {
                await saveUiText({ pageTitle: title, description: description });
                showAlert('UIテキストを保存しました。');
            } catch (e) {
                showAlert('保存エラー: ' + e.message);
            }
        };
    }

    // 企画追加ボタン
    const addNomineeBtn = document.getElementById('cms-add-nominee-btn');
    if (addNomineeBtn) {
        addNomineeBtn.onclick = () => {
            openEditModal(null); // 新規作成
        };
    }

    // モーダル保存ボタン
    const modalSaveBtn = document.getElementById('cms-edit-save');
    if (modalSaveBtn) {
        modalSaveBtn.onclick = async () => {
            await saveNomineeFromModal();
        };
    }

    // モーダルキャンセルボタン
    const modalCancelBtn = document.getElementById('cms-edit-cancel');
    if (modalCancelBtn) {
        modalCancelBtn.onclick = () => {
            document.getElementById('cms-edit-modal').classList.add('hidden');
        };
    }
}

/**
 * CMSデータを読み込んで表示
 */
async function loadCmsData() {
    // UIテキスト読み込み
    const uiText = await fetchUiText();
    if (uiText) {
        document.getElementById('cms-ui-title').value = uiText.pageTitle || '';
        document.getElementById('cms-ui-description').value = uiText.description || '';
    }

    // 企画リスト読み込み
    await loadNomineesList();
}

/**
 * 企画リストを読み込んで表示
 */
async function loadNomineesList() {
    const listContainer = document.getElementById('cms-nominee-list');
    listContainer.innerHTML = '読み込み中...';

    try {
        const nomineesData = await fetchNomineesFromFirestore();
        let html = '';

        // 部門ごとに表示
        const departments = { mogiten: '模擬店', tenji: '展示', stage: 'ステージ', academic: 'アカデミック' };

        for (const [deptKey, deptName] of Object.entries(departments)) {
            const items = nomineesData[deptKey] || [];
            if (items.length > 0) {
                html += `<div style="background:#eee; padding:5px; font-weight:bold;">${deptName}</div>`;
                items.forEach(item => {
                    html += `
                        <div class="cms-list-item">
                            <div>
                                <strong>${item.plan_name}</strong><br>
                                <small>${item.organization_name}</small>
                            </div>
                            <div class="cms-item-actions">
                                <button onclick="window.editNominee('${item.id}', '${deptKey}')">編集</button>
                                <button onclick="window.deleteNominee('${item.id}')" style="color:red;">削除</button>
                            </div>
                        </div>
                    `;
                });
            }
        }
        listContainer.innerHTML = html;

        // グローバル関数として登録（HTMLのonclickから呼ぶため）
        window.editNominee = (id, dept) => {
            const item = nomineesData[dept].find(i => i.id === id);
            openEditModal(item);
        };
        window.deleteNominee = (id) => {
            showConfirm('削除確認', '本当に削除しますか？', async () => {
                await deleteNominee(id);
                loadNomineesList();
            });
        };

    } catch (e) {
        listContainer.innerHTML = 'エラー: ' + e.message;
    }
}

/**
 * 編集モーダルを開く
 */
function openEditModal(item) {
    const modal = document.getElementById('cms-edit-modal');
    const deptSelect = document.getElementById('cms-department-select'); // リスト上の選択肢

    if (item) {
        // 編集
        document.getElementById('cms-edit-id').value = item.id;
        document.getElementById('cms-edit-department').value = item.department;
        document.getElementById('cms-edit-plan-name').value = item.plan_name;
        document.getElementById('cms-edit-org-name').value = item.organization_name;
        document.getElementById('cms-edit-icon-url').value = item.icon_url || '';
        document.getElementById('cms-edit-description').value = item.description || '';
    } else {
        // 新規
        document.getElementById('cms-edit-id').value = '';
        document.getElementById('cms-edit-department').value = deptSelect.value;
        document.getElementById('cms-edit-plan-name').value = '';
        document.getElementById('cms-edit-org-name').value = '';
        document.getElementById('cms-edit-icon-url').value = '';
        document.getElementById('cms-edit-description').value = '';
    }

    modal.classList.remove('hidden');
}

/**
 * モーダルの内容を保存
 */
async function saveNomineeFromModal() {
    const id = document.getElementById('cms-edit-id').value;
    const data = {
        department: document.getElementById('cms-edit-department').value,
        plan_name: document.getElementById('cms-edit-plan-name').value,
        organization_name: document.getElementById('cms-edit-org-name').value,
        icon_url: document.getElementById('cms-edit-icon-url').value,
        description: document.getElementById('cms-edit-description').value
    };

    try {
        if (id) {
            await updateNominee(id, data);
        } else {
            await addNominee(data);
        }
        document.getElementById('cms-edit-modal').classList.add('hidden');
        loadNomineesList();
    } catch (e) {
        showAlert('保存エラー: ' + e.message);
    }
}
