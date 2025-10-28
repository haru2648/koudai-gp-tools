// === 必要な道具を読み込む ===
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Firebaseアプリを初期化
admin.initializeApp();

// === ここからが「入国審査官」の本体 ===
exports.lineLoginCallback = functions.https.onCall(async (data, context) => {
  // 1. ウェブサイトから送られてきた「通行証(code)」を取り出す
  const code = data.code;
  if (!code) {
    throw new functions.https.HttpsError("invalid-argument", "認証コードがありません。");
  }

  // 2. LINEに「通行証」を渡して、正式な「IDカード(id_token)」をもらう
  const tokenResponse = await axios.post("https://api.line.me/oauth2/v2.1/token", new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: functions.config().line.callback_url, // ★ 設定から読み込む
    client_id: functions.config().line.channel_id,      // ★ 設定から読み込む
    client_secret: functions.config().line.channel_secret // ★ 設定から読み込む
  })).catch(error => {
    console.error("LINE Token API Error:", error.response.data);
    throw new functions.https.HttpsError("internal", "LINEとの通信に失敗しました。");
  });

  const idToken = tokenResponse.data.id_token;
  
  // 3. もらった「IDカード」を検証し、LINEのユーザーIDを取り出す
  const verifyResponse = await axios.post("https://api.line.me/oauth2/v2.1/verify", new URLSearchParams({
    id_token: idToken,
    client_id: functions.config().line.channel_id
  })).catch(error => {
    console.error("LINE Verify API Error:", error.response.data);
    throw new functions.https.HttpsError("internal", "LINE IDの検証に失敗しました。");
  });
  
  const lineUserId = verifyResponse.data.sub; // これがユーザー固有のID

  // 4. LINEのユーザーIDを使って、Firebaseにユーザーを登録または取得する
  try {
    // 同じLINE IDのユーザーが既にいるか探す
    const userRecord = await admin.auth().getUser(lineUserId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      // いなければ、新しく作る
      await admin.auth().createUser({
        uid: lineUserId,
        displayName: verifyResponse.data.name, // LINEの表示名
        photoURL: verifyResponse.data.picture, // LINEのプロフィール画像
      });
    } else {
      throw error; // それ以外のエラーは投げる
    }
  }

  // 5. Firebaseで使える「正式な身分証(customToken)」を発行する
  const firebaseToken = await admin.auth().createCustomToken(lineUserId);

  // 6. ウェブサイトに「身分証」を送り返す
  return { token: firebaseToken };
});