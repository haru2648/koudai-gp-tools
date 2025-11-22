/**
 * API interactions
 */
import { GAS_API_URL } from './config.js';
import {
    firestore,
    doc,
    runTransaction,
    addDoc,
    collection,
    getDocs,
    query,
    getDoc
} from './firebase-client.js';

/**
 * JST（日本標準時）のISO 8601形式に近い文字列を生成する関数
 * @returns {string} 例: "2025-11-02T15:30:00+09:00"
 */
export function getJstIsoString() {
    const date = new Date();
    const options = {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24時間表記
    };

    // 'sv-SE' (スウェーデン) ロケールは 'YYYY-MM-DD HH:mm:ss' という形式を生成するため、整形しやすい
    const formatter = new Intl.DateTimeFormat('sv-SE', options);
    const formattedDate = formatter.format(date); // 例: "2025-11-02 15:30:00"

    // Tで区切り、タイムゾーン情報を付加してISO形式に近づける
    return formattedDate.replace(' ', 'T') + '+09:00';
}

/**
 * data.jsonから企画データを取得する (Migration用)
 * @returns {Promise<Object>}
 */
export async function fetchNomineesFromJSON() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data.json:', error);
        throw error;
    }
}

/**
 * Firestoreから企画データを取得する
 * @returns {Promise<Object>} 部門ごとの企画データ { mogiten: [...], ... }
 */
export async function fetchNomineesFromFirestore() {
    try {
        const q = query(collection(firestore, 'nominees'));
        const querySnapshot = await getDocs(q);
        const nominees = {
            mogiten: [],
            tenji: [],
            stage: [],
            academic: []
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id; // FirestoreのドキュメントIDを含める
            if (nominees[data.department]) {
                nominees[data.department].push(data);
            }
        });

        return nominees;
    } catch (error) {
        console.error('Error fetching nominees from Firestore:', error);
        throw error;
    }
}

/**
 * UIテキスト設定を取得する
 * @returns {Promise<Object>} UIテキスト設定オブジェクト
 */
export async function fetchUiText() {
    try {
        const docRef = doc(firestore, 'system_config', 'ui_text');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log('UI Text config not found. Using defaults.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching UI text:', error);
        throw error;
    }
}

/**
 * 投票データを送信する（通常投票）
 * @param {string} userId ユーザーID
 * @param {Object} voteData 投票データ
 * @param {boolean} isDebugMode デバッグモードかどうか
 */
export async function submitVote(userId, voteData, isDebugMode) {
    const jstVotedAt = getJstIsoString();

    // GAS送信用データ
    const voteDataForGAS = {
        action: 'submit_vote',
        ...voteData,
        votedAt: jstVotedAt
    };

    // Firestore保存用データ
    const voteDataForFirestore = {
        vote: voteDataForGAS,
        hasVoted: true,
        lotteryUsed: false,
        votedAt: jstVotedAt,
        userId: userId
    };

    if (isDebugMode) {
        console.log('デバッグモード: Firestoreへの書き込みをスキップしました。');
        console.log('デバッグモード: GASへの送信をスキップしました。');
        return;
    }

    // Firestoreへのトランザクション書き込み
    await runTransaction(firestore, async (transaction) => {
        const userVoteDocRef = doc(firestore, "votes", userId);
        const docSnap = await transaction.get(userVoteDocRef);
        if (docSnap.exists()) { throw new Error("ALREADY_VOTED"); }
        transaction.set(userVoteDocRef, voteDataForFirestore);
    });
    console.log('Firestore: トランザクション成功。投票記録を保存しました。');

    // GASへの送信
    fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(voteDataForGAS)
    });
    console.log('GAS API: 投票リクエストを送信しました。');
}

/**
 * 代理投票データを送信する
 * @param {Object} voteData 投票データ
 */
export async function submitProxyVote(voteData) {
    const jstVotedAt = getJstIsoString();

    const finalVoteData = {
        is_proxy: true,
        ...voteData,
        votedAt: jstVotedAt
    };

    // Firestoreへの追加
    await addDoc(collection(firestore, "proxyvotes"), finalVoteData);
    console.log('Firestore: 代理投票の記録を保存しました。');

    // GASへの送信
    const gasPayload = { ...finalVoteData, action: 'submit_vote' };
    await fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(gasPayload)
    });
    console.log('GAS API: 代理投票リクエストを送信しました。');
}

/**
 * 全投票データをリセットする（管理者用）
 * @param {string} token リセットトークン
 */
export async function resetAllVotes(token) {
    await fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'reset_all_votes', token: token })
    });
}
