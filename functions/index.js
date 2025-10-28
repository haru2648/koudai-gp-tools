// === 必要な道具を読み込む (v2対応版) ===
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const axios = require("axios");
// const functions = require("firebase-functions"); // ← 不要になったので削除

// Firebaseアプリを初期化
admin.initializeApp();

// 全ての関数のリージョンを東京に設定
setGlobalOptions({ region: "asia-northeast1" });

// === ここからが「入国審査官」の本体 ===
exports.lineLoginCallback = onRequest({ cors: true }, async (req, res) => {
  try {
    // 1. ウェブサイトから送られてきた「通行証(code)」を取り出す
    const code = req.body.data.code;
    if (!code) {
      console.error("認証コードが見つかりません。");
      res.status(400).send({ error: { message: "認証コードがありません。" } });
      return;
    }

    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★★★ ここが最重要修正点！ process.env を使って秘密情報を読み取る ★★★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    const callbackUrl = process.env.LINE_CALLBACK_URL;
    const channelId = process.env.LINE_CHANNEL_ID;
    const channelSecret = process.env.LINE_CHANNEL_SECRET;

    // 2. LINEに「通行証」を渡して、正式な「IDカード(id_token)」をもらう
    const tokenResponse = await axios.post("https://api.line.me/oauth2/v2.1/token", new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: callbackUrl,    // ★ 変更
      client_id: channelId,         // ★ 変更
      client_secret: channelSecret, // ★ 変更
    }));

    const idToken = tokenResponse.data.id_token;

    // 3. もらった「IDカード」を検証し、LINEのユーザーIDを取り出す
    const verifyResponse = await axios.post("https://api.line.me/oauth2/v2.1/verify", new URLSearchParams({
      id_token: idToken,
      client_id: channelId, // ★ 変更
    }));

    const lineUserId = verifyResponse.data.sub;

    // 4. LINEのユーザーIDを使って、Firebaseにユーザーを登録または取得する
    try {
      await admin.auth().getUser(lineUserId);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        await admin.auth().createUser({
          uid: lineUserId,
          displayName: verifyResponse.data.name,
          photoURL: verifyResponse.data.picture,
        });
      } else {
        throw error;
      }
    }

    // 5. Firebaseで使える「正式な身分証(customToken)」を発行する
    const firebaseToken = await admin.auth().createCustomToken(lineUserId);

    // 6. ウェブサイトに「身分証」を送り返す
    res.status(200).send({ data: { token: firebaseToken } });

  } catch (error) {
    console.error("認証エラー:", error.response ? error.response.data : error.message);
    res.status(500).send({ error: { message: "認証中にサーバーでエラーが発生しました。" } });
  }
});