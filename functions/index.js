// === 必要な道具を読み込む (v2 + secrets 対応版) ===
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params"); // ★ 秘密の金庫を使うための道具
const admin = require("firebase-admin");
const axios = require("axios");

// Firebaseアプリを初期化
admin.initializeApp();

// 全ての関数のリージョンを東京に設定
setGlobalOptions({ region: "asia-northeast1" });

// ★★★ 使う秘密の情報をここで宣言 ★★★
const lineChannelIdSecret = defineSecret("LINE_CHANNEL_ID");
const lineChannelSecretSecret = defineSecret("LINE_CHANNEL_SECRET");
const lineCallbackUrlSecret = defineSecret("LINE_CALLBACK_URL");

// === ここからが「入国審査官」の本体 ===
// ★★★ runWithを使って、どの秘密情報を使うかを関数に教える ★★★
exports.lineLoginCallback = onRequest({ secrets: [lineChannelIdSecret, lineChannelSecretSecret, lineCallbackUrlSecret], cors: true }, async (req, res) => {
  try {
    // 1. ウェブサイトから送られてきた「通行証(code)」を取り出す
    const code = req.body.data.code;
    if (!code) {
      console.error("認証コードが見つかりません。");
      res.status(400).send({ error: { message: "認証コードがありません。" } });
      return;
    }

    // ★★★ 金庫から値を取り出して使う ★★★
    const callbackUrl = lineCallbackUrlSecret.value();
    const channelId = lineChannelIdSecret.value();
    const channelSecret = lineChannelSecretSecret.value();

    // 2. LINEに「通行証」を渡して、正式な「IDカード(id_token)」をもらう
    const tokenResponse = await axios.post("https://api.line.me/oauth2/v2.1/token", new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: callbackUrl,
      client_id: channelId,
      client_secret: channelSecret,
    }));

    const idToken = tokenResponse.data.id_token;

    // 3. もらった「IDカード」を検証し、LINEのユーザーIDを取り出す
    const verifyResponse = await axios.post("https://api.line.me/oauth2/v2.1/verify", new URLSearchParams({
      id_token: idToken,
      client_id: channelId,
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