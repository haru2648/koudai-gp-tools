/**
 * 投票ロジックと状態管理
 */
import { doc, getDoc, setDoc, firestore } from './firebase-client.js';
import { fetchNomineesData, submitVote } from './api.js';
import { showVotingPage, showThanksPage, showAlert, showConfirm, closeModal } from './ui.js';

// --- 状態変数 ---
let allNomineesData = {};
let currentDepartment = null;
const selections = { mogiten: null, tenji: null, stage: null, academic: null };

/**
 * 投票アプリを初期化する
 * @param {User} user Firebaseユーザーオブジェクト
 * @param {boolean} isDebugMode デバッグモードかどうか
 */
export async function initializeVotingApp(user, isDebugMode) {
    const userId = user.uid;
    const userVoteDocRef = doc(firestore, "votes", userId);

    try {
        // 1. 投票済みかチェック
        if (!isDebugMode) {
            const docSnap = await getDoc(userVoteDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('Firestore: 投票済みのユーザーです。', data);
                showThanksPage();
                setupThanksPageListeners(userVoteDocRef, data.lotteryUsed ? 'used' : 'unused', isDebugMode);
                return;
            }
        }

        // 2. 未投票なら投票ページを表示
        console.log('Firestore: 未投票のユーザーです。投票ページを初期化します。');
        showVotingPage();

        // 3. 企画データを取得して表示
        try {
            allNomineesData = await fetchNomineesData();
            console.log('企画データを読み込みました:', allNomineesData);
            renderVotingPage();
        } catch (error) {
            console.error('企画データの読み込みエラー:', error);
            const loadingMsg = document.getElementById('loading-message');
            if (loadingMsg) { loadingMsg.textContent = `エラー: 企画データを読み込めませんでした。\n${error.message}`; }
        }

        // 4. イベントリスナーの設定
        setupModalListeners();
        setupFinalVoteButton(userId, isDebugMode);

    } catch (error) {
        console.error("Firestore 状態チェックエラー:", error);
        showAlert(`投票状態の確認中にエラーが発生しました。\n${error.message}\nページを再読み込みしてください。`);
    }
}

/**
 * 投票ページ（部門ボタンなど）を描画する
 */
function renderVotingPage() {
    const form = document.getElementById('nomination-form');
    if (!form) return;

    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) { loadingMessage.remove(); }

    const departmentMap = { mogiten: '模擬店部門', tenji: '学生展示部門', stage: 'ステージ部門', academic: 'アカデミック部門' };
    let htmlContent = '';

    // 既存の部門セクションがあれば削除（再描画時用）
    const existingSections = form.querySelectorAll('.department-section:not(#grand-prix-voting-section)');
    existingSections.forEach(el => el.remove());

    for (const key in departmentMap) {
        if (allNomineesData.hasOwnProperty(key)) {
            const departmentName = departmentMap[key];
            htmlContent += `
              <section class="department-section">
                <div class="department-header"><h2>${departmentName}</h2></div>
                <button type="button" class="open-modal-btn" data-department="${key}">
                  選択する
                </button>
              </section>
            `;
        }
    }

    // グランプリセクションの前に挿入
    const grandPrixSection = document.getElementById('grand-prix-voting-section');
    if (grandPrixSection) {
        grandPrixSection.insertAdjacentHTML('beforebegin', htmlContent);
    } else {
        form.innerHTML += htmlContent;
    }

    setupOpenModalButtons();
    console.log('部門ボタンの生成完了。');
}

/**
 * 「選択する」ボタンのイベントリスナーを設定
 */
function setupOpenModalButtons() {
    const openModalButtons = document.querySelectorAll('.open-modal-btn');
    openModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const departmentKey = button.dataset.department;
            openModal(departmentKey);
        });
    });
}

/**
 * モーダルを開く（投票用）
 * @param {string} departmentKey 
 */
function openModal(departmentKey) {
    const modalTitle = document.getElementById('modal-title');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    const modalOverlay = document.getElementById('modal-overlay');
    const searchInput = document.getElementById('modal-search-input');

    if (searchInput) searchInput.value = '';

    currentDepartment = departmentKey;
    const departmentData = allNomineesData[departmentKey];
    if (!departmentData) return;

    // タイトル設定
    const h2Element = document.querySelector(`button[data-department="${departmentKey}"]`)?.parentElement.querySelector('h2');
    if (modalTitle && h2Element) modalTitle.textContent = h2Element.textContent;

    // リスト描画
    // シャッフル
    const shuffledData = [...departmentData]; // コピーを作成
    shuffleArray(shuffledData);

    let html = '';
    shuffledData.forEach((nominee) => {
        const radioId = `${departmentKey}-${nominee.id}`;
        const planName = nominee.plan_name || '名称未設定';
        const orgName = nominee.organization_name || '団体名未設定';
        const value = JSON.stringify(nominee);
        const iconUrl = nominee.icon_url;
        const isChecked = selections[currentDepartment] && selections[currentDepartment].id === nominee.id ? 'checked' : '';
        const imageTag = iconUrl ? `<div class="nominee-icon" style="background-image: url('${iconUrl}')"></div>` : '';

        html += `
        <label for="${radioId}" class="nominee-item">
          <input type="radio" id="${radioId}" name="modal-selection" value='${value}' ${isChecked}>
          <div class="nominee-label">
            ${imageTag}
            <div class="nominee-details">
              <div class="plan-name">${planName}</div>
              <div class="organization-name">${orgName}</div>
            </div>
          </div>
        </label>
      `;
    });

    if (modalNomineeList) modalNomineeList.innerHTML = html;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
}

/**
 * モーダル内のイベントリスナーを設定
 */
function setupModalListeners() {
    const backBtn = document.getElementById('modal-back-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    const searchInput = document.getElementById('modal-search-input');

    if (backBtn) {
        // 既存のリスナーを削除するためにcloneNodeを使うテクニックもあるが、
        // ここでは単純に上書きするか、main.jsで一度だけ呼ぶ設計にする。
        // 今回は initializeVotingApp で呼ばれるので、重複登録に注意が必要。
        // addEventListener は重複しても同じ関数なら無視されるが、無名関数だと重複する。
        // ここでは「投票アプリ初期化」時に一度だけ呼ばれる前提とする。
        backBtn.onclick = closeModal;
    }

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const selectedRadio = modalNomineeList.querySelector('input[name="modal-selection"]:checked');
            if (!selectedRadio) { showAlert('企画を1つ選択してください。'); return; }

            selections[currentDepartment] = JSON.parse(selectedRadio.value);
            console.log('選択を保存', selections);

            updateButtonState();
            checkAndShowGrandPrixSection();
            closeModal();
        };
    }

    if (searchInput && modalNomineeList) {
        searchInput.oninput = (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const items = modalNomineeList.querySelectorAll('.nominee-item');
            items.forEach(item => {
                const planName = item.querySelector('.plan-name')?.textContent.toLowerCase() || '';
                const orgName = item.querySelector('.organization-name')?.textContent.toLowerCase() || '';
                if (planName.includes(searchTerm) || orgName.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        };
    }
}

/**
 * ボタンの状態（選択済みかどうか）を更新する
 */
function updateButtonState() {
    const openModalButtons = document.querySelectorAll('.open-modal-btn');
    openModalButtons.forEach(btn => {
        const dept = btn.dataset.department;
        if (selections[dept]) {
            btn.textContent = selections[dept].plan_name;
            btn.classList.add('selected');
        } else {
            btn.textContent = '選択する';
            btn.classList.remove('selected');
        }
    });
}

/**
 * 全部門選択済みかチェックし、グランプリセクションを表示する
 */
function checkAndShowGrandPrixSection() {
    const grandPrixList = document.getElementById('grand-prix-list');
    const grandPrixSection = document.getElementById('grand-prix-voting-section');
    const finalVoteBtnContainer = document.getElementById('final-vote-btn-container');

    // 必要な部門キーがすべて埋まっているか確認
    const requiredKeys = ['mogiten', 'tenji', 'stage', 'academic'];
    const allSelected = requiredKeys.every(key => selections[key] !== null);

    if (allSelected) {
        console.log('4部門すべて選択。グランプリセクションを表示。');
        let gp_html = '';
        Object.values(selections).forEach((nominee, index) => {
            if (!nominee) return;
            const radioId = `gp-${index}`;
            const planName = nominee.plan_name;
            const iconUrl = nominee.icon_url;
            const value = JSON.stringify(nominee);
            const imageTag = iconUrl ? `<div class="nominee-icon" style="background-image: url('${iconUrl}')"></div>` : '';

            gp_html += `<label for="${radioId}" class="nominee-item"><input type="radio" id="${radioId}" name="grand-prix" value='${value}'><div class="nominee-label">${imageTag}<div class="nominee-details"><div class="plan-name">${planName}</div><div class="organization-name">${nominee.organization_name}</div></div></div></label>`;
        });

        if (grandPrixList) grandPrixList.innerHTML = gp_html;
        if (grandPrixSection) grandPrixSection.classList.remove('hidden');
        if (finalVoteBtnContainer) finalVoteBtnContainer.classList.remove('hidden');
    }
}

/**
 * 最終投票ボタンの設定
 */
function setupFinalVoteButton(userId, isDebugMode) {
    const finalVoteBtn = document.getElementById('final-vote-btn');
    if (!finalVoteBtn) return;

    // リスナー重複防止のため onclick を使用
    finalVoteBtn.onclick = () => {
        const grandPrixSelection = document.querySelector('input[name="grand-prix"]:checked');
        if (!grandPrixSelection) { showAlert('ベストオブ工大祭を1つ選んでください。'); return; }

        showConfirm(
            '投票の確認',
            'この内容で投票を確定します。<br>よろしいですか？',
            async () => {
                // OK時の処理
                finalVoteBtn.disabled = true;
                finalVoteBtn.textContent = '投票処理中...';

                const grandPrixObject = JSON.parse(grandPrixSelection.value);
                const voteData = {
                    mogiten: selections.mogiten,
                    tenji: selections.tenji,
                    stage: selections.stage,
                    academic: selections.academic,
                    grand_prix: grandPrixObject
                };

                try {
                    await submitVote(userId, voteData, isDebugMode);

                    // 成功時
                    document.getElementById('selection-contents')?.classList.add('hidden');
                    showThanksPage();

                    const userVoteDocRef = doc(firestore, "votes", userId);
                    setupThanksPageListeners(userVoteDocRef, 'unused', isDebugMode);

                } catch (error) {
                    console.error('投票処理エラー:', error);
                    if (error.message === "ALREADY_VOTED") {
                        showAlert('すでに投票処理は完了しています。サンクスページを表示します。');
                        showThanksPage();
                        const userVoteDocRef = doc(firestore, "votes", userId);
                        const docSnap = await getDoc(userVoteDocRef);
                        const currentStatus = docSnap.exists() && docSnap.data().lotteryUsed ? 'used' : 'unused';
                        setupThanksPageListeners(userVoteDocRef, currentStatus, isDebugMode);
                    } else {
                        showAlert(`投票記録の保存中にエラーが発生しました。\n詳細: ${error.message}`);
                        finalVoteBtn.disabled = false;
                        finalVoteBtn.textContent = 'この内容で投票を確定する';
                    }
                }
            },
            () => { /* キャンセル時の処理 */ }
        );
    };
}

/**
 * サンクスページ（抽選券）のリスナー設定
 */
function setupThanksPageListeners(userVoteDocRef, initialStatus, isDebugMode) {
    const lotteryTicket = document.getElementById('lottery-ticket');
    if (!lotteryTicket) return;

    const statusText = lotteryTicket.querySelector('.ticket-status');

    // 初期状態の反映
    if (initialStatus === 'used') {
        lotteryTicket.classList.add('used');
        if (statusText) statusText.textContent = '（使用済み）';
    } else {
        lotteryTicket.classList.remove('used');
        if (statusText) statusText.textContent = '（未使用）';
    }

    // クリックイベント
    lotteryTicket.onclick = () => {
        if (lotteryTicket.classList.contains('used')) return;

        showConfirm(
            '抽選券の使用確認',
            '係員にこの画面を見せましたか？<br>「OK」を押すと使用済みになり、元に戻せません。',
            async () => {
                if (!isDebugMode) {
                    try {
                        await setDoc(userVoteDocRef, { lotteryUsed: true }, { merge: true });
                        console.log('Firestore: 抽選券を使用済みに更新しました。');
                    } catch (error) {
                        console.error("Firestore抽選券更新エラー:", error);
                        showAlert(`抽選券の状態更新中にエラーが発生しました。\n${error.message}`);
                        return;
                    }
                }
                lotteryTicket.classList.add('used');
                if (statusText) statusText.textContent = '（使用済み）';
            },
            () => { }
        );
    };
}

// 配列をシャッフルするヘルパー
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
