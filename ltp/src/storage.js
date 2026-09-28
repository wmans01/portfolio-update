const DB_NAME = 'ltplayer-local-files';
const STORE_NAME = 'uploads';
let databasePromise;

function database() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Browser storage is unavailable'));
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open browser storage'));
  }).catch(error => { databasePromise = undefined; throw error; });
  return databasePromise;
}

function transactionPromise(transaction, request) {
  return new Promise((resolve, reject) => {
    let result;
    request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Storage failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Storage was cancelled'));
  });
}

export async function getUploads() {
  const db = await database();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  return transactionPromise(transaction, transaction.objectStore(STORE_NAME).getAll());
}

export async function putUpload(record) {
  const db = await database();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  await transactionPromise(transaction, transaction.objectStore(STORE_NAME).put(record));
}

export async function removeUpload(id) {
  const db = await database();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  await transactionPromise(transaction, transaction.objectStore(STORE_NAME).delete(id));
}
