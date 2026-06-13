// ─── APP CORE ────────────────────────────────────────────────────────────────
// Handles: init, session, login, registration, role routing

const APP = {
  session: null,  // { user_id, school_id, role, name, username }
  _toastTimer: null,

  // ─── INIT ─────────────────────────────────────────────────────────
  async init() {
    try {
      APP.showScreen('screen-loading');
      await SYNC.initIDB();
      const online = await DB.ping();
      SYNC.isOnline = online;
      if (!online) {
        APP.showScreen('screen-offline');
        return;
      }
      APP.session = APP.loadSession();
      if (APP.session) {
        SYNC.startAutoSync();
        APP.route(APP.session.role);
      } else {
        APP.showScreen('screen-login');
      }
    } catch(e) {
      console.error('[APP] init crashed:', e);
      const splash = document.getElementById('screen-loading');
      if (splash) {
        splash.innerHTML = `
          <div style="text-align:center;padding:32px;color:#fff;">
            <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
            <div style="font-size:18px;font-weight:800;margin-bottom:8px;">Startup Error</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:24px;">
              ${e.message || 'Unknown error'}
            </div>
            <button onclick="location.reload()"
              style="background:rgba(124,58,237,0.8);color:#fff;border:none;
              padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
              ↺ Reload
            </button>
          </div>`;
      }
    }
  },

  // ─── SESSION ──────────────────────────────────────────────────────
  saveSession(user) {
    localStorage.setItem(CONFIG.LS_PREFIX + 'session', JSON.stringify(user));
    APP.session = user;
  },

  loadSession() {
    try {
      const s = localStorage.getItem(CONFIG.LS_PREFIX + 'session');
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  },

  clearSession() {
    localStorage.removeItem(CONFIG.LS_PREFIX + 'session');
    APP.session = null;
  },

  // ─── SCREEN ROUTER ────────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  },

  // ─── ROLE ROUTER ──────────────────────────────────────────────────
  route(role) {
    if (role === 'principal' && typeof PRINCIPAL !== 'undefined') {
      PRINCIPAL.init();
    } else if (role === 'teacher' && typeof TEACHER !== 'undefined') {
      TEACHER.init();
    } else if (role === 'parent' && typeof PARENT !== 'undefined') {
      PARENT.init();
    } else {
      APP.showScreen('screen-login');
    }
  },

  // ─── LOGOUT ───────────────────────────────────────────────────────
  logout() {
    SYNC.stopAutoSync();
    // stop QR scanner if running (teacher attendance or parent login)
    if (typeof TEACHER !== 'undefined' && TEACHER.qrStream) {
      TEACHER.stopQRScanner();
    }
    const qrLoginVideo = document.getElementById('qr-scan-video');
    if (qrLoginVideo) {
      const stream = qrLoginVideo.srcObject;
      if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
      qrLoginVideo.remove();
    }
    APP.clearSession();
    APP.showScreen('screen-login');
    APP.resetLoginForm();
  },

  resetLoginForm() {
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    const e = document.getElementById('login-error');
    if (u) u.value = '';
    if (p) p.value = '';
    if (e) e.textContent = '';
  },

  // ─── RETRY CONNECTION ─────────────────────────────────────────────
  retryConnection: async function() {
    const btn = document.querySelector('#screen-offline .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
    const online = await DB.ping();
    if (online) {
      APP.session = APP.loadSession();
      if (APP.session) { APP.route(APP.session.role); }
      else { APP.showScreen('screen-login'); }
    } else {
      if (btn) { btn.disabled = false; btn.textContent = '↺ Retry Connection'; }
      const msg = document.getElementById('offline-static');
      if (msg) msg.classList.add('show');
    }
  },

  // ─── QR SCAN (parent login) ───────────────────────────────────────
  startQRScan: async function() {
    const errEl = document.getElementById('parent-login-error');
    if (!errEl) return;
    errEl.textContent = 'QR scan: point camera at student card.';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errEl.textContent = 'Camera not supported on this device.';
      return;
    }
    let video = document.getElementById('qr-scan-video');
    if (!video) {
      video = document.createElement('video');
      video.id = 'qr-scan-video';
      video.className = 'qr-video';
      video.setAttribute('playsinline', true);
      document.getElementById('login-parent').appendChild(video);
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
    } catch (e) {
      errEl.textContent = 'Camera access denied. Please allow camera permission and try again.';
      video.remove();
      return;
    }
    video.srcObject = stream;
    video.play();
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const scan   = function() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code && code.data) {
          stream.getTracks().forEach(function(t) { t.stop(); });
          video.remove();
          // QR format: studentId|dob
          const parts = code.data.split('|');
          if (parts.length >= 2) {
            document.getElementById('parent-student-id').value = parts[0];
            document.getElementById('parent-dob').value        = parts[1];
            errEl.textContent = '';
            APP.parentLogin();
          } else {
            errEl.textContent = 'Invalid QR code. Use student ID card QR.';
          }
          return;
        }
      }
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  },

  // ─── LOGIN ────────────────────────────────────────────────────────
  async login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errEl    = document.getElementById('login-error');
    errEl.textContent = '';

    if (!username || !password) {
      errEl.textContent = 'Enter username and password.';
      return;
    }

    APP.setLoading('btn-login', true);

    // try localStorage first (offline fallback)
    const localUsers = APP.getLocalUsers();
    const localUser  = localUsers.find(function(u) {
      return u.username === username && u.password === password;
    });

    if (localUser) {
      APP.saveSession({
        user_id:   localUser.user_id,
        school_id: localUser.school_id,
        role:      localUser.role,
        name:      localUser.name,
        username:  localUser.username
      });
      APP.setLoading('btn-login', false);
      APP.route(localUser.role);
      return;
    }

    // try Supabase if online
    const online = await DB.ping();
    if (!online) {
      errEl.textContent = 'Offline and no local account found. Connect to internet for first login.';
      APP.setLoading('btn-login', false);
      return;
    }

    const res = await DB.getUserByUsername(username);
    if (res.error || !res.data || res.data.length === 0) {
      errEl.textContent = 'Invalid username or password.';
      APP.setLoading('btn-login', false);
      return;
    }

    const user = res.data[0];
    if (user.password !== password) {
      errEl.textContent = 'Invalid username or password.';
      APP.setLoading('btn-login', false);
      return;
    }

    APP.cacheUser(user);
    APP.saveSession({
      user_id:   user.user_id,
      school_id: user.school_id,
      role:      user.role,
      name:      user.name,
      username:  user.username
    });

    // cache core school data locally for offline use
    await APP.cacheSchoolData(user.school_id);

    APP.setLoading('btn-login', false);
    SYNC.startAutoSync();
    SYNC.runSync(); // force immediate sync to clear any pending queue
    APP.route(user.role);
  },

  // ─── CACHE SCHOOL DATA LOCALLY ────────────────────────────────────
  async cacheSchoolData(school_id) {
    try {
      const tables = ['schools', 'classes', 'students', 'attendance', 'marks', 'exams', 'subjects'];
      // explicit primary key map — do NOT derive from table name (classes → classe_id is wrong)
      const pkMap = {
        schools:    'school_id',
        classes:    'class_id',
        students:   'student_id',
        attendance: 'attendance_id',
        marks:      'mark_id',
        exams:      'exam_id',
        subjects:   'subject_id'
      };
      for (const table of tables) {
        const pk  = pkMap[table];
        if (!pk) continue;
        const res = await DB.request('GET', table, null, '?school_id=eq.' + school_id);
        if (!res.error && res.data && res.data.length > 0) {
          const existing = APP.getLocal(table);
          res.data.forEach(function(record) {
            const idx = existing.findIndex(function(r) { return r[pk] === record[pk]; });
            if (idx >= 0) { existing[idx] = record; } else { existing.push(record); }
          });
          APP.setLocal(table, existing);
        }
      }
    } catch(e) {
      console.warn('[APP] cacheSchoolData failed:', e);
    }
  },

  // ─── LOCAL USER CACHE ─────────────────────────────────────────────
  getLocalUsers() {
    try {
      const u = localStorage.getItem(CONFIG.LS_PREFIX + 'users');
      return u ? JSON.parse(u) : [];
    } catch (e) { return []; }
  },

  cacheUser(user) {
    const users  = APP.getLocalUsers();
    const exists = users.findIndex(function(u) { return u.user_id === user.user_id; });
    if (exists >= 0) { users[exists] = user; } else { users.push(user); }
    localStorage.setItem(CONFIG.LS_PREFIX + 'users', JSON.stringify(users));
  },

  // ─── SCHOOL REGISTRATION ──────────────────────────────────────────
  async register() {
    const schoolName = document.getElementById('reg-school-name').value.trim();
    const address    = document.getElementById('reg-address').value.trim();
    const prinName   = document.getElementById('reg-principal-name').value.trim();
    const username   = document.getElementById('reg-username').value.trim();
    const password   = document.getElementById('reg-password').value.trim();
    const errEl      = document.getElementById('reg-error');
    errEl.textContent = '';

    if (!schoolName || !prinName || !username || !password) {
      errEl.textContent = 'All fields except address are required.';
      return;
    }
    if (password.length < 4) {
      errEl.textContent = 'Password must be at least 4 characters.';
      return;
    }

    const online = await DB.ping();
    if (!online) {
      errEl.textContent = 'Internet required to register a new school.';
      return;
    }

    APP.setLoading('btn-register', true);

    const code = 'SCH' + Date.now().toString(36).toUpperCase();

    const userCheck = await DB.getUserByUsername(username);
    if (userCheck.data && userCheck.data.length > 0) {
      errEl.textContent = 'Username already taken. Choose another.';
      APP.setLoading('btn-register', false);
      return;
    }

    const schoolRes = await DB.createSchool(schoolName, code, address);
    if (schoolRes.error || !schoolRes.data || schoolRes.data.length === 0) {
      errEl.textContent = 'Failed to create school. Try again.';
      APP.setLoading('btn-register', false);
      return;
    }

    const school = schoolRes.data[0];

    // cache school locally so settings page can read it
    const schools = APP.getLocal('schools');
    const sidx    = schools.findIndex(function(s) { return s.school_id === school.school_id; });
    if (sidx >= 0) { schools[sidx] = school; } else { schools.push(school); }
    APP.setLocal('schools', schools);

    const userRes = await DB.createUser(
      school.school_id, prinName, 'principal', username, password, null
    );
    if (userRes.error || !userRes.data || userRes.data.length === 0) {
      errEl.textContent = 'Failed to create principal account. Try again.';
      APP.setLoading('btn-register', false);
      return;
    }

    const user = userRes.data[0];
    APP.cacheUser(user);
    APP.saveSession({
      user_id:   user.user_id,
      school_id: school.school_id,
      role:      'principal',
      name:      user.name,
      username:  user.username
    });

    APP.setLoading('btn-register', false);
    APP.showToast('School registered! Welcome, ' + prinName, 'ok');

    // cache school data locally before routing
    await APP.cacheSchoolData(school.school_id);

    PRINCIPAL.init();
  },

  // ─── LOCAL STORAGE HELPERS ────────────────────────────────────────
  getLocal(table) {
    try {
      const d = localStorage.getItem(CONFIG.LS_PREFIX + table);
      return d ? JSON.parse(d) : [];
    } catch (e) { return []; }
  },

  setLocal(table, data) {
    localStorage.setItem(CONFIG.LS_PREFIX + table, JSON.stringify(data));
  },

  upsertLocal(table, record, idField) {
    const data  = APP.getLocal(table);
    const index = data.findIndex(function(r) { return r[idField] === record[idField]; });
    if (index >= 0) { data[index] = record; } else { data.push(record); }
    APP.setLocal(table, data);
  },

  removeLocal(table, idField, idValue) {
    const data     = APP.getLocal(table);
    const filtered = data.filter(function(r) { return r[idField] !== idValue; });
    APP.setLocal(table, filtered);
  },

  getLocalBySchool(table, school_id) {
    return APP.getLocal(table).filter(function(r) { return r.school_id === school_id; });
  },

  // ─── WRITE HELPER (localStorage + sync queue) ─────────────────────
  async writeRecord(table, record, idField) {
    APP.upsertLocal(table, record, idField);
    const online = (typeof SYNC !== 'undefined' && SYNC.isOnline === true);
    if (online) {
      const res = await DB.syncRecord(table, record);
      if (res.error) {
        await SYNC.addToQueue(table, 'insert', record, record.school_id);
      }
    } else {
      await SYNC.addToQueue(table, 'insert', record, record.school_id);
    }
    SYNC.updateBanner();
  },

  // ─── DELETE HELPER ────────────────────────────────────────────────
  async deleteRecord(table, idField, idValue, school_id) {
    APP.removeLocal(table, idField, idValue);
    const record    = {};
    record[idField] = idValue;
    const online    = (typeof SYNC !== 'undefined' && SYNC.isOnline === true);
    if (online) {
      await DB.request('DELETE', table, null, '?' + idField + '=eq.' + idValue);
    } else {
      await SYNC.addToQueue(table, 'delete', record, school_id);
    }
    SYNC.updateBanner();
  },

  // ─── UI HELPERS ───────────────────────────────────────────────────
  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent;
      btn.textContent = 'Please wait...';
    } else {
      btn.textContent = btn.dataset.label || 'Submit';
    }
  },

  showToast(msg, type, duration) {
    type     = type     || 'default';
    duration = duration || 3000;
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = 'toast show' + (type !== 'default' ? ' toast-' + type : '');
    clearTimeout(APP._toastTimer);
    APP._toastTimer = setTimeout(function() {
      toast.className = 'toast';
    }, duration);
  },

  showModal(title, message, onConfirm, confirmLabel) {
    confirmLabel = confirmLabel || 'Confirm';
    document.getElementById('modal-title').textContent   = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-confirm').textContent = confirmLabel;
    document.getElementById('modal-confirm').onclick     = function() {
      APP.hideModal();
      if (onConfirm) onConfirm();
    };
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  // ─── UUID ─────────────────────────────────────────────────────────
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // ─── DATE — timezone-aware (IST = UTC+5:30) ───────────────────────
  today() {
    const now    = new Date();
    const offset = 5.5 * 60 * 60 * 1000; // IST offset in ms
    const ist    = new Date(now.getTime() + offset);
    return ist.toISOString().split('T')[0];
  }
};

// ─── BOOT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  APP.init();
});

// ─── PARENT LOGIN (StudentID + DOB) ──────────────────────────────────────────
APP.parentLogin = async function() {
  const studentId = document.getElementById('parent-student-id').value.trim();
  const dob       = document.getElementById('parent-dob').value;
  const errEl     = document.getElementById('parent-login-error');
  errEl.textContent = '';

  if (!studentId || !dob) {
    errEl.textContent = 'Enter Student ID and Date of Birth.';
    return;
  }

  const online = await DB.ping();
  if (!online) {
    errEl.textContent = 'Internet required for parent login.';
    return;
  }

  APP.setLoading('btn-parent-login', true);

  const res = await DB.request('GET', 'students', null,
    '?student_id=eq.' + studentId + '&dob=eq.' + dob);

  if (res.error || !res.data || res.data.length === 0) {
    errEl.textContent = 'Student not found. Check ID and date of birth.';
    APP.setLoading('btn-parent-login', false);
    return;
  }

  const student = res.data[0];

  APP.saveSession({
    user_id:    student.student_id,
    student_id: student.student_id,
    school_id:  student.school_id,
    role:       'parent',
    name:       student.name,
    username:   'parent_' + student.student_id
  });

  APP.setLoading('btn-parent-login', false);
  PARENT.init();
};