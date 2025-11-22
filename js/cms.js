/**
 * CMS (Content Management System) Logic
 * Firestoreを使用してUIテキストと企画データを管理する
 */
import { firestore, doc, setDoc, collection, addDoc, updateDoc, deleteDoc } from './firebase-client.js';
import { fetchNomineesFromFirestore, fetchUiText, fetchNomineesFromJSON } from './api.js';

// Re-export fetching functions for admin.js convenience
export { fetchNomineesFromFirestore, fetchUiText };

// --- UI Text Management ---

/**
 * UIテキスト設定を保存する
 * @param {Object} textData 保存するテキストデータ
 */
export async function saveUiText(textData) {
    try {
        const docRef = doc(firestore, 'system_config', 'ui_text');
        await setDoc(docRef, textData, { merge: true });
        console.log('UI Text saved successfully.');
    } catch (error) {
        console.error('Error saving UI text:', error);
        throw error;
    }
}

// --- Nominee Management ---

/**
 * 企画を追加する
 * @param {Object} nomineeData 
 */
export async function addNominee(nomineeData) {
    try {
        const docRef = await addDoc(collection(firestore, 'nominees'), nomineeData);
        console.log('Nominee added with ID: ', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error adding nominee:', error);
        throw error;
    }
}

/**
 * 企画を更新する
 * @param {string} id ドキュメントID
 * @param {Object} nomineeData 更新データ
 */
export async function updateNominee(id, nomineeData) {
    try {
        const docRef = doc(firestore, 'nominees', id);
        await updateDoc(docRef, nomineeData);
        console.log('Nominee updated successfully.');
    } catch (error) {
        console.error('Error updating nominee:', error);
        throw error;
    }
}

/**
 * 企画を削除する
 * @param {string} id ドキュメントID
 */
export async function deleteNominee(id) {
    try {
        await deleteDoc(doc(firestore, 'nominees', id));
        console.log('Nominee deleted successfully.');
    } catch (error) {
        console.error('Error deleting nominee:', error);
        throw error;
    }
}

/**
 * data.json の内容を Firestore に移行する（初期化用）
 * @param {Object} jsonData data.jsonの中身
 */
export async function migrateDataToFirestore(jsonData) {
    try {
        const batchPromises = [];

        for (const department in jsonData) {
            const list = jsonData[department];
            for (const item of list) {
                // 既存のIDは無視して新規作成するか、IDを指定するか。
                // ここではIDは自動生成し、departmentフィールドを追加する。
                const newItem = { ...item, department: department };
                // idフィールドがもしあれば削除（Firestore IDと混同しないため）
                delete newItem.id;

                batchPromises.push(addDoc(collection(firestore, 'nominees'), newItem));
            }
        }

        await Promise.all(batchPromises);
        console.log('Migration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
