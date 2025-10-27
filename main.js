// --- グローバル変数 ---
let allNomineesData = {};
let currentDepartment = null;
const selections = { mogiten: null, tenji: null, stage: null, academic: null };

// HTMLドキュメントがすべて読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
  console.log('ステップ11 ランダム修正版: HTMLの読み込み完了。');

  // --- URLパラメータの取得 ---
  const params = new URLSearchParams(window.location.search);
  const isDebugMode = params.get('debug') === 'on'; 
  const isAdminMode = params.get('admin') === 'on'; 

  // --- GAS API URL ---
  const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwVgH-JIdAYssgfqx5VrG7MKks652tEFmcHmJlfBRdkKVOasSKP0kkz0pwDDVYAxjba7g/exec';

  // --- DOM要素の取得 (DOMContentLoadedの内側) ---
  const selectionContents = document.getElementById('selection-contents');
  const thankYouMessage = document.getElementById('thank-you-message');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalNomineeList = document.getElementById('modal-nominee-list');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const backBtn = document.getElementById('modal-back-btn');
  const grandPrixSection = document.getElementById('grand-prix-voting-section');
  const grandPrixList = document.getElementById('grand-prix-list');
  const finalVoteBtnContainer = document.getElementById('final-vote-btn-container');
  const finalVoteBtn = document.getElementById('final-vote-btn');
  const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
  const confirmTitle = document.querySelector('#custom-confirm-box .confirm-title');
  const confirmMessage = document.querySelector('#custom-confirm-box .confirm-message');
  const confirmOkBtn = document.getElementById('confirm-ok-btn');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const customAlertOverlay = document.getElementById('custom-alert-overlay');
  const customAlertMessage = document.getElementById('custom-alert-message');
  const alertOkBtn = document.getElementById('alert-ok-btn');
  const adminPage = document.getElementById('admin-page');
  const adminResetButton = document.getElementById('admin-reset-button');
  const adminTokenInput = document.getElementById('admin-token');
  const debugStatus = document.getElementById('debug-status');
  const adminBackButton = document.getElementById('admin-back-button');
  
  // 警告ダイアログのOKボタンリスナー
  if(alertOkBtn && customAlertOverlay) { 
    alertOkBtn.addEventListener('click', () => {
      customAlertOverlay.classList.add('hidden'); 
    }); 
  } else {
    console.error("Alert OK button or overlay not found!"); 
  }

  // --- 関数定義 (DOMContentLoadedの内側) ---

  /**
   * カスタム警告を表示する関数 
   */
  const showAlert = (message) => {
    if(customAlertMessage && customAlertOverlay) {
      customAlertMessage.textContent = message;
      customAlertOverlay.classList.remove('hidden');
    } else { 
      alert(message); 
    }
  };
  
  // ★★★ ランダム化のための関数を追加 ★★★
  /**
   * 配列の要素をランダムにシャッフルする関数 (Fisher-Yates algorithm)
   * @param {Array} array シャッフルしたい配列
   */
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      // 0 から i までのランダムな整数 j を生成
      const j = Math.floor(Math.random() * (i + 1));
      // 要素 array[i] と array[j] を入れ替える
      [array[i], array[j]] = [array[j], array[i]];
    }
  };


  /**
   * サンクスページの抽選券リスナーを設定する関数
   */
  function setupThanksPageListeners() {
    const lotteryTicket = document.getElementById('lottery-ticket');
    if (!lotteryTicket) return;
    const statusText = lotteryTicket.querySelector('.ticket-status');
    lotteryTicket.addEventListener('click', () => {
      if (lotteryTicket.classList.contains('used')) return;
      if(confirmTitle) confirmTitle.textContent = '抽選券の使用確認';
      if(confirmMessage) confirmMessage.innerHTML = '係員にこの画面を見せましたか？<br>「OK」を押すと使用済みになり、元に戻せません。';
      if(customConfirmOverlay) customConfirmOverlay.classList.remove('hidden');
      if(confirmOkBtn) {
        confirmOkBtn.onclick = () => {
          if(customConfirmOverlay) customConfirmOverlay.classList.add('hidden');
          lotteryTicket.classList.add('used');
          if(statusText) statusText.textContent = '（使用済み）';
          if (!isDebugMode) { localStorage.setItem('koudsaiLotteryUsed', 'true'); }
        };
      }
      if(confirmCancelBtn) {
        confirmCancelBtn.onclick = () => { if(customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); };
      }
    });
    if (!isDebugMode && localStorage.getItem('koudsaiLotteryUsed') === 'true') {
      lotteryTicket.classList.add('used');
      if(statusText) statusText.textContent = '（使用済み）';
    }
  }

  /**
   * 最終投票データをGASに送信する関数 (ステップ8 CORS対策版)
   */
  const handleFinalVote = async (checkedRadio) => {
    if(finalVoteBtn) { finalVoteBtn.disabled = true; finalVoteBtn.textContent = '投票処理中...'; }
    const grandPrixObject = JSON.parse(checkedRadio.value);
    const voteData = { action: 'submit_vote', mogiten: selections.mogiten, tenji: selections.tenji, stage: selections.stage, academic: selections.academic, grand_prix: grandPrixObject };
    try {
      const response = await fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(voteData) });
      console.log('ステップ11: 投票リクエストを送信しました。');
      if (!isDebugMode) { localStorage.setItem('koudsaiVote2025', 'true'); }
      if(selectionContents) selectionContents.classList.add('hidden');
      if(thankYouMessage) thankYouMessage.classList.remove('hidden');
      setupThanksPageListeners();
    } catch (error) {
      console.error('投票APIエラー:', error);
      showAlert(`投票処理中にエラーが発生しました。\n詳細: ${error.message}`);
      if(finalVoteBtn) { finalVoteBtn.disabled = false; finalVoteBtn.textContent = 'この内容で投票を確定する'; }
    }
  };

  /**
   * 投票ページの部門別セクション（ボタン）をHTMLに生成する関数
   */
  function setupVotingPage() {
    const form = document.getElementById('nomination-form');
    if (!form) return;
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) { loadingMessage.remove(); }
    const departmentMap = { mogiten: '模擬店部門', tenji: '学生展示部門', stage: 'ステージ部門', academic: 'アカデミック部門' };
    let htmlContent = '';
    // ★ 部門の表示順序は固定（模擬店->展示->ステージ->アカデミック）
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
    const firstChild = form.firstChild;
    if (firstChild) { form.insertAdjacentHTML('afterbegin', htmlContent); } else { form.innerHTML = htmlContent; }
    setupOpenModalButtons();
    console.log('ステップ11: 部門ボタンの生成完了。');
  }

  /**
   * モーダルの「開く」ボタンにリスナーを設定する関数
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
   * モーダルの「戻る」「決定」ボタンのリスナーを設定する関数
   */
  function setupModalListeners() {
    if(backBtn) { backBtn.addEventListener('click', closeModal); }
    if(confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const selectedRadio = modalNomineeList.querySelector('input[name="modal-selection"]:checked');
        if (!selectedRadio) { showAlert('企画を1つ選択してください。'); return; }
        selections[currentDepartment] = JSON.parse(selectedRadio.value);
        console.log('ステップ11: 選択を保存', selections);
        updateButtonState();
        checkAndShowGrandPrixSection();
        closeModal(); 
      });
    }
  }

  /**
   * 最終投票ボタンのリスナーを設定する関数
   */
  function setupFinalVoteButton() {
    if (!finalVoteBtn) return;
    finalVoteBtn.addEventListener('click', () => {
      const grandPrixSelection = document.querySelector('input[name="grand-prix"]:checked');
      if (!grandPrixSelection) { showAlert('ベストオブ工大祭を1つ選んでください。'); return; }
      if(confirmTitle) confirmTitle.textContent = '投票の確認';
      if(confirmMessage) confirmMessage.innerHTML = 'この内容で投票を確定します。<br>よろしいですか？';
      if(customConfirmOverlay) customConfirmOverlay.classList.remove('hidden');
      if(confirmOkBtn) { confirmOkBtn.onclick = () => { if(customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); handleFinalVote(grandPrixSelection); }; }
      if(confirmCancelBtn) { confirmCancelBtn.onclick = () => { if(customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); }; }
    });
  }

  /**
   * メインページのボタン表示を、`selections` の内容に応じて更新する関数
   */
  function updateButtonState() {
     const openModalButtons = document.querySelectorAll('.open-modal-btn');
    openModalButtons.forEach(btn => {
      const dept = btn.dataset.department;
      if (selections[dept]) { btn.textContent = selections[dept].plan_name; btn.classList.add('selected'); } else { btn.textContent = '選択する'; btn.classList.remove('selected'); }
    });
    console.log('ステップ11: ボタンの状態を更新しました。');
  }

  /**
   * 4部門すべてが選択されたかチェックし、グランプリセクションを表示する関数
   */
  function checkAndShowGrandPrixSection() {
    const allSelected = Object.values(selections).every(value => value !== null);
    if (allSelected) {
      console.log('ステップ11: 4部門すべて選択。グランプリセクションを表示。');
      let gp_html = '';
      // ★ グランプリ候補の表示順序はランダム化しない（選択した順）
      Object.values(selections).forEach((nominee, index) => { 
        const radioId = `gp-${index}`; const planName = nominee.plan_name; const iconUrl = nominee.icon_url; const value = JSON.stringify(nominee); const imageTag = iconUrl ? `<div class="nominee-icon" style="background-image: url('${iconUrl}')"></div>` : '';
        gp_html += `<label for="${radioId}" class="nominee-item"><input type="radio" id="${radioId}" name="grand-prix" value='${value}'><div class="nominee-label">${imageTag}<div class="nominee-details"><div class="plan-name">${planName}</div><div class="organization-name">${nominee.organization_name}</div></div></div></label>`;
      });
      if(grandPrixList) grandPrixList.innerHTML = gp_html; if(grandPrixSection) grandPrixSection.classList.remove('hidden'); if(finalVoteBtnContainer) finalVoteBtnContainer.classList.remove('hidden');
    }
  }

  /**
   * ★★★ ランダム表示に対応 ★★★
   * モーダルを開き、企画リストを生成する関数
   */
  function openModal(departmentKey) {
    currentDepartment = departmentKey; 
    const departmentData = allNomineesData[departmentKey]; 
    if (!departmentData) return; 
    const h2Element = document.querySelector(`button[data-department="${departmentKey}"]`).parentElement.querySelector('h2'); 
    if(modalTitle && h2Element) modalTitle.textContent = h2Element.textContent;
    
    // ★★★ 企画リストをシャッフル ★★★
    shuffleArray(departmentData); 
    
    let html = '';
    // シャッフルされた配列を使ってHTMLを生成
    departmentData.forEach((nominee) => { 
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
    
    console.log("生成されたHTML（ランダム化後）:", html); // デバッグ用ログ
    
    if(modalNomineeList) modalNomineeList.innerHTML = html; 
    if(modalOverlay) modalOverlay.classList.remove('hidden'); 
    console.log(`ステップ11: モーダル表示 (部門: ${departmentKey})`);
  }

  /**
   * モーダルを閉じる関数
   */
  function closeModal() {
    if(modalOverlay) modalOverlay.classList.add('hidden'); console.log('ステップ11: モーダル非表示');
  }

  /**
   * 管理者ページのイベントリスナーを設定する関数
   */
  function setupAdminPageListeners() {
    // デバッグモード表示
    if(debugStatus) {
      const statusText = isDebugMode ? '有効' : '無効';
      const statusColor = isDebugMode ? 'green' : 'red';
      debugStatus.textContent = `デバッグモード: ${statusText}`;
      debugStatus.style.color = statusColor;
    }
    
    // 全データリセットボタン
    if (adminResetButton && adminTokenInput) {
      adminResetButton.addEventListener('click', async () => {
        const token = adminTokenInput.value;
        const correctToken = "cfn60055";
        if (token !== correctToken) { showAlert("リセットトークンが違います。"); return; }
        if (!confirm("本当にすべての投票データをGoogle スプレッドシートから削除しますか？\nこの操作は元に戻せません！")) { return; }
        adminResetButton.disabled = true; adminResetButton.textContent = 'リセット処理中...';
        try {
          const response = await fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'reset_all_votes', token: token }) });
          showAlert("リセットリクエストを送信しました。\nGoogle スプレッドシートを確認してください。");
          adminTokenInput.value = ''; 
        } catch (error) {
          console.error('リセットAPIエラー:', error);
          showAlert(`リセット処理中にエラーが発生しました。\n詳細: ${error.message}`);
        } finally {
          adminResetButton.disabled = false; adminResetButton.textContent = '全投票データをリセット';
        }
      });
    }

    // ブラウザ状態リセットボタン
    const adminResetLocalButton = document.getElementById('admin-reset-local-button');
     if (adminResetLocalButton) {
      adminResetLocalButton.addEventListener('click', () => {
        if (confirm("本当にこのブラウザの「投票済み」と「抽選券使用済み」の状態をリセットしますか？\n（他のユーザーには影響しません）")) {
          localStorage.removeItem('koudsaiVote2025');
          localStorage.removeItem('koudsaiLotteryUsed');
          showAlert("このブラウザの投票状態をリセットしました。\n投票ページに戻って確認してください。");
        }
      });
    }

    // 戻るボタン
    if (adminBackButton) {
      adminBackButton.addEventListener('click', () => { window.location.href = './'; });
    }
  }


  // --- 処理の開始 ---
  
  // --- 画面表示の振り分け ---
  if (isAdminMode) {
    console.log('ステップ11: 管理者モードで起動します。');
    if(selectionContents) selectionContents.classList.add('hidden');
    if(thankYouMessage) thankYouMessage.classList.add('hidden');
    if(adminPage) adminPage.classList.remove('hidden');
    setupAdminPageListeners();
    
  } else if (!isDebugMode && localStorage.getItem('koudsaiVote2025') === 'true') {
    console.log('ステップ11: 投票済みのため、サンクスページを表示します。');
    if(selectionContents) selectionContents.classList.add('hidden');
    if(thankYouMessage) thankYouMessage.classList.remove('hidden');
    setupThanksPageListeners();
    
  } else {
    // 通常モード かつ まだ投票していない場合 (またはデバッグモードの場合)
    if(isDebugMode) console.log('ステップ11: デバッグモードで起動します。');
    if(selectionContents) selectionContents.classList.remove('hidden');
    if(thankYouMessage) thankYouMessage.classList.add('hidden');
    if(adminPage) adminPage.classList.add('hidden');
    
    // 投票ページの準備
    fetch('data.json')
      .then(response => {
        if (!response.ok) { throw new Error('data.json の読み込みに失敗しました。'); }
        return response.json();
      })
      .then(data => {
        console.log('ステップ11: data.json の読み込み成功。');
        allNomineesData = data; 
        setupVotingPage();
        setupModalListeners();
        setupFinalVoteButton();
        // ★ alertOkBtnのリスナーはDOMContentLoaded直下に移動済み
      })
      .catch(error => {
        console.error('ステップ11テスト失敗:', error);
        showAlert(`致命的なエラー: ${error.message}。\ndata.jsonファイルが正しく配置されているか確認してください。`);
      });
  }
    
});