/**
 * 管理者ページとCMSのロジック
 */
import { doc, setDoc, firestore, deleteDoc, collection, getDocs } from './firebase-client.js';
import { ADMIN_RESET_TOKEN } from './config.js';
import { showAlert, showConfirm } from './ui.js';
import { fetchNomineesFromJSON } from './api.js';
import {
    migrateDataToFirestore,
    fetchUiText,
    saveUiText,
    fetchNomineesFromFirestore,
    addNominee,
    updateNominee,
    deleteNominee,
    saveThemeSettings,
    fetchThemeSettings
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
                    const jsonData = await fetchNomineesFromJSON(); // api.jsから取得
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

    // 部門選択変更時
    const deptSelect = document.getElementById('cms-department-select');
    if (deptSelect) {
        deptSelect.onchange = () => {
            loadNomineesList();
        };
    }

    // モーダル保存ボタン
    const modalSaveBtn = document.getElementById('cms-edit-save-btn');
    if (modalSaveBtn) {
        modalSaveBtn.onclick = async () => {
            await saveNomineeFromModal();
        };
    }

    // モーダルキャンセルボタン
    const modalCancelBtn = document.getElementById('cms-edit-cancel-btn');
    if (modalCancelBtn) {
        modalCancelBtn.onclick = () => {
            document.getElementById('cms-edit-modal').classList.add('hidden');
        };
    }

    // --- テーマ設定 ---

    // カラーピッカーの変更検知
    ['theme-main-color', 'theme-accent-color', 'theme-bg-color', 'theme-text-color'].forEach(id => {
        const picker = document.getElementById(id);
        if (picker) {
            picker.oninput = (e) => {
                document.getElementById(id + '-val').textContent = e.target.value;
            };
        }
    });

    // テーマ保存ボタン
    const saveThemeBtn = document.getElementById('theme-save-btn');
    if (saveThemeBtn) {
        saveThemeBtn.onclick = async () => {
            const layout = document.querySelector('input[name="theme-layout"]:checked').value;
            const settings = {
                mainColor: document.getElementById('theme-main-color').value,
                accentColor: document.getElementById('theme-accent-color').value,
                backgroundColor: document.getElementById('theme-bg-color').value,
                textColor: document.getElementById('theme-text-color').value,
                fontFamily: document.getElementById('theme-font-family').value,
                backgroundImageUrl: document.getElementById('theme-bg-image').value,
                layoutType: layout
            };
            try {
                await saveThemeSettings(settings);
                showAlert('テーマを保存しました。再読み込みすると反映されます。');
            } catch (e) {
                showAlert('保存エラー: ' + e.message);
            }
        };
    }

    // テーマリセットボタン
    const resetThemeBtn = document.getElementById('theme-reset-btn');
    if (resetThemeBtn) {
        resetThemeBtn.onclick = () => {
            // デフォルト値に戻す
            updateColorPicker('theme-main-color', '#76499F');
            updateColorPicker('theme-accent-color', '#E7CBFF');
            updateColorPicker('theme-bg-color', '#ffffff');
            updateColorPicker('theme-text-color', '#333333');
            document.getElementById('theme-font-family').value = '';
            document.getElementById('theme-bg-image').value = '';
            document.querySelector('input[name="theme-layout"][value="list"]').checked = true;
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

    // テーマ設定読み込み
    await loadThemeSettings();
}

/**
 * 企画リストを読み込んで表示
 */
async function loadNomineesList() {
    const listContainer = document.getElementById('cms-nominee-list');
    const currentDept = document.getElementById('cms-department-select').value;
    listContainer.innerHTML = '<div style="text-align:center; padding:20px;">読み込み中...</div>';

    try {
        const nomineesData = await fetchNomineesFromFirestore();
        let html = '';

        // 選択された部門のみ表示
        const items = nomineesData[currentDept] || [];

        if (items.length === 0) {
            html = '<div style="text-align:center; padding:20px; color:#666;">この部門にはまだ企画がありません。</div>';
        } else {
            items.forEach(item => {
                const iconStyle = item.icon_url ? `background-image: url('${item.icon_url}')` : '';
                html += `
                    <div class="cms-list-item">
                        <div class="cms-item-icon" style="${iconStyle}"></div>
                        <div class="cms-item-info">
                            <div class="cms-item-title">${item.plan_name}</div>
                            <div class="cms-item-org">${item.organization_name}</div>
                        </div>
                        <div class="cms-item-actions">
                            <button class="cms-action-btn edit" onclick="window.editNominee('${item.id}', '${currentDept}')">編集</button>
                            <button class="cms-action-btn delete" onclick="window.deleteNominee('${item.id}')">削除</button>
                        </div>
                    </div>
                `;
            });
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
        listContainer.innerHTML = '<div style="color:red; padding:20px;">エラー: ' + e.message + '</div>';
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

/**
 * テーマ設定を読み込んで表示
 */
async function loadThemeSettings() {
    const settings = await fetchThemeSettings();
    if (settings) {
        if (settings.mainColor) updateColorPicker('theme-main-color', settings.mainColor);
        if (settings.accentColor) updateColorPicker('theme-accent-color', settings.accentColor);
        if (settings.backgroundColor) updateColorPicker('theme-bg-color', settings.backgroundColor);
        if (settings.textColor) updateColorPicker('theme-text-color', settings.textColor);

        if (settings.fontFamily) document.getElementById('theme-font-family').value = settings.fontFamily;
        if (settings.backgroundImageUrl) document.getElementById('theme-bg-image').value = settings.backgroundImageUrl;

        if (settings.layoutType) {
            const radio = document.querySelector(`input[name="theme-layout"][value="${settings.layoutType}"]`);
            if (radio) radio.checked = true;
        }
    }
}

function updateColorPicker(id, color) {
    const picker = document.getElementById(id);
    const valDisplay = document.getElementById(id + '-val');
    if (picker && valDisplay) {
        picker.value = color;
        valDisplay.textContent = color;
    }
}
