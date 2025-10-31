// ▼▼▼ この3行はファイルの先頭に追加 ▼▼▼
const LINE_CHANNEL_ID = '2008379888'; // ★ LINEのチャネルIDに書き換える
const CALLBACK_URL = 'https://koudai-gp-tools.pages.dev/';   // ★ CloudflareのURLに書き換える

// ★ Google Apps ScriptのデプロイURL (「?action=...」の手前まで)
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwVgH-JIdAYssgfqx5VrG7MKks652tEFmcHmJlfBRdkKVOasSKP0kkz0pwDDVYAxjba7g/exec'; // ★ あなたのGASのURLに書き換える

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
  const isProxyMode = params.get('proxy') === 'on'; // ★ 代理投票モードか？

  if (isProxyMode) {
    // 【NEW】代理投票モードの場合
    const password = prompt("運営用のパスワードを入力してください:", "");
    const correctPassword = "koudai-proxy"; // ★ 運営用の合言葉を設定
    if (password === correctPassword) {
      initializeProxyVotingApp(); // パスワードが一致したら代理投票アプリを初期化
    } else {
      if(password !== null) { // キャンセルボタンでなければ
        alert("パスワードが違います。");
      }
      // ログインページを表示（または何もしない）
      showLoginPage(); 
    }
  } else if (lineAuthCode) {
    // 【A】LINE認証から戻ってきた場合
    handleLineCallback(lineAuthCode);
  } else if (isAdminMode) {
    // 【B】管理者モードでアクセスされた場合
    initializeAdminPage();
  } else {
    // 【C】上記以外の場合、Firebaseのログイン状態を監視
    window.firebaseTools.onAuthStateChanged(window.firebaseTools.auth, (user) => {
      if (user) {
        // 【D】既にFirebaseにログイン済みの場合
        console.log('ログイン状態を検知しました。', user.uid);
        initializeVotingApp(); // 投票アプリを初期化
      } else {
        // 【E】未ログインの場合
        console.log('未ログイン状態です。ログインページを表示します。');
        showLoginPage(); // ログインページを表示
      }
    });
  }

  // ==========================================================
  // === 以下、役割ごとの関数定義 ==============================
  // ==========================================================

  /**
   * 【C】ログインページを表示し、ボタンをセットアップする
   */
  function showLoginPage() {
    const lineLoginUrl = `https://access.line.me/oauth2/v2.1/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: LINE_CHANNEL_ID,
      redirect_uri: CALLBACK_URL,
      state: '12345abcde',
      scope: 'profile openid',
    }).toString()}`;
    const loginButton = document.getElementById('line-login-button');
    if (loginButton) {
      loginButton.href = lineLoginUrl;
    }
    // ログイン画面以外を非表示にする
    document.getElementById('login-container')?.classList.remove('hidden');
    document.getElementById('selection-contents')?.classList.add('hidden');
    document.getElementById('thank-you-message')?.classList.add('hidden');
    document.getElementById('admin-page')?.classList.add('hidden');
  }

  /**
   * 【A】LINE認証から戻ってきたときの処理
   */
  function handleLineCallback(code) {
    const loginContainer = document.getElementById('login-container');
    const statusMessage = document.getElementById('login-status-message');
    const loginButton = document.getElementById('line-login-button');
    if (loginButton) {
      loginButton.classList.add('hidden');
      if (loginButton.previousElementSibling) {
        loginButton.previousElementSibling.classList.add('hidden');
      }
    }
    if (loginContainer) loginContainer.classList.remove('hidden');
    document.getElementById('selection-contents').classList.add('hidden');
    document.getElementById('thank-you-message').classList.add('hidden');
    document.getElementById('admin-page').classList.add('hidden');
    if (statusMessage) statusMessage.textContent = 'ログイン情報を確認しています...';
    const lineLoginCallback = window.firebaseTools.httpsCallable(window.firebaseTools.functions, 'lineLoginCallback');
    lineLoginCallback({ code: code }).then(async (result) => {
      const firebaseToken = result.data.token;
      await window.firebaseTools.signInWithCustomToken(window.firebaseTools.auth, firebaseToken);
      console.log('Firebaseへのログインに成功しました！');
      window.history.replaceState({}, document.title, window.location.pathname);
      initializeVotingApp();
    }).catch((error) => {
      console.error("ログイン処理エラー:", error);
      if (statusMessage) statusMessage.textContent = `エラーが発生しました: ${error.message}`;
    });
  }

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★ ここから下は、共通で使われるヘルパー関数群です ★★★
  // ★★★ (initializeVotingAppの外に移動しました)       ★★★
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  /**
   * カスタム警告を表示する関数
   */
  const showAlert = (message) => {
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    if (customAlertMessage && customAlertOverlay) {
      customAlertMessage.textContent = message;
      customAlertOverlay.classList.remove('hidden');
    } else {
      alert(message);
    }
  };

  /**
   * 配列の要素をランダムにシャッフルする関数
   */
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
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
    console.log('部門ボタンの生成完了。');
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
   * モーダルの「戻る」「決定」ボタンと「検索欄」のリスナーを設定する関数
   */
  function setupModalListeners() {
    const backBtn = document.getElementById('modal-back-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    if (backBtn) { backBtn.addEventListener('click', closeModal); }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const selectedRadio = modalNomineeList.querySelector('input[name="modal-selection"]:checked');
        if (!selectedRadio) { showAlert('企画を1つ選択してください。'); return; }
        selections[currentDepartment] = JSON.parse(selectedRadio.value);
        console.log('選択を保存', selections);
        updateButtonState();
        checkAndShowGrandPrixSection();
        closeModal();
      });
    }
    const searchInput = document.getElementById('modal-search-input');
    if (searchInput && modalNomineeList) {
      searchInput.addEventListener('input', (e) => {
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
      });
    }
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
    console.log('ボタンの状態を更新しました。');
  }

  /**
   * 4部門すべてが選択されたかチェックし、グランプリセクションを表示する関数
   */
  function checkAndShowGrandPrixSection() {
    const grandPrixList = document.getElementById('grand-prix-list');
    const grandPrixSection = document.getElementById('grand-prix-voting-section');
    const finalVoteBtnContainer = document.getElementById('final-vote-btn-container');
    const allSelected = Object.values(selections).every(value => value !== null);
    if (allSelected) {
      console.log('4部門すべて選択。グランプリセクションを表示。');
      let gp_html = '';
      Object.values(selections).forEach((nominee, index) => {
        const radioId = `gp-${index}`; const planName = nominee.plan_name; const iconUrl = nominee.icon_url; const value = JSON.stringify(nominee); const imageTag = iconUrl ? `<div class="nominee-icon" style="background-image: url('${iconUrl}')"></div>` : '';
        gp_html += `<label for="${radioId}" class="nominee-item"><input type="radio" id="${radioId}" name="grand-prix" value='${value}'><div class="nominee-label">${imageTag}<div class="nominee-details"><div class="plan-name">${planName}</div><div class="organization-name">${nominee.organization_name}</div></div></div></label>`;
      });
      if (grandPrixList) grandPrixList.innerHTML = gp_html; if (grandPrixSection) grandPrixSection.classList.remove('hidden'); if (finalVoteBtnContainer) finalVoteBtnContainer.classList.remove('hidden');
    }
  }

  /**
   * モーダルを開き、企画リストを生成する関数
   */
  function openModal(departmentKey) {
    const modalTitle = document.getElementById('modal-title');
    const modalNomineeList = document.getElementById('modal-nominee-list');
    const modalOverlay = document.getElementById('modal-overlay');
    const searchInput = document.getElementById('modal-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    currentDepartment = departmentKey;
    const departmentData = allNomineesData[departmentKey];
    if (!departmentData) return;
    const h2Element = document.querySelector(`button[data-department="${departmentKey}"]`).parentElement.querySelector('h2');
    if (modalTitle && h2Element) modalTitle.textContent = h2Element.textContent;
    shuffleArray(departmentData);
    let html = '';
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
    if (modalNomineeList) modalNomineeList.innerHTML = html;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
    console.log(`モーダル表示 (部門: ${departmentKey})`);
  }

  /**
   * モーダルを閉じる関数
   */
  function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.add('hidden'); console.log('モーダル非表示');
  }

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // ★★★           ヘルパー関数群はここまで             ★★★
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

  /**
   * ★★★ ログイン成功後に呼び出す、投票アプリ本体の初期化関数 ★★★
   */
  async function initializeVotingApp() {
    const auth = window.firebaseTools.auth;
    const firestore = window.firebaseTools.firestore;
    const doc = window.firebaseTools.doc;
    const getDoc = window.firebaseTools.getDoc;
    const setDoc = window.firebaseTools.setDoc;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("ユーザーがログインしていません。");
      showAlert("ユーザー情報が取得できませんでした。再度ログインしてください。");
      return;
    }
    const userId = currentUser.uid;

    /**
     * サンクスページの抽選券リスナーを設定する関数
     */
    function setupThanksPageListeners(userVoteDocRef, initialStatus = 'unused') {
      const lotteryTicket = document.getElementById('lottery-ticket');
      const confirmTitle = document.querySelector('#custom-confirm-box .confirm-title');
      const confirmMessage = document.querySelector('#custom-confirm-box .confirm-message');
      const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
      const confirmOkBtn = document.getElementById('confirm-ok-btn');
      const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
      const isDebugMode = (new URLSearchParams(window.location.search)).get('debug') === 'on';
      if (!lotteryTicket) return;
      const statusText = lotteryTicket.querySelector('.ticket-status');
      if (initialStatus === 'used') {
        lotteryTicket.classList.add('used');
        if (statusText) statusText.textContent = '（使用済み）';
      } else {
        lotteryTicket.classList.remove('used');
        if (statusText) statusText.textContent = '（未使用）';
      }
      lotteryTicket.addEventListener('click', () => {
        if (lotteryTicket.classList.contains('used')) return;
        if (confirmTitle) confirmTitle.textContent = '抽選券の使用確認';
        if (confirmMessage) confirmMessage.innerHTML = '係員にこの画面を見せましたか？<br>「OK」を押すと使用済みになり、元に戻せません。';
        if (customConfirmOverlay) customConfirmOverlay.classList.remove('hidden');
        if (confirmOkBtn) {
          confirmOkBtn.onclick = async () => {
            if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden');
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
          };
        }
        if (confirmCancelBtn) {
          confirmCancelBtn.onclick = () => { if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); };
        }
      });
    }

    /**
     * 最終投票データをGASとFirestoreに送信する関数
     */
    const handleFinalVote = async (checkedRadio) => {
      const finalVoteBtn = document.getElementById('final-vote-btn');
      const selectionContents = document.getElementById('selection-contents');
      const thankYouMessage = document.getElementById('thank-you-message');
      const isDebugMode = (new URLSearchParams(window.location.search)).get('debug') === 'on';
      const userId = window.firebaseTools.auth.currentUser.uid;
      if (finalVoteBtn) { finalVoteBtn.disabled = true; finalVoteBtn.textContent = '投票処理中...'; }
      const grandPrixObject = JSON.parse(checkedRadio.value);
      const voteDataForGAS = { action: 'submit_vote', mogiten: selections.mogiten, tenji: selections.tenji, stage: selections.stage, academic: selections.academic, grand_prix: grandPrixObject, votedAt: new Date().toISOString() };
      const voteDataForFirestore = { vote: voteDataForGAS, hasVoted: true, lotteryUsed: false, votedAt: voteDataForGAS.votedAt, userId: userId };
      try {
        if (isDebugMode) {
          console.log('デバッグモード: Firestoreへの書き込みをスキップしました。');
          console.log('デバッグモード: GASへの送信をスキップしました。');
        } else {
          await window.firebaseTools.runTransaction(firestore, async (transaction) => {
            const userVoteDocRef = doc(firestore, "votes", userId);
            const docSnap = await transaction.get(userVoteDocRef);
            if (docSnap.exists()) { throw new Error("ALREADY_VOTED"); }
            transaction.set(userVoteDocRef, voteDataForFirestore);
          });
          console.log('Firestore: トランザクション成功。投票記録を保存しました。');
          fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(voteDataForGAS) });
          console.log('GAS API: 投票リクエストを送信しました。');
        }
        if (selectionContents) selectionContents.classList.add('hidden');
        if (thankYouMessage) thankYouMessage.classList.remove('hidden');
        const userVoteDocRef = doc(firestore, "votes", userId);
        setupThanksPageListeners(userVoteDocRef, 'unused');
      } catch (error) {
        console.error('投票処理エラー:', error);
        if (error.message === "ALREADY_VOTED") {
          showAlert('すでに投票処理は完了しています。サンクスページを表示します。');
          if (selectionContents) selectionContents.classList.add('hidden');
          if (thankYouMessage) thankYouMessage.classList.remove('hidden');
          const userVoteDocRef = doc(firestore, "votes", userId);
          const docSnap = await getDoc(userVoteDocRef);
          const currentStatus = docSnap.exists() && docSnap.data().lotteryUsed ? 'used' : 'unused';
          setupThanksPageListeners(userVoteDocRef, currentStatus);
        } else {
          showAlert(`投票記録の保存中にエラーが発生しました。\n詳細: ${error.message}`);
          if (finalVoteBtn) { finalVoteBtn.disabled = false; finalVoteBtn.textContent = 'この内容で投票を確定する'; }
        }
      }
    };

    /**
     * 最終投票ボタンのリスナーを設定する関数
     */
    function setupFinalVoteButton() {
      const finalVoteBtn = document.getElementById('final-vote-btn');
      const confirmTitle = document.querySelector('#custom-confirm-box .confirm-title');
      const confirmMessage = document.querySelector('#custom-confirm-box .confirm-message');
      const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
      const confirmOkBtn = document.getElementById('confirm-ok-btn');
      const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
      if (!finalVoteBtn) return;
      finalVoteBtn.addEventListener('click', () => {
        const grandPrixSelection = document.querySelector('input[name="grand-prix"]:checked');
        if (!grandPrixSelection) { showAlert('ベストオブ工大祭を1つ選んでください。'); return; }
        if (confirmTitle) confirmTitle.textContent = '投票の確認';
        if (confirmMessage) confirmMessage.innerHTML = 'この内容で投票を確定します。<br>よろしいですか？';
        if (customConfirmOverlay) customConfirmOverlay.classList.remove('hidden');
        if (confirmOkBtn) { confirmOkBtn.onclick = () => { if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); handleFinalVote(grandPrixSelection); }; }
        if (confirmCancelBtn) { confirmCancelBtn.onclick = () => { if (customConfirmOverlay) customConfirmOverlay.classList.add('hidden'); }; }
      });
    }

    // --- メイン処理 (initializeVotingAppの内側) ---
    const isDebugMode = (new URLSearchParams(window.location.search)).get('debug') === 'on';
    try {
      const userVoteDocRef = doc(firestore, "votes", userId);
      if (!isDebugMode) {
        const docSnap = await getDoc(userVoteDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Firestore: 投票済みのユーザーです。', data);
          document.getElementById('login-container')?.classList.add('hidden');
          document.getElementById('selection-contents').classList.add('hidden');
          const thankYouMessage = document.getElementById('thank-you-message');
          if (thankYouMessage) thankYouMessage.classList.remove('hidden');
          const alertOkBtn = document.getElementById('alert-ok-btn');
          const customAlertOverlay = document.getElementById('custom-alert-overlay');
          if (alertOkBtn && customAlertOverlay) { alertOkBtn.addEventListener('click', () => customAlertOverlay.classList.add('hidden')); }
          setupThanksPageListeners(userVoteDocRef, data.lotteryUsed ? 'used' : 'unused');
          return;
        }
      }
      console.log('Firestore: 未投票のユーザーです。投票ページを初期化します。');
      document.getElementById('login-container')?.classList.add('hidden');
      document.getElementById('selection-contents').classList.remove('hidden');
      const alertOkBtn = document.getElementById('alert-ok-btn');
      const customAlertOverlay = document.getElementById('custom-alert-overlay');
      if (alertOkBtn && customAlertOverlay) { alertOkBtn.addEventListener('click', () => customAlertOverlay.classList.add('hidden')); }
      try {
        const response = await fetch('./data.json');
        if (!response.ok) { throw new Error(`ネットワークエラー: ${response.status} ${response.statusText}`); }
        allNomineesData = await response.json();
        console.log('ローカルのdata.jsonから企画データを読み込みました:', allNomineesData);
        if (!allNomineesData.mogiten || !allNomineesData.tenji || !allNomineesData.stage || !allNomineesData.academic) {
          throw new Error('企画データ(data.json)の形式が正しくありません。');
        }
        setupVotingPage();
      } catch (error) {
        console.error('企画データの読み込みエラー:', error);
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) { loadingMsg.textContent = `エラー: 企画データを読み込めませんでした。\n${error.message}`; }
      }
      setupModalListeners();
      setupFinalVoteButton();
    } catch (error) {
      console.error("Firestore 状態チェックエラー:", error);
      showAlert(`投票状態の確認中にエラーが発生しました。\n${error.message}\nページを再読み込みしてください。`);
      document.getElementById('login-container')?.classList.remove('hidden');
      document.getElementById('selection-contents').classList.add('hidden');
      document.getElementById('thank-you-message').classList.add('hidden');
      document.getElementById('admin-page').classList.add('hidden');
      const statusMessage = document.getElementById('login-status-message');
      if (statusMessage) {
        statusMessage.textContent = `エラー: データベースに接続できませんでした。\n${error.message}`;
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
    if (adminPage) adminPage.classList.remove('hidden');
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
        adminResetButton.addEventListener('click', async () => {
          const token = adminTokenInput.value;
          const correctToken = "cfn60055";
          if (token !== correctToken) { alert("リセットトークンが違います。"); return; }
          if (!confirm("本当にすべての投票データをGoogle スプレッドシートから削除しますか？\nこの操作は元に戻せません！")) { return; }
          adminResetButton.disabled = true; adminResetButton.textContent = 'リセット処理中...';
          try {
            await fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'reset_all_votes', token: token }) });
            alert("リセットリクエストを送信しました。\nGoogle スプレッドシートを確認してください。");
            adminTokenInput.value = '';
          } catch (error) {
            console.error('リセットAPIエラー:', error);
            alert(`リセット処理中にエラーが発生しました。\n詳細: ${error.message}`);
          } finally {
            adminResetButton.disabled = false; adminResetButton.textContent = '全投票データをリセット';
          }
        });
      }
      const adminResetLocalButton = document.getElementById('admin-reset-local-button');
      if (adminResetLocalButton) {
        adminResetLocalButton.addEventListener('click', () => {
          if (confirm("本当にこのブラウザの「投票済み」と「抽選券使用済み」の状態をリセットしますか？\n（他のユーザーには影響しません）")) {
            localStorage.removeItem('koudsaiVote2025');
            localStorage.removeItem('koudsaiLotteryUsed');
            alert("このブラウザの投票状態をリセットしました。\n投票ページに戻って確認してください。");
          }
        });
      }
      if (adminBackButton) {
        adminBackButton.addEventListener('click', () => { window.location.href = './'; });
      }
    }
    setupAdminPageListeners();
  }

  // ==========================================================
  // === ここから下は代理投票モード用の新しい関数です =========
  // ==========================================================
  
  /**
   * 【NEW】代理投票ページを初期化する
   */
  async function initializeProxyVotingApp() {
    console.log('代理投票モードで初期化します。');
    document.getElementById('login-container')?.classList.add('hidden');
    document.getElementById('selection-contents').classList.remove('hidden');
    
    // 共通のヘルパー関数を呼び出す
    setupModalListeners();
    setupProxyFinalVoteButton();

    try {
      const response = await fetch('./data.json');
      if (!response.ok) { throw new Error(`ネットワークエラー: ${response.status}`); }
      allNomineesData = await response.json();
      console.log('企画データを読み込みました:', allNomineesData);
      setupVotingPage();
    } catch (error) {
      console.error('企画データの読み込みエラー:', error);
      const loadingMsg = document.getElementById('loading-message');
      if (loadingMsg) { loadingMsg.textContent = `エラー: 企画データを読み込めませんでした。`; }
    }
  }

  /**
   * 【NEW】代理投票用の「最終投票ボタン」のリスナー
   */
  function setupProxyFinalVoteButton() {
    const finalVoteBtn = document.getElementById('final-vote-btn');
    if (!finalVoteBtn) return;
    finalVoteBtn.addEventListener('click', () => {
      const grandPrixSelection = document.querySelector('input[name="grand-prix"]:checked');
      if (!grandPrixSelection) {
        alert('ベストオブ工大祭を1つ選んでください。');
        return;
      }
      if (confirm("この内容で代理投票を確定しますか？")) {
        handleProxyVote(grandPrixSelection);
      }
    });
  }

  /**
   * 【NEW】代理投票データをGASに送信する関数
   */
  const handleProxyVote = async (checkedRadio) => {
    const finalVoteBtn = document.getElementById('final-vote-btn');
    if (finalVoteBtn) {
      finalVoteBtn.disabled = true;
      finalVoteBtn.textContent = '投票処理中...';
    }
    const grandPrixObject = JSON.parse(checkedRadio.value);
    const voteDataForGAS = {
      action: 'submit_vote',
      is_proxy: true,
      mogiten: selections.mogiten,
      tenji: selections.tenji,
      stage: selections.stage,
      academic: selections.academic,
      grand_prix: grandPrixObject,
      votedAt: new Date().toISOString()
    };
    try {
      await fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(voteDataForGAS)
      });
      console.log('GAS API: 代理投票リクエストを送信しました。');
      alert('代理投票が完了しました！\n「OK」を押すと次の投票ができます。');
      window.location.reload();
    } catch (error) {
      console.error('代理投票処理エラー:', error);
      alert(`投票処理中にエラーが発生しました。\n詳細: ${error.message}`);
      if (finalVoteBtn) {
        finalVoteBtn.disabled = false;
        finalVoteBtn.textContent = 'この内容で投票を確定する';
      }
    }
  };

}); // DOMContentLoadedの終わり