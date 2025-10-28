// ▼▼▼ この3行をファイルの先頭に追加 ▼▼▼
const LINE_CHANNEL_ID = '2008379888'; // ★ LINEのチャネルIDに書き換える
const CALLBACK_URL = 'https://koudai-gp-tools.pages.dev/';   // ★ CloudflareのURLに書き換える


// --- グローバル変数 ---
let allNomineesData = {};
let currentDepartment = null;
const selections = { mogiten: null, tenji: null, stage: null, academic: null };

// HTMLドキュメントがすべて読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {


  // === メイン処理：ページの表示を振り分ける ===
  const params = new URLSearchParams(window.location.search);
  const lineAuthCode = params.get('code'); // URLに 'code' はあるか？
  const isAdminMode = params.get('admin') === 'on'; // URLに 'admin' はあるか？

  if (lineAuthCode) {
    // 【A】LINE認証から戻ってきた場合
    handleLineCallback(lineAuthCode);
  } else if (isAdminMode) {
    // 【B】管理者モードでアクセスされた場合
    initializeAdminPage();
  } else {
    // 【C】ユーザーが最初にアクセスした場合
    // (将来的には、ここにFirebaseのログイン状態チェックが入る)
    showLoginPage();
  }

  // ==========================================================
  // === 以下、役割ごとの関数定義 ==============================
  // ==========================================================

  /**
   * 【C】ログインページを表示し、ボタンをセットアップする
   */
  function showLoginPage() {
    // ログインURLを組み立て
    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: LINE_CHANNEL_ID,
      redirect_uri: CALLBACK_URL,
      state: '12345abcde', // CSRF対策。今は固定でOK
      scope: 'profile openid',
    }).toString()}`;

    // ボタンにURLを設定
    const loginButton = document.getElementById('line-login-button');
    if (loginButton) {
      loginButton.href = lineLoginUrl;
    }
  }

  /**
   * 【A】LINE認証から戻ってきたときの処理
   */
  function handleLineCallback(code) {
    const loginContainer = document.getElementById('login-container');
    const statusMessage = document.getElementById('login-status-message');
    
    // 画面を「処理中...」に切り替え
    if(loginContainer) loginContainer.classList.remove('hidden');
    document.getElementById('selection-contents').classList.add('hidden');
    document.getElementById('thank-you-message').classList.add('hidden');
    document.getElementById('admin-page').classList.add('hidden');
    if(statusMessage) statusMessage.textContent = 'ログイン情報を確認しています...';
    
    console.log('LINEから受け取った認証コード:', code);
    alert('LINE認証成功！次のフェーズに進みます。\n認証コード: ' + code);
    
    // ★★★ 次のフェーズで、この下に関数を追加し、Firebaseに認証コードを送信します ★★★
  }

  /**
   * ★★★ ログイン成功後に呼び出す、投票アプリ本体の初期化関数 ★★★
   */
  function initializeVotingApp(){
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
  }


  /**
   * 【B】管理者ページを初期化する
   */
  function initializeAdminPage() {
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents').classList.add('hidden');
    document.getElementById('thank-you-message').classList.add('hidden');
    const adminPage = document.getElementById('admin-page');
    if(adminPage) adminPage.classList.remove('hidden');
    setupAdminPageListeners();
    
  }
    
});