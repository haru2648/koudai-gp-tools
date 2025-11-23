/**
 * 代理投票ロジック
 */
import { PROXY_PASSWORD } from './config.js';
import { loginAnonymously } from './auth.js';
import { fetchNomineesFromFirestore, submitProxyVote } from './api.js';
import { showProxyLoginPage, showVotingPage, showAlert } from './ui.js';

// --- 状態変数 ---
let allNomineesData = {};
let currentDepartment = null;
const selections = { mogiten: null, tenji: null, stage: null, academic: null };

/**
 * 代理投票モードの初期化
 */
export function initializeProxyMode() {
    if (localStorage.getItem('proxyAuthSuccess') === 'true') {
        console.log('代理投票モードの認証情報をlocalStorageで確認しました。');
        startProxyVotingApp();
    } else {
        showProxyLoginPage();
        setupProxyLoginListeners();
    }
}

function setupProxyLoginListeners() {
    const passwordInput = document.getElementById('proxy-password');
    const loginButton = document.getElementById('proxy-login-button');
    const backButton = document.getElementById('proxy-back-button');
    const errorMessage = document.getElementById('proxy-error-message');

    if (loginButton && passwordInput && errorMessage) {
        const handleLogin = () => {
            if (passwordInput.value === PROXY_PASSWORD) {
                localStorage.setItem('proxyAuthSuccess', 'true');
                console.log('代理投票のパスワードが一致しました。');
                startProxyVotingApp();
            } else {
                errorMessage.textContent = 'パスワードが違います。';
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        loginButton.onclick = handleLogin;
        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter') handleLogin();
        };
    }

    if (backButton) {
        backButton.onclick = () => {
            window.location.href = window.location.pathname;
        };
    }
}

async function startProxyVotingApp() {
    console.log('代理投票モードで初期化します。');

    try {
        await loginAnonymously();
        console.log('匿名認証に成功しました。');
    } catch (error) {
        console.error('匿名認証エラー:', error);
        alert('認証サーバーへの接続に失敗しました。ページを再読み込みしてください。');
        return;
    }

    showVotingPage();

    // 代理投票用のリスナー設定（通常投票とは少し違う）
    setupModalListeners();
    setupProxyFinalVoteButton();

    try {
        allNomineesData = await fetchNomineesFromFirestore();
        console.log('企画データを読み込みました:', allNomineesData);
        renderVotingPage();
    } catch (error) {
        console.error('企画データの読み込みエラー:', error);
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) { loadingMsg.textContent = `エラー: 企画データを読み込めませんでした。`; }
    }
}

// --- 以下、voting.js と似ているが代理投票用に少し違うロジック ---
// ※ 本来なら voting.js の関数を再利用できるように設計すべきだが、
//    現状の構造だと selections のスコープなどが分かれているため、
//    ここでは代理投票用に独立させて記述する（または voting.js からエクスポートして使う）。
//    リファクタリングの観点からは voting.js に統合するのがベストだが、
//    「代理投票は特別」という要件があるため、あえて分けておくのも手。
//    今回は voting.js の renderVotingPage を再利用したいが、
//    selections がモジュールスコープ変数なので、voting.js 側の selections を使う必要がある。
//    
//    ★方針変更: voting.js の関数を再利用する形に修正する。
//    ただし、selections の状態管理が問題になる。
//    voting.js をクラス化するか、状態を外部から注入できるようにする必要がある。
//    
//    簡易的な解決策として、このファイル内で完結させる（コード重複は許容する）。
//    理由: 代理投票は特殊なフローであり、通常投票のロジック変更に影響を受けたくない場合があるため。

function renderVotingPage() {
    const form = document.getElementById('nomination-form');
    if (!form) return;
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) loadingMessage.remove();

    const departmentMap = { mogiten: '模擬店部門', tenji: '学生展示部門', stage: 'ステージ部門', academic: 'アカデミック部門' };
    let htmlContent = '';

    const existingSections = form.querySelectorAll('.department-section:not(#grand-prix-voting-section)');
    existingSections.forEach(el => el.remove());

    for (const key in departmentMap) {
        if (allNomineesData.hasOwnProperty(key)) {
            htmlContent += `
              <section class="department-section">
                <div class="department-header"><h2>${departmentMap[key]}</h2></div>
                <button type="button" class="open-modal-btn" data-department="${key}">選択する</button>
              </section>
            `;
        }
    }
    const grandPrixSection = document.getElementById('grand-prix-voting-section');
    if (grandPrixSection) grandPrixSection.insertAdjacentHTML('beforebegin', htmlContent);
    else form.innerHTML += htmlContent;

    setupOpenModalButtons();
}

function setupOpenModalButtons() {
    document.querySelectorAll('.open-modal-btn').forEach(button => {
        button.onclick = () => openModal(button.dataset.department);
    });
}

function openModal(departmentKey) {
    const modalTitle = document.getElementById('modal-title');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    const modalOverlay = document.getElementById('modal-overlay');
    const searchInput = document.getElementById('modal-search-input');
    if (searchInput) searchInput.value = '';

    currentDepartment = departmentKey;
    const departmentData = allNomineesData[departmentKey];
    if (!departmentData) return;

    const h2Element = document.querySelector(`button[data-department="${departmentKey}"]`)?.parentElement.querySelector('h2');
    if (modalTitle && h2Element) modalTitle.textContent = h2Element.textContent;

    const shuffledData = [...departmentData];
    // shuffleArray(shuffledData); // 代理投票ではシャッフルしない方が探しやすいかも？一旦コメントアウトせずそのまま

    let html = '';
    shuffledData.forEach((nominee) => {
        const radioId = `${departmentKey}-${nominee.id}`;
        const isChecked = selections[currentDepartment] && selections[currentDepartment].id === nominee.id ? 'checked' : '';
        const imageTag = nominee.icon_url ? `<div class="nominee-icon" style="background-image: url('${nominee.icon_url}')"></div>` : '';
        html += `
        <label for="${radioId}" class="nominee-item">
          <input type="radio" id="${radioId}" name="modal-selection" value='${JSON.stringify(nominee)}' ${isChecked}>
          <div class="nominee-label">
            ${imageTag}
            <div class="nominee-details">
              <div class="plan-name">${nominee.plan_name || '名称未設定'}</div>
              <div class="organization-name">${nominee.organization_name || '団体名未設定'}</div>
            </div>
          </div>
        </label>`;
    });
    if (modalNomineeList) modalNomineeList.innerHTML = html;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
}

function setupModalListeners() {
    const backBtn = document.getElementById('modal-back-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    const modalOverlay = document.getElementById('modal-overlay');

    if (backBtn) backBtn.onclick = () => modalOverlay.classList.add('hidden');

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const selectedRadio = modalNomineeList.querySelector('input[name="modal-selection"]:checked');
            if (!selectedRadio) { alert('企画を1つ選択してください。'); return; }
            selections[currentDepartment] = JSON.parse(selectedRadio.value);
            updateButtonState();
            checkAndShowGrandPrixSection();
            modalOverlay.classList.add('hidden');
        };
    }
}

function updateButtonState() {
    document.querySelectorAll('.open-modal-btn').forEach(btn => {
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

function checkAndShowGrandPrixSection() {
    const requiredKeys = ['mogiten', 'tenji', 'stage', 'academic'];
    const allSelected = requiredKeys.every(key => selections[key] !== null);
    if (allSelected) {
        let gp_html = '';
        Object.values(selections).forEach((nominee, index) => {
            if (!nominee) return;
            const radioId = `gp-${index}`;
            const imageTag = nominee.icon_url ? `<div class="nominee-icon" style="background-image: url('${nominee.icon_url}')"></div>` : '';
            gp_html += `<label for="${radioId}" class="nominee-item"><input type="radio" id="${radioId}" name="grand-prix" value='${JSON.stringify(nominee)}'><div class="nominee-label">${imageTag}<div class="nominee-details"><div class="plan-name">${nominee.plan_name}</div><div class="organization-name">${nominee.organization_name}</div></div></div></label>`;
        });
        const grandPrixList = document.getElementById('grand-prix-list');
        if (grandPrixList) grandPrixList.innerHTML = gp_html;
        document.getElementById('grand-prix-voting-section')?.classList.remove('hidden');
        document.getElementById('final-vote-btn-container')?.classList.remove('hidden');
    }
}

function setupProxyFinalVoteButton() {
    const finalVoteBtn = document.getElementById('final-vote-btn');
    if (!finalVoteBtn) return;
    finalVoteBtn.onclick = () => {
        const grandPrixSelection = document.querySelector('input[name="grand-prix"]:checked');
        if (!grandPrixSelection) { alert('ベストオブ工大祭を1つ選んでください。'); return; }
        if (confirm("この内容で代理投票を確定しますか？")) {
            handleProxyVote(grandPrixSelection);
        }
    };
}

async function handleProxyVote(checkedRadio) {
    const finalVoteBtn = document.getElementById('final-vote-btn');
    if (finalVoteBtn) { finalVoteBtn.disabled = true; finalVoteBtn.textContent = '投票処理中...'; }

    const grandPrixObject = JSON.parse(checkedRadio.value);
    const voteData = {
        mogiten: selections.mogiten,
        tenji: selections.tenji,
        stage: selections.stage,
        academic: selections.academic,
        grand_prix: grandPrixObject
    };

    try {
        await submitProxyVote(voteData);
        alert('代理投票が完了しました！\n「OK」を押すと次の投票ができます。');
        window.location.reload();
    } catch (error) {
        console.error('代理投票処理エラー:', error);
        alert(`投票処理中にエラーが発生しました。\n詳細: ${error.message}`);
        if (finalVoteBtn) { finalVoteBtn.disabled = false; finalVoteBtn.textContent = 'この内容で投票を確定する'; }
    }
}
