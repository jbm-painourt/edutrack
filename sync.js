// ─── SYNC MODULE ─────────────────────────────────────────────────────────────
// Handles: IndexedDB queue, offline detection, auto-sync, sync banner

const SYNC = {
  db:           null,     // IDB instance
  isOnline:     false,    // current connectivity state
  lastSyncTime: null,     // timestamp of last successful sync
  _autoTimer:   null,     // setInterval handle for auto-sync
  _pingTimer:   null,     // setInterval handle for ping checks

  // ─── INIT IDB ────────────────────────────────────────────────────────
  initIDB() {
    return new Promise(function(resolve, reject) {
      if (!window.indexedDB) {
        console.warn('[SYNC] IndexedDB not supported — sync queue disabled');
        resolve();
        return;
      }

      const req = window.indexedDB.open(CONFIG.IDB_NAME, CONFIG.IDB_VERSION);

      req.onupgradeneeded = function(e) {
        const db    = e.target.result;
        if (!db.objectStoreNames.contains(CONFIG.IDB_STORE)) {
          const store = db.createObjectStore(CONFIG.IDB_STORE, {
            keyPath:       'queue_id',
            autoIncrement: true
          });
          store.createIndex('status',     'status',     { unique: false });
          store.createIndex('school_id',  'school_id',  { unique: false });
          store.createIndex('table_name', 'table_name', { unique: false });
        }
      };

      req.onsuccess = function(e) {
        SYNC.db = e.target.result;
        console.log('[SYNC] IDB ready');
        resolve();
      };

      req.onerror = function(e) {
        console.error('[SYNC] IDB open error:', e.target.error);
        resolve(); // resolve anyway — app works without IDB, just no offline queue
      };
    });
  },

  // ─── ADD TO QUEUE ─────────────────────────────────────────────────────
  addToQueue(table, operation, record, school_id) {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const item  = {
          table_name: table,
          operation:  operation,   // 'insert' | 'delete'
          record:     record,
          school_id:  school_id,
          status:     'pending',   // 'pending' | 'synced' | 'failed'
          retries:    0,
          created_at: new Date().toISOString()
        };
        const req = store.add(item);
        req.onsuccess = function() { resolve(); };
        req.onerror   = function(e) {
          console.error('[SYNC] addToQueue error:', e.target.error);
          resolve();
        };
        tx.onerror = function(e) {
          console.error('[SYNC] addToQueue tx error:', e.target.error);
          resolve();
        };
      } catch(e) {
        console.error('[SYNC] addToQueue exception:', e);
        resolve();
      }
    });
  },

  // ─── GET PENDING COUNT ────────────────────────────────────────────────
  getPendingCount() {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(0); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const idx   = store.index('status');
        const req   = idx.count(IDBKeyRange.only('pending'));
        req.onsuccess = function() { resolve(req.result || 0); };
        req.onerror   = function()  { resolve(0); };
      } catch(e) { resolve(0); }
    });
  },

  // ─── GET PENDING SIZE (KB) ────────────────────────────────────────────
  getPendingSizeKB() {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(0); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const idx   = store.index('status');
        const req   = idx.getAll(IDBKeyRange.only('pending'));
        req.onsuccess = function() {
          const items = req.result || [];
          const bytes = JSON.stringify(items).length;
          resolve(Math.round(bytes / 1024));
        };
        req.onerror = function() { resolve(0); };
      } catch(e) { resolve(0); }
    });
  },

  // ─── GET STATS ────────────────────────────────────────────────────────
  getStats() {
    return new Promise(function(resolve) {
      if (!SYNC.db) {
        resolve({ pending: 0, synced: 0, failed: 0, total: 0 });
        return;
      }
      try {
        const tx      = SYNC.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store   = tx.objectStore(CONFIG.IDB_STORE);
        const allReq  = store.getAll();
        allReq.onsuccess = function() {
          const all     = allReq.result || [];
          const pending = all.filter(function(i) { return i.status === 'pending'; }).length;
          const synced  = all.filter(function(i) { return i.status === 'synced';  }).length;
          const failed  = all.filter(function(i) { return i.status === 'failed';  }).length;
          resolve({ pending: pending, synced: synced, failed: failed, total: all.length });
        };
        allReq.onerror = function() {
          resolve({ pending: 0, synced: 0, failed: 0, total: 0 });
        };
      } catch(e) {
        resolve({ pending: 0, synced: 0, failed: 0, total: 0 });
      }
    });
  },

  // ─── STUDENT HAS PENDING ──────────────────────────────────────────────
  studentHasPending(student_id) {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(false); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const req   = store.getAll();
        req.onsuccess = function() {
          const items = req.result || [];
          const found = items.some(function(i) {
            return i.status === 'pending' &&
                   i.record &&
                   i.record.student_id === student_id;
          });
          resolve(found);
        };
        req.onerror = function() { resolve(false); };
      } catch(e) { resolve(false); }
    });
  },

  // ─── REMOVE PENDING FOR STUDENT ───────────────────────────────────────
  removePendingForStudent(student_id) {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const req   = store.openCursor();
        req.onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.record &&
                cursor.value.record.student_id === student_id) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = function() { resolve(); };
        tx.onerror  = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  },

  // ─── RUN SYNC ─────────────────────────────────────────────────────────
  async runSync() {
    if (!SYNC.db) return;
    const online = await DB.ping();
    SYNC.isOnline = online;
    SYNC.updateBanner();
    if (!online) return;

    const items = await SYNC._getPendingItems();
    if (items.length === 0) {
      SYNC.lastSyncTime = Date.now();
      return;
    }

    console.log('[SYNC] syncing', items.length, 'pending items');

    for (const item of items) {
      let success = false;
      try {
        if (item.operation === 'insert') {
          const res = await DB.syncRecord(item.table_name, item.record);
          success   = !res.error;
        } else if (item.operation === 'delete') {
          const pk  = SYNC._getPrimaryKey(item.table_name);
          const val = item.record[pk];
          if (pk && val) {
            const res = await DB.request('DELETE', item.table_name, null,
              '?' + pk + '=eq.' + val);
            success = !res.error;
          } else {
            success = true; // no pk — skip
          }
        }
      } catch(e) {
        console.error('[SYNC] sync item error:', e);
        success = false;
      }

      if (success) {
        await SYNC._markItemStatus(item.queue_id, 'synced');
      } else {
        const newRetries = (item.retries || 0) + 1;
        if (newRetries >= CONFIG.MAX_RETRIES) {
          await SYNC._markItemStatus(item.queue_id, 'failed');
        } else {
          await SYNC._updateRetries(item.queue_id, newRetries);
        }
      }
    }

    SYNC.lastSyncTime = Date.now();
    SYNC.updateBanner();
    console.log('[SYNC] sync complete');
  },

  // ─── GET PENDING ITEMS ────────────────────────────────────────────────
  _getPendingItems() {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve([]); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readonly');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const idx   = store.index('status');
        const req   = idx.getAll(IDBKeyRange.only('pending'));
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror   = function() { resolve([]); };
      } catch(e) { resolve([]); }
    });
  },

  // ─── MARK ITEM STATUS ─────────────────────────────────────────────────
  _markItemStatus(queue_id, status) {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const req   = store.get(queue_id);
        req.onsuccess = function() {
          const item = req.result;
          if (item) {
            item.status     = status;
            item.updated_at = new Date().toISOString();
            store.put(item);
          }
          resolve();
        };
        req.onerror = function() { resolve(); };
        tx.onerror  = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  },

  // ─── UPDATE RETRIES ───────────────────────────────────────────────────
  _updateRetries(queue_id, retries) {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(); return; }
      try {
        const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG.IDB_STORE);
        const req   = store.get(queue_id);
        req.onsuccess = function() {
          const item = req.result;
          if (item) {
            item.retries    = retries;
            item.updated_at = new Date().toISOString();
            store.put(item);
          }
          resolve();
        };
        req.onerror = function() { resolve(); };
        tx.onerror  = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  },

  // ─── GET PRIMARY KEY FOR TABLE ────────────────────────────────────────
  _getPrimaryKey(table) {
    const map = {
      schools:    'school_id',
      users:      'user_id',
      classes:    'class_id',
      students:   'student_id',
      attendance: 'attendance_id',
      marks:      'mark_id',
      exams:      'exam_id',
      subjects:   'subject_id'
    };
    return map[table] || null;
  },

  // ─── AUTO SYNC ────────────────────────────────────────────────────────
  startAutoSync() {
    // run immediately on start
    SYNC.runSync();

    // ping check every 10 seconds to update online status
    SYNC._pingTimer = setInterval(async function() {
      const online  = await DB.ping();
      const changed = online !== SYNC.isOnline;
      SYNC.isOnline = online;
      if (changed) SYNC.updateBanner();
    }, 10000);

    // full sync every 30 seconds
    SYNC._autoTimer = setInterval(function() {
      if (SYNC.isOnline) SYNC.runSync();
    }, CONFIG.SYNC_INTERVAL);

    // also sync when browser comes back online
    window.addEventListener('online', function() {
      SYNC.isOnline = true;
      SYNC.updateBanner();
      SYNC.runSync();
    });

    window.addEventListener('offline', function() {
      SYNC.isOnline = false;
      SYNC.updateBanner();
    });
  },

  stopAutoSync() {
    if (SYNC._autoTimer) { clearInterval(SYNC._autoTimer); SYNC._autoTimer = null; }
    if (SYNC._pingTimer) { clearInterval(SYNC._pingTimer); SYNC._pingTimer = null; }
  },

  // ─── UPDATE SYNC BANNER ───────────────────────────────────────────────
  updateBanner() {
    const banner = document.getElementById('sync-banner');
    if (!banner) return;

    SYNC.getPendingCount().then(function(pending) {
      if (!SYNC.isOnline) {
        banner.className   = 'sync-banner offline';
        banner.textContent = '🔴 Offline — changes saved locally, will sync when connected';
      } else if (pending > 0) {
        banner.className   = 'sync-banner pending';
        banner.textContent = '🟡 Online — ' + pending + ' record(s) pending sync';
      } else {
        banner.className   = 'sync-banner synced';
        banner.textContent = '🟢 Online — all data synced';
      }
    });
  }
};