
// myShopCare - Offline Queue with IndexedDB
const IDB_NAME = 'myshopcare-offline';
const IDB_STORE = 'sync_queue';
let db = null;

// Initialize IndexedDB
async function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        const store = database.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type');
        console.log('🔄 IndexedDB store created');
      }
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('✅ IndexedDB initialized');
      resolve(db);
    };
    
    request.onerror = (event) => {
      console.error('❌ IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Queue an action for later sync
async function queueAction(actionType, data) {
  if (!db) await openIDB();
  
  const tx = db.transaction([IDB_STORE], 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  
  const item = {
    type: actionType,
    data,
    timestamp: Date.now(),
    status: 'pending'
  };
  
  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => {
      console.log('📦 Action queued:', actionType);
      resolve();
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// Get all queued actions
async function getQueuedActions() {
  if (!db) await openIDB();
  
  const tx = db.transaction([IDB_STORE], 'readonly');
  const store = tx.objectStore(IDB_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.timestamp - b.timestamp));
    request.onerror = () => reject(request.error);
  });
}

// Remove an action from the queue
async function removeQueuedAction(id) {
  if (!db) await openIDB();
  
  const tx = db.transaction([IDB_STORE], 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Process the queue
async function processQueue() {
  if (!db) await openIDB();
  if (!navigator.onLine) return;
  
  const actions = await getQueuedActions();
  console.log(`🔄 Processing ${actions.length} queued actions...`);
  
  for (const action of actions) {
    try {
      await processSingleAction(action);
      await removeQueuedAction(action.id);
      console.log(`✅ Processed queued action: ${action.type}`);
    } catch (err) {
      console.error(`❌ Failed to process ${action.type}:`, err);
    }
  }
}

// Process a single action based on type
async function processSingleAction(action) {
  switch (action.type) {
    case 'sale':
      return await recordQueuedSale(action.data);
    case 'purchase':
      return await recordQueuedPurchase(action.data);
    case 'debt-payment':
      return await recordQueuedDebtPayment(action.data);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// Initialize queue monitoring
async function initQueue() {
  await openIDB();
  
  // Process queue on reconnect
  window.addEventListener('online', async () => {
    showToast('🔄 Mtandao umepatikana, inasindikisha data...');
    await processQueue();
    showToast('✅ Data zote zimesindikisha!');
  });
  
  // Process queue on load if online
  if (navigator.onLine) {
    await processQueue();
  }
  
  console.log('📦 Offline queue initialized');
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQueue);
} else {
  initQueue();
}
