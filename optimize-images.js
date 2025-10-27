// optimize-images.js

const fs = require('fs-extra');
const path = require('path');
const Papa = require('papaparse');
const sharp = require('sharp');

// --- 設定項目 ---
const inputFile = '工大祭2025 参加団体情報-グランプリ共有用 のコピー.csv'; // 元となるCSVファイル名
const outputDir = 'optimized_icons'; // 最適化された画像を保存するフォルダ
const outputJsonFile = 'data.json'; // 最終的に生成されるJSONファイル
const imageSize = 100; // 画像のサイズ（ピクセル）

// 部門を判定するロジック
function getDepartment(id) {
  if (id.startsWith('M-')) return 'mogiten';
  if (id.startsWith('I-')) return 'tenji';
  if (id.startsWith('S-')) return 'stage';
  if (id.startsWith('L-')) return 'academic';
  return null;
}

async function processImages() {
  console.log('スクリプトを開始します...');

  // 1. 出力フォルダを準備（すでにあれば中身を空にする）
  await fs.emptyDir(outputDir);
  console.log(`出力フォルダ '${outputDir}' を準備しました。`);

  // 2. CSVファイルを読み込む
  const csvFile = await fs.readFile(inputFile, 'utf8');
  const csvData = Papa.parse(csvFile, { header: true }).data;
  console.log(`CSVファイルから ${csvData.length} 件のデータを読み込みました。`);

  const allNominees = { mogiten: [], tenji: [], stage: [], academic: [] };

  // 3. 各行のデータを処理
  for (const row of csvData) {
    const id = row['企画番号'];
    const organizationName = row['団体名'];
    const planName = row['企画名'];
    const originalIconUrl = row['アイコン'];
    const department = getDepartment(id);

    if (!id || !originalIconUrl || !department) {
      console.warn(`[スキップ] データが不完全な行: ${JSON.stringify(row)}`);
      continue;
    }

    const outputFileName = `${id}.webp`;
    const outputPath = path.join(outputDir, outputFileName);
    const publicPath = `optimized_icons/${outputFileName}`; // HTMLから見たパス

    try {
      // 4. URLから画像をダウンロード
      const response = await fetch(originalIconUrl);
      if (!response.ok) throw new Error(`画像のダウンロードに失敗: ${response.statusText}`);
      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // 5. 画像をリサイズし、WebPに変換して保存
      await sharp(imageBuffer)
        .resize(imageSize, imageSize)
        .webp({ quality: 80 }) // qualityは1-100で指定
        .toFile(outputPath);

      // 6. JSONデータを構築
      allNominees[department].push({
        id: id,
        organization_name: organizationName,
        plan_name: planName,
        icon_url: publicPath, // 最適化されたローカルパスに差し替え
      });

      console.log(`[成功] ${id} の画像を最適化しました。`);

    } catch (error) {
      console.error(`[失敗] ${id} の処理中にエラーが発生しました: ${error.message}`);
      // エラーが発生しても、アイコンなしのデータとして追加する場合
      allNominees[department].push({
        id: id,
        organization_name: organizationName,
        plan_name: planName,
        icon_url: null, // アイコンURLは無しに
      });
    }
  }

  // 7. 最終的なJSONファイルを出力
  await fs.writeJson(outputJsonFile, allNominees, { spaces: 2 });
  console.log(`\n処理が完了しました！`);
  console.log(`- 最適化された画像が '${outputDir}' フォルダに保存されました。`);
  console.log(`- 新しい '${outputJsonFile}' が生成されました。`);
  console.log(`\nウェブサーバーに '${outputDir}' フォルダと '${outputJsonFile}' をアップロードしてください。`);
}

processImages();