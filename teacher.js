// ─── TEACHER MODULE v2.1 ─────────────────────────────────────────────────────
const TEACHER = {
  activeTab:     'dashboard',
  attendanceMap: {},
  qrStream:      null,
  qrAnimFrame:   null,

  // ─── INIT ───────────────────────────────────────────────────────────
  async init() {
    APP.showScreen('screen-teacher');
    TEACHER.renderShell();
    await TEACHER.loadTab('dashboard');
  },

  // ─── SHELL ──────────────────────────────────────────────────────────
  renderShell() {
    const screen = document.getElementById('screen-teacher');
    screen.innerHTML = `
      <div class="app-header">
        <div class="app-logo-sm">ET</div>
        <span class="app-title">Edu<span>Track</span></span>
        <span class="role-badge teacher">Teacher</span>
        <button class="btn-icon" onclick="APP.logout()">Out</button>
      </div>
      <div id="sync-banner" class="sync-banner"></div>
      <div id="teacher-content" class="tab-content"></div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-tab="dashboard"  onclick="TEACHER.loadTab('dashboard')">
          <span>🏠</span><small>Home</small>
        </button>
        <button class="nav-btn" data-tab="students"          onclick="TEACHER.loadTab('students')">
          <span>👥</span><small>Students</small>
        </button>
        <button class="nav-btn" data-tab="attendance"        onclick="TEACHER.loadTab('attendance')">
          <span>📋</span><small>Attendance</small>
        </button>
        <button class="nav-btn" data-tab="marks"             onclick="TEACHER.loadTab('marks')">
          <span>📝</span><small>Marks</small>
        </button>
        <button class="nav-btn" data-tab="more"              onclick="TEACHER.loadTab('more')">
          <span>☰</span><small>More</small>
        </button>
      </nav>
    `;
    SYNC.updateBanner();
  },

  // ─── TAB LOADER ─────────────────────────────────────────────────────
  async loadTab(tab) {
    if (TEACHER.activeTab === 'attendance' && tab !== 'attendance') {
      TEACHER.stopQRScanner();
    }
    TEACHER.activeTab = tab;
    document.querySelectorAll('#screen-teacher .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const content = document.getElementById('teacher-content');
    content.innerHTML = '<div class="loading">Loading...</div>';
    if      (tab === 'dashboard')  await TEACHER.renderDashboard();
    else if (tab === 'students')   await TEACHER.renderStudents();
    else if (tab === 'attendance') await TEACHER.renderAttendance();
    else if (tab === 'marks')      await TEACHER.renderMarks();
    else if (tab === 'more')       await TEACHER.renderMore();
  },

  // ─── DASHBOARD ──────────────────────────────────────────────────────
  async renderDashboard() {
    const sid     = APP.session.school_id;
    const today   = APP.today();
    const content = document.getElementById('teacher-content');

    const students = APP.getLocalBySchool('students',   sid);
    const classes  = APP.getLocalBySchool('classes',    sid);
    const todayAtt = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.date === today;
    });
    const pending  = await SYNC.getPendingCount();
    const present  = todayAtt.filter(function(a) { return a.status === 'present'; }).length;
    const absent   = todayAtt.filter(function(a) { return a.status === 'absent';  }).length;

    content.innerHTML = `
      <div class="section-block">
        <h2 class="section-title">Hi, ${APP.session.name} 👋</h2>
        <p class="section-sub">${today}</p>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${students.length}</div>
            <div class="stat-label">My Students</div>
          </div>
          <div class="stat-card stat-ok">
            <div class="stat-number">${present}</div>
            <div class="stat-label">Present Today</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-number">${absent}</div>
            <div class="stat-label">Absent Today</div>
          </div>
          <div class="stat-card ${pending > 0 ? 'stat-warn' : ''}">
            <div class="stat-number">${pending}</div>
            <div class="stat-label">Pending Sync</div>
          </div>
        </div>
        <div class="section-block">
          <div class="section-header">
            <h3 class="section-subtitle">My Classes</h3>
          </div>
          ${classes.length === 0
            ? '<p class="empty-msg">No classes yet. Principal needs to create classes.</p>'
            : `<ul class="simple-list">
                ${classes.map(function(c) {
                  const count = students.filter(function(s) { return s.class_id === c.class_id; }).length;
                  return `<li><span>${c.name}</span><small>${count} student(s)</small></li>`;
                }).join('')}
              </ul>`
          }
        </div>
      </div>
    `;
  },

  // ─── STUDENTS ───────────────────────────────────────────────────────
  async renderStudents() {
    const sid      = APP.session.school_id;
    const content  = document.getElementById('teacher-content');
    const students = APP.getLocalBySchool('students', sid);
    const classes  = APP.getLocalBySchool('classes',  sid);

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Students</h2>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary-sm" onclick="TEACHER.printAllQRCards()">🖨 Print All QR</button>
            <button class="btn-primary-sm"   onclick="TEACHER.showAddStudent()">+ Add</button>
          </div>
        </div>

        <!-- Search bar -->
        <input id="student-search" class="input" type="text"
          placeholder="🔍 Search students by name or roll no..."
          oninput="TEACHER.filterStudents()" style="margin-bottom:12px;" />

        <!-- Add student form -->
        <div id="add-student-form" class="form-card hidden">
          <h3>New Student</h3>
          <div class="two-col">
            <input id="s-name"    class="input" type="text" placeholder="Full name *" />
            <input id="s-roll"    class="input" type="text" placeholder="Roll No *" />
          </div>
          <div class="two-col">
            <input id="s-dob"     class="input" type="date" />
            <input id="s-phone"   class="input" type="tel"  placeholder="Parent phone" />
          </div>
          <select id="s-class" class="input">
            <option value="">-- Select Class *--</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
          <div id="s-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="TEACHER.hideAddStudent()">Cancel</button>
            <button class="btn-primary"   onclick="TEACHER.addStudent()">Create Student</button>
          </div>
        </div>

        <!-- Student list -->
        <div id="students-list-container">
          ${TEACHER._renderStudentList(students, classes)}
        </div>
      </div>
    `;
  },

  _renderStudentList(students, classes, query) {
    let filtered = students;
    if (query && query.trim()) {
      const q = query.toLowerCase();
      filtered = students.filter(function(s) {
        return s.name.toLowerCase().includes(q) ||
               (s.roll_no && s.roll_no.toLowerCase().includes(q));
      });
    }
    if (filtered.length === 0) {
      return '<p class="empty-msg">' + (query ? 'No students match your search.' : 'No students yet. Add one above.') + '</p>';
    }
    return `<div class="list-cards">
      ${filtered.map(function(s) {
        const cls = classes.find(function(c) { return c.class_id === s.class_id; });
        return `<div class="list-card">
          <div class="list-card-info">
            <strong>${s.name}</strong>
            <small>Roll: ${s.roll_no || '—'} &bull; ${cls ? cls.name : 'No class'}</small>
            <small>DOB: ${s.dob || '—'} &bull; Parent: ${s.parent_phone || '—'}</small>
          </div>
          <div class="list-card-actions">
            <button class="btn-secondary-sm"
              onclick="TEACHER.showQR('${s.student_id}','${s.name.replace(/'/g,"\\'")}','${s.dob||''}')">
              QR
            </button>
            <button class="btn-primary-sm"
              onclick="TEACHER.showEditStudent('${s.student_id}')">
              ✏️
            </button>
            <button class="btn-danger-sm"
              onclick="TEACHER.deleteStudent('${s.student_id}','${s.name.replace(/'/g,"\\'")}')">
              Del
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div id="qr-display"></div>`;
  },

  filterStudents() {
    const sid      = APP.session.school_id;
    const query    = document.getElementById('student-search').value;
    const students = APP.getLocalBySchool('students', sid);
    const classes  = APP.getLocalBySchool('classes',  sid);
    document.getElementById('students-list-container').innerHTML =
      TEACHER._renderStudentList(students, classes, query);
  },

  showAddStudent() {
    document.getElementById('add-student-form').classList.remove('hidden');
  },

  hideAddStudent() {
    document.getElementById('add-student-form').classList.add('hidden');
    ['s-name','s-roll','s-phone'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const dob = document.getElementById('s-dob');
    if (dob) dob.value = '';
    document.getElementById('s-class').selectedIndex = 0;
    document.getElementById('s-error').textContent   = '';
  },

  async addStudent() {
    const name    = document.getElementById('s-name').value.trim();
    const roll    = document.getElementById('s-roll').value.trim();
    const dob     = document.getElementById('s-dob').value;
    const phone   = document.getElementById('s-phone').value.trim();
    const classId = document.getElementById('s-class').value;
    const errEl   = document.getElementById('s-error');
    errEl.textContent = '';

    if (!name)    { errEl.textContent = 'Name is required.';     return; }
    if (!roll)    { errEl.textContent = 'Roll No is required.';  return; }
    if (!classId) { errEl.textContent = 'Select a class.';       return; }

    // duplicate check — same name OR same roll in same class
    const sid      = APP.session.school_id;
    const existing = APP.getLocalBySchool('students', sid);
    const dupName  = existing.find(function(s) {
      return s.class_id === classId && s.name.toLowerCase() === name.toLowerCase();
    });
    const dupRoll  = existing.find(function(s) {
      return s.class_id === classId && s.roll_no === roll;
    });
    if (dupName) { errEl.textContent = 'A student with this name already exists in this class.'; return; }
    if (dupRoll) { errEl.textContent = 'Roll No ' + roll + ' already taken in this class.';     return; }

    const record = {
      student_id:   APP.uuid(),
      school_id:    sid,
      class_id:     classId,
      name:         name,
      roll_no:      roll,
      dob:          dob || null,
      parent_phone: phone || null,
      created_at:   new Date().toISOString()
    };

    await APP.writeRecord('students', record, 'student_id');
    APP.showToast(name + ' added.', 'ok');
    TEACHER.hideAddStudent();
    await TEACHER.renderStudents();
  },

  async deleteStudent(student_id, name) {
    APP.showModal('Delete Student',
      'Delete ' + name + ' and all their records? This cannot be undone.',
      async function() {
        APP.removeLocal('students',   'student_id', student_id);
        APP.removeLocal('attendance', 'student_id', student_id);
        APP.removeLocal('marks',      'student_id', student_id);
        if (SYNC.isOnline) {
          await DB.deleteStudentCascade(student_id);
        } else {
          await SYNC.addToQueue('students', 'delete', { student_id: student_id }, APP.session.school_id);
        }
        APP.showToast('Student deleted.', 'ok');
        await TEACHER.renderStudents();
      }, 'Delete');
  },

  // ─── EDIT STUDENT ────────────────────────────────────────────────────
  showEditStudent(student_id) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const s        = students.find(function(st) { return st.student_id === student_id; });
    if (!s) { APP.showToast('Student not found.', 'error'); return; }

    const classes  = APP.getLocalBySchool('classes', sid);

    // close add form if open
    const addForm = document.getElementById('add-student-form');
    if (addForm) addForm.classList.add('hidden');

    // remove any existing edit form
    const existing = document.getElementById('edit-student-form');
    if (existing) existing.remove();

    // inject edit form below search bar
    const container = document.getElementById('students-list-container');
    const formDiv   = document.createElement('div');
    formDiv.id      = 'edit-student-form';
    formDiv.className = 'form-card';
    formDiv.innerHTML = `
      <h3>Edit Student</h3>
      <div class="two-col">
        <input id="es-name"  class="input" type="text" placeholder="Full name *"
          value="${s.name.replace(/"/g, '&quot;')}" />
        <input id="es-roll"  class="input" type="text" placeholder="Roll No *"
          value="${s.roll_no || ''}" />
      </div>
      <div class="two-col">
        <input id="es-dob"   class="input" type="date"
          value="${s.dob || ''}" />
        <input id="es-phone" class="input" type="tel" placeholder="Parent phone"
          value="${s.parent_phone || ''}" />
      </div>
      <select id="es-class" class="input">
        <option value="">-- Select Class *--</option>
        ${classes.map(function(c) {
          return `<option value="${c.class_id}" ${c.class_id === s.class_id ? 'selected' : ''}>
            ${c.name}
          </option>`;
        }).join('')}
      </select>
      <div id="es-error" class="error-msg"></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="document.getElementById('edit-student-form').remove()">
          Cancel
        </button>
        <button class="btn-primary"
          onclick="TEACHER.saveEditStudent('${student_id}')">
          💾 Save Changes
        </button>
      </div>
    `;
    container.insertAdjacentElement('beforebegin', formDiv);
    formDiv.scrollIntoView({ behavior: 'smooth' });
  },

  async saveEditStudent(student_id) {
    const name    = document.getElementById('es-name').value.trim();
    const roll    = document.getElementById('es-roll').value.trim();
    const dob     = document.getElementById('es-dob').value;
    const phone   = document.getElementById('es-phone').value.trim();
    const classId = document.getElementById('es-class').value;
    const errEl   = document.getElementById('es-error');
    errEl.textContent = '';

    if (!name)    { errEl.textContent = 'Name is required.';    return; }
    if (!roll)    { errEl.textContent = 'Roll No is required.'; return; }
    if (!classId) { errEl.textContent = 'Select a class.';      return; }

    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const original = students.find(function(s) { return s.student_id === student_id; });
    if (!original) { errEl.textContent = 'Student not found.'; return; }

    // duplicate check — exclude self
    const dupName = students.find(function(s) {
      return s.student_id !== student_id &&
             s.class_id   === classId &&
             s.name.toLowerCase() === name.toLowerCase();
    });
    const dupRoll = students.find(function(s) {
      return s.student_id !== student_id &&
             s.class_id   === classId &&
             s.roll_no    === roll;
    });
    if (dupName) { errEl.textContent = 'Another student with this name exists in this class.'; return; }
    if (dupRoll) { errEl.textContent = 'Roll No ' + roll + ' already taken in this class.';   return; }

    // preserve original student_id, school_id, created_at — only update editable fields
    const updated = {
      student_id:   original.student_id,
      school_id:    original.school_id,
      class_id:     classId,
      name:         name,
      roll_no:      roll,
      dob:          dob || null,
      parent_phone: phone || null,
      created_at:   original.created_at,
      updated_at:   new Date().toISOString()
    };

    await APP.writeRecord('students', updated, 'student_id');
    APP.showToast(name + ' updated.', 'ok');
    document.getElementById('edit-student-form').remove();
    await TEACHER.renderStudents();
  },

  // ─── QR CODE ────────────────────────────────────────────────────────
  showQR(student_id, name, dob) {
    const area = document.getElementById('qr-display');
    if (!area) return;
    area.innerHTML = `
      <div class="qr-card">
        <h3>${name}</h3>
        <canvas id="qr-canvas-${student_id}"></canvas>
        <p class="qr-id">ID: ${student_id}</p>
        <small style="color:var(--text2);">Scan to mark attendance or for parent login</small><br/>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;">
          <button class="btn-primary-sm"   onclick="TEACHER.printSingleQR('${student_id}','${name}')">🖨 Print</button>
          <button class="btn-secondary-sm" onclick="document.getElementById('qr-display').innerHTML=''">Close</button>
        </div>
      </div>
    `;
    // QR encodes studentId|dob so parent login QR scan works
    const qrData = student_id + '|' + (dob || '');
    QRCode.toCanvas(document.getElementById('qr-canvas-' + student_id), qrData, {
      width: 200, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }, function(err) { if (err) console.error('QR error:', err); });
    area.scrollIntoView({ behavior: 'smooth' });
  },

  generateQR(student_id, dob, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const qrData = student_id + '|' + (dob || '');
    QRCode.toCanvas(canvas, qrData, {
      width: 180, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }, function(err) { if (err) console.error('QR error:', err); });
  },

  printSingleQR(student_id, name) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const s        = students.find(function(st) { return st.student_id === student_id; });
    if (!s) return;
    const classes  = APP.getLocalBySchool('classes', sid);

    // create staging canvas, render QR, then print
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    document.body.appendChild(hidden);
    const canvas = document.createElement('canvas');
    canvas.id    = 'qr-print-' + student_id;
    hidden.appendChild(canvas);

    const qrData = student_id + '|' + (s.dob || '');
    QRCode.toCanvas(canvas, qrData, { width: 160, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }, function() {
      TEACHER._doPrintAll([s], classes);
      hidden.remove();
    });
  },

  printAllQRCards() {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const classes  = APP.getLocalBySchool('classes',  sid);
    if (students.length === 0) { APP.showToast('No students to print.', 'warning'); return; }

    // generate canvases in hidden div, then print
    const hidden = document.createElement('div');
    hidden.id    = 'qr-print-staging';
    hidden.style.display = 'none';
    document.body.appendChild(hidden);

    students.forEach(function(s) {
      const canvas   = document.createElement('canvas');
      canvas.id      = 'qr-print-' + s.student_id;
      hidden.appendChild(canvas);
    });

    // wait for all QRs to render then build print window
    let rendered = 0;
    students.forEach(function(s) {
      const qrData = s.student_id + '|' + (s.dob || '');
      const cls    = classes.find(function(c) { return c.class_id === s.class_id; });
      QRCode.toCanvas(document.getElementById('qr-print-' + s.student_id), qrData, {
        width: 160, margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }, function() {
        rendered++;
        if (rendered === students.length) {
          TEACHER._doPrintAll(students, classes);
          hidden.remove();
        }
      });
    });
  },

  _doPrintAll(students, classes) {
    const cards = students.map(function(s) {
      const canvas = document.getElementById('qr-print-' + s.student_id);
      const cls    = classes.find(function(c) { return c.class_id === s.class_id; });
      const img    = canvas ? canvas.toDataURL() : '';
      return `<div class="qr-card-print">
        <img src="${img}" width="140" height="140"/>
        <div class="qr-card-name">${s.name}</div>
        <div class="qr-card-detail">Roll: ${s.roll_no || '—'} | ${cls ? cls.name : ''}</div>
        <div class="qr-card-detail" style="font-size:9px;">${s.student_id.slice(0,16)}...</div>
      </div>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>EduTrack QR Cards</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 10px; background: #fff; }
      .grid { display: flex; flex-wrap: wrap; gap: 12px; }
      .qr-card-print { border: 1.5px solid #333; border-radius: 8px; padding: 10px;
        text-align: center; width: 170px; page-break-inside: avoid; }
      .qr-card-name   { font-size: 13px; font-weight: 700; margin-top: 6px; }
      .qr-card-detail { font-size: 10px; color: #555; margin-top: 2px; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h2 style="font-size:14px;margin-bottom:10px;">EduTrack — Student QR Cards</h2>
    <div class="grid">${cards}</div>
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    win.document.close();
  },

  // ─── ATTENDANCE ─────────────────────────────────────────────────────
  async renderAttendance() {
    const sid     = APP.session.school_id;
    const content = document.getElementById('teacher-content');
    const classes = APP.getLocalBySchool('classes', sid);
    const today   = APP.today();

    TEACHER.attendanceMap = {};

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Attendance</h2>
          <span class="date-badge">${today}</span>
        </div>

        <div class="form-card">
          <select id="att-class" class="input" onchange="TEACHER.loadClassStudents(this.value)">
            <option value="">-- Select Class --</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
        </div>

        <!-- QR Scanner -->
        <div class="section-block">
          <div class="section-header">
            <h3 class="section-subtitle">QR Scanner</h3>
            <button class="btn-secondary-sm" id="btn-qr-toggle"
              onclick="TEACHER.toggleQRScanner()">▶ Start Scanner</button>
          </div>
          <div id="qr-scanner-area" class="hidden">
            <video id="qr-video" class="qr-video" playsinline></video>
            <canvas id="qr-scan-canvas" class="hidden"></canvas>
            <div id="qr-scan-result" class="qr-result-msg"></div>
          </div>
        </div>

        <!-- Manual list -->
        <div id="att-student-list"></div>

        <!-- Save -->
        <div id="att-save-area" class="hidden" style="margin-top:12px;">
          <button class="btn-primary full-width" onclick="TEACHER.saveAttendance()">
            💾 Save Attendance
          </button>
        </div>
      </div>
    `;
  },

  loadClassStudents(class_id) {
    if (!class_id) {
      document.getElementById('att-student-list').innerHTML = '';
      document.getElementById('att-save-area').classList.add('hidden');
      return;
    }
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === class_id;
    });
    // sort by roll_no
    students.sort(function(a, b) {
      return (a.roll_no || '').localeCompare(b.roll_no || '', undefined, { numeric: true });
    });

    const today    = APP.today();
    const existing = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.date === today;
    });

    TEACHER.attendanceMap = {};
    existing.forEach(function(a) {
      TEACHER.attendanceMap[a.student_id] = a.status;
    });

    const list = document.getElementById('att-student-list');
    if (students.length === 0) {
      list.innerHTML = '<p class="empty-msg">No students in this class.</p>';
      document.getElementById('att-save-area').classList.add('hidden');
      return;
    }

    list.innerHTML = `
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-subtitle">Mark Attendance (${students.length} students)</h3>
          <div style="display:flex;gap:6px;">
            <button class="btn-secondary-sm" onclick="TEACHER.markAllPresent()">All P</button>
            <button class="btn-secondary-sm" onclick="TEACHER.markAllAbsent()">All A</button>
          </div>
        </div>
        <div class="att-list">
          ${students.map(function(s) {
            const cur = TEACHER.attendanceMap[s.student_id] || '';
            return `<div class="att-row" id="att-row-${s.student_id}">
              <span class="att-name">
                <small style="color:var(--text2);margin-right:6px;">${s.roll_no || ''}</small>
                ${s.name}
              </span>
              <div class="att-btns">
                <button class="att-btn ${cur === 'present' ? 'att-present' : ''}"
                  onclick="TEACHER.markAttendance('${s.student_id}','present')">P</button>
                <button class="att-btn ${cur === 'absent'  ? 'att-absent'  : ''}"
                  onclick="TEACHER.markAttendance('${s.student_id}','absent')">A</button>
                <button class="att-btn ${cur === 'late'    ? 'att-late'    : ''}"
                  onclick="TEACHER.markAttendance('${s.student_id}','late')">L</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    document.getElementById('att-save-area').classList.remove('hidden');
  },

  markAllPresent() {
    const sid      = APP.session.school_id;
    const classId  = document.getElementById('att-class').value;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    students.forEach(function(s) { TEACHER.markAttendance(s.student_id, 'present'); });
  },

  markAllAbsent() {
    const sid      = APP.session.school_id;
    const classId  = document.getElementById('att-class').value;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    students.forEach(function(s) { TEACHER.markAttendance(s.student_id, 'absent'); });
  },

  markAttendance(student_id, status) {
    TEACHER.attendanceMap[student_id] = status;
    const row  = document.getElementById('att-row-' + student_id);
    if (!row) return;
    const btns = row.querySelectorAll('.att-btn');
    btns.forEach(function(b) {
      b.classList.remove('att-present', 'att-absent', 'att-late');
    });
    const idx = { present: 0, absent: 1, late: 2 };
    if (idx[status] !== undefined) btns[idx[status]].classList.add('att-' + status);
  },

  async saveAttendance() {
    const sid     = APP.session.school_id;
    const tid     = APP.session.user_id;
    const today   = APP.today();
    const entries = Object.keys(TEACHER.attendanceMap);

    if (entries.length === 0) { APP.showToast('No attendance marked yet.', 'warning'); return; }

    // ── GEO-TAG CAPTURE ─────────────────────────────────────────────
    let geoLat      = null;
    let geoLong     = null;
    let geoAccuracy = null;
    let geoVerified = false;

    const btn = document.querySelector('#att-save-area .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '📍 Getting location...'; }

    try {
      const position = await new Promise(function(resolve, reject) {
        if (!navigator.geolocation) { reject(new Error('not supported')); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout:            8000,   // 8 second timeout
          maximumAge:         60000   // accept cached position up to 1 min old
        });
      });
      geoLat      = parseFloat(position.coords.latitude.toFixed(6));
      geoLong     = parseFloat(position.coords.longitude.toFixed(6));
      geoAccuracy = Math.round(position.coords.accuracy); // metres
      geoVerified = geoAccuracy <= 200; // verified only if accuracy within 200m
    } catch (e) {
      // geo failed — don't block attendance, just save without location
      console.warn('[GEO] location capture failed:', e.message);
    }

    if (btn) { btn.disabled = true; btn.textContent = '💾 Saving...'; }

    let saved = 0;
    for (const student_id of entries) {
      const status = TEACHER.attendanceMap[student_id];
      if (!status) continue;
      const existing = APP.getLocalBySchool('attendance', sid).find(function(a) {
        return a.student_id === student_id && a.date === today;
      });
      const record = {
        attendance_id: existing ? existing.attendance_id : APP.uuid(),
        school_id:     sid,
        student_id:    student_id,
        date:          today,
        status:        status,
        teacher_id:    tid,
        geo_lat:       geoLat,
        geo_long:      geoLong,
        geo_accuracy:  geoAccuracy,
        geo_verified:  geoVerified,
        synced:        false,
        created_at:    existing ? existing.created_at : new Date().toISOString()
      };
      await APP.writeRecord('attendance', record, 'attendance_id');
      saved++;
    }

    // toast with geo status
    if (geoLat !== null) {
      const verifiedMsg = geoVerified
        ? '📍 Location verified (' + geoAccuracy + 'm accuracy)'
        : '⚠️ Location uncertain (' + geoAccuracy + 'm accuracy)';
      APP.showToast(saved + ' record(s) saved. ' + verifiedMsg, geoVerified ? 'ok' : 'warning');
    } else {
      APP.showToast(saved + ' record(s) saved. Location unavailable.', 'ok');
    }

    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Attendance'; }
    SYNC.updateBanner();
  },

  // ─── QR SCANNER ─────────────────────────────────────────────────────
  toggleQRScanner() {
    const area = document.getElementById('qr-scanner-area');
    if (area.classList.contains('hidden')) TEACHER.startQRScanner();
    else TEACHER.stopQRScanner();
  },

  async startQRScanner() {
    const area   = document.getElementById('qr-scanner-area');
    const video  = document.getElementById('qr-video');
    const btn    = document.getElementById('btn-qr-toggle');
    const result = document.getElementById('qr-scan-result');
    area.classList.remove('hidden');
    if (btn) btn.textContent = '■ Stop Scanner';
    if (result) result.textContent = 'Point camera at student QR code...';
    try {
      TEACHER.qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = TEACHER.qrStream;
      await video.play();
      TEACHER.scanQRFrame();
    } catch (e) {
      if (result) result.textContent = 'Camera access denied or unavailable.';
      TEACHER.stopQRScanner();
    }
  },

  stopQRScanner() {
    if (TEACHER.qrAnimFrame) { cancelAnimationFrame(TEACHER.qrAnimFrame); TEACHER.qrAnimFrame = null; }
    if (TEACHER.qrStream)    { TEACHER.qrStream.getTracks().forEach(function(t) { t.stop(); }); TEACHER.qrStream = null; }
    const area = document.getElementById('qr-scanner-area');
    const btn  = document.getElementById('btn-qr-toggle');
    if (area) area.classList.add('hidden');
    if (btn)  btn.textContent = '▶ Start Scanner';
  },

  scanQRFrame() {
    const video  = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-scan-canvas');
    if (!video || !canvas || !TEACHER.qrStream) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx  = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code) { TEACHER.handleQRResult(code.data); return; }
    }
    TEACHER.qrAnimFrame = requestAnimationFrame(TEACHER.scanQRFrame);
  },

  handleQRResult(qrData) {
    TEACHER.stopQRScanner();
    // QR format: studentId|dob
    const parts      = qrData.split('|');
    const student_id = parts[0];
    const sid        = APP.session.school_id;
    const student    = APP.getLocalBySchool('students', sid).find(function(s) {
      return s.student_id === student_id;
    });
    const result = document.getElementById('qr-scan-result');
    if (!student) {
      if (result) result.textContent = 'Student not found for this QR.';
      APP.showToast('Unknown QR code.', 'error');
      return;
    }
    TEACHER.markAttendance(student_id, 'present');
    APP.showToast(student.name + ' marked Present.', 'ok');
    if (result) result.textContent = '✓ ' + student.name + ' marked Present.';
    const classSelect = document.getElementById('att-class');
    if (classSelect && !classSelect.value) {
      classSelect.value = student.class_id;
      TEACHER.loadClassStudents(student.class_id);
      setTimeout(function() { TEACHER.markAttendance(student_id, 'present'); }, 60);
    }
    document.getElementById('att-save-area').classList.remove('hidden');
  },

  // ─── MARKS ──────────────────────────────────────────────────────────
  async renderMarks() {
    const sid     = APP.session.school_id;
    const content = document.getElementById('teacher-content');

    // teacher manages exams + subjects here
    const exams    = APP.getLocalBySchool('exams',    sid);
    const subjects = APP.getLocalBySchool('subjects', sid);
    const classes  = APP.getLocalBySchool('classes',  sid);

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Marks</h2>
        </div>

        <!-- Exam & Subject management -->
        <div class="form-card">
          <h3>Manage Exams</h3>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="new-exam-name" class="input" type="text"
              placeholder="Exam name (e.g. Unit Test 1)" style="margin-bottom:0;flex:1;" />
            <button class="btn-primary-sm" onclick="TEACHER.addExam()">+ Add</button>
          </div>
          <ul class="simple-list" id="exams-list">
            ${exams.map(function(e) {
              return `<li><span>${e.name}</span>
                <button class="btn-danger-sm"
                  onclick="TEACHER.deleteExam('${e.exam_id}')">Del</button></li>`;
            }).join('')}
          </ul>
        </div>

        <div class="form-card">
          <h3>Manage Subjects</h3>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <input id="new-subject-name" class="input" type="text"
              placeholder="Subject name (e.g. Mathematics)" style="margin-bottom:0;flex:1;" />
            <button class="btn-primary-sm" onclick="TEACHER.addSubject()">+ Add</button>
          </div>
          <ul class="simple-list" id="subjects-list">
            ${subjects.map(function(s) {
              return `<li><span>${s.name}</span>
                <button class="btn-danger-sm"
                  onclick="TEACHER.deleteSubject('${s.subject_id}')">Del</button></li>`;
            }).join('')}
          </ul>
        </div>

        <!-- Enter marks -->
        <div class="form-card">
          <h3>Enter / View Marks</h3>
          <select id="m-exam" class="input">
            <option value="">-- Select Exam --</option>
            ${exams.map(function(e) {
              return `<option value="${e.exam_id}">${e.name}</option>`;
            }).join('')}
          </select>
          <select id="m-subject" class="input">
            <option value="">-- Select Subject --</option>
            ${subjects.map(function(s) {
              return `<option value="${s.subject_id}">${s.name}</option>`;
            }).join('')}
          </select>
          <select id="m-class" class="input" onchange="TEACHER.loadMarksStudents()">
            <option value="">-- Select Class --</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
          <input id="m-max" class="input" type="number"
            placeholder="Max marks (e.g. 100)" min="1" />
        </div>

        <div id="marks-student-list"></div>
        <div id="marks-save-area" class="hidden" style="margin-top:8px;">
          <button class="btn-primary full-width" onclick="TEACHER.saveAllMarks()">
            💾 Save Marks
          </button>
        </div>

        <!-- Marks history -->
        <div class="section-block" style="margin-top:20px;">
          <div class="section-header">
            <h3 class="section-subtitle">Marks History</h3>
            <button class="btn-secondary-sm" onclick="TEACHER.renderMarksHistory()">View</button>
          </div>
          <div id="marks-history"></div>
        </div>
      </div>
    `;
  },

  async addExam() {
    const input = document.getElementById('new-exam-name');
    const name  = input.value.trim();
    if (!name) { APP.showToast('Enter exam name.', 'warning'); return; }
    const sid   = APP.session.school_id;
    const dup   = APP.getLocalBySchool('exams', sid).find(function(e) {
      return e.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { APP.showToast('Exam already exists.', 'warning'); return; }
    const record = {
      exam_id:    APP.uuid(),
      school_id:  sid,
      name:       name,
      created_at: new Date().toISOString()
    };
    await APP.writeRecord('exams', record, 'exam_id');
    input.value = '';
    APP.showToast(name + ' added.', 'ok');
    await TEACHER.renderMarks();
  },

  async deleteExam(exam_id) {
    await APP.deleteRecord('exams', 'exam_id', exam_id, APP.session.school_id);
    APP.showToast('Exam deleted.', 'ok');
    await TEACHER.renderMarks();
  },

  async addSubject() {
    const input = document.getElementById('new-subject-name');
    const name  = input.value.trim();
    if (!name) { APP.showToast('Enter subject name.', 'warning'); return; }
    const sid   = APP.session.school_id;
    const dup   = APP.getLocalBySchool('subjects', sid).find(function(s) {
      return s.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { APP.showToast('Subject already exists.', 'warning'); return; }
    const record = {
      subject_id: APP.uuid(),
      school_id:  sid,
      name:       name,
      created_at: new Date().toISOString()
    };
    await APP.writeRecord('subjects', record, 'subject_id');
    input.value = '';
    APP.showToast(name + ' added.', 'ok');
    await TEACHER.renderMarks();
  },

  async deleteSubject(subject_id) {
    await APP.deleteRecord('subjects', 'subject_id', subject_id, APP.session.school_id);
    APP.showToast('Subject deleted.', 'ok');
    await TEACHER.renderMarks();
  },

  loadMarksStudents() {
    const classId = document.getElementById('m-class').value;
    if (!classId) return;
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    students.sort(function(a, b) {
      return (a.roll_no || '').localeCompare(b.roll_no || '', undefined, { numeric: true });
    });

    const examId    = document.getElementById('m-exam').value;
    const subjectId = document.getElementById('m-subject').value;
    const allMarks  = APP.getLocalBySchool('marks', sid);

    const list = document.getElementById('marks-student-list');
    if (students.length === 0) {
      list.innerHTML = '<p class="empty-msg">No students in this class.</p>';
      document.getElementById('marks-save-area').classList.add('hidden');
      return;
    }

    list.innerHTML = `
      <div class="section-block">
        <h3 class="section-subtitle">Enter marks for each student</h3>
        <div class="marks-list">
          ${students.map(function(s) {
            // pre-fill existing mark only if both exam + subject are selected
            const existing = (examId && subjectId) ? allMarks.find(function(m) {
              return m.student_id === s.student_id &&
                     m.exam_id    === examId &&
                     m.subject_id === subjectId;
            }) : null;
            return `<div class="marks-row">
              <span class="marks-name">
                <small style="color:var(--text2);">${s.roll_no || ''}</small> ${s.name}
              </span>
              <input class="input marks-input" type="number"
                id="mark-${s.student_id}"
                value="${existing ? existing.marks_obtained : ''}"
                placeholder="Marks" min="0" />
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    document.getElementById('marks-save-area').classList.remove('hidden');
  },

  async saveAllMarks() {
    const examId    = document.getElementById('m-exam').value;
    const subjectId = document.getElementById('m-subject').value;
    const classId   = document.getElementById('m-class').value;
    const maxMarks  = parseFloat(document.getElementById('m-max').value);

    if (!examId)               { APP.showToast('Select an exam.',         'warning'); return; }
    if (!subjectId)            { APP.showToast('Select a subject.',        'warning'); return; }
    if (!classId)              { APP.showToast('Select a class.',          'warning'); return; }
    if (!maxMarks || maxMarks < 1) { APP.showToast('Enter valid max marks.', 'warning'); return; }

    const sid      = APP.session.school_id;
    const tid      = APP.session.user_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    const allMarks = APP.getLocalBySchool('marks', sid);

    let saved = 0;
    for (const s of students) {
      const input = document.getElementById('mark-' + s.student_id);
      if (!input || input.value === '') continue;
      const obtained = parseFloat(input.value);
      if (isNaN(obtained) || obtained < 0 || obtained > maxMarks) continue;

      const existing = allMarks.find(function(m) {
        return m.student_id === s.student_id &&
               m.exam_id    === examId &&
               m.subject_id === subjectId;
      });

      const grade = TEACHER.calcGrade(obtained, maxMarks);

      const record = {
        mark_id:        existing ? existing.mark_id : APP.uuid(),
        school_id:      sid,
        student_id:     s.student_id,
        exam_id:        examId,
        subject_id:     subjectId,
        marks_obtained: obtained,
        max_marks:      maxMarks,
        percentage:     Math.round((obtained / maxMarks) * 100),
        grade:          grade,
        teacher_id:     tid,
        synced:         false,
        created_at:     existing ? existing.created_at : new Date().toISOString()
      };
      await APP.writeRecord('marks', record, 'mark_id');
      saved++;
    }
    APP.showToast(saved + ' mark(s) saved.', 'ok');
  },

  // ─── GRADE CALCULATION ──────────────────────────────────────────────
  calcGrade(obtained, max) {
    const pct = (obtained / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  },

  // ─── MARKS HISTORY ──────────────────────────────────────────────────
  renderMarksHistory() {
    const sid      = APP.session.school_id;
    const allMarks = APP.getLocalBySchool('marks',    sid);
    const students = APP.getLocalBySchool('students', sid);
    const exams    = APP.getLocalBySchool('exams',    sid);
    const subjects = APP.getLocalBySchool('subjects', sid);
    const container = document.getElementById('marks-history');

    if (allMarks.length === 0) {
      container.innerHTML = '<p class="empty-msg">No marks recorded yet.</p>';
      return;
    }

    // group by exam
    const byExam = {};
    allMarks.forEach(function(m) {
      if (!byExam[m.exam_id]) byExam[m.exam_id] = [];
      byExam[m.exam_id].push(m);
    });

    container.innerHTML = Object.keys(byExam).map(function(examId) {
      const exam    = exams.find(function(e) { return e.exam_id === examId; });
      const records = byExam[examId];
      return `<div class="form-card">
        <h3>${exam ? exam.name : 'Unknown Exam'}</h3>
        <div class="table-wrap">
          <table class="data-table small-table">
            <thead>
              <tr><th>Student</th><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th></tr>
            </thead>
            <tbody>
              ${records.map(function(m) {
                const stu = students.find(function(s) { return s.student_id === m.student_id; });
                const sub = subjects.find(function(s) { return s.subject_id === m.subject_id; });
                const pct = Math.round((m.marks_obtained / m.max_marks) * 100);
                const g   = m.grade || TEACHER.calcGrade(m.marks_obtained, m.max_marks);
                return `<tr>
                  <td>${stu ? stu.name : '—'}</td>
                  <td>${sub ? sub.name : '—'}</td>
                  <td>${m.marks_obtained}/${m.max_marks}</td>
                  <td>${pct}%</td>
                  <td><strong>${g}</strong></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  },

  // ─── MORE TAB ───────────────────────────────────────────────────────
  async renderMore() {
    const content = document.getElementById('teacher-content');
    content.innerHTML = `
      <div class="tab-section">
        <h2 class="section-title">More</h2>
        <div class="more-grid">
          <button class="more-card" onclick="TEACHER.renderNotify()">
            <span>💬</span><strong>Notify</strong><small>WhatsApp alerts</small>
          </button>
          <button class="more-card" onclick="TEACHER.renderReportCards()">
            <span>📄</span><strong>Report Cards</strong><small>Print &amp; share</small>
          </button>
          <button class="more-card" onclick="TEACHER.renderReports()">
            <span>📊</span><strong>Reports</strong><small>Attendance &amp; marks</small>
          </button>
          <button class="more-card" onclick="TEACHER.renderSync()">
            <span>🔄</span><strong>Sync</strong><small>Manage queue</small>
          </button>
          <button class="more-card" onclick="TEACHER.exportJSON()">
            <span>📥</span><strong>Export</strong><small>JSON backup</small>
          </button>
        </div>
        <div id="more-content"></div>
      </div>
    `;
  },

  // ─── NOTIFY ─────────────────────────────────────────────────────────
  async renderNotify() {
    // ensure more tab is loaded first
    if (!document.getElementById('more-content')) {
      await TEACHER.loadTab('more');
      return; // renderMore will not auto-open notify, so return after loading shell
    }
    const content  = document.getElementById('more-content');
    const sid      = APP.session.school_id;
    const today    = APP.today();
    const todayAtt = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.date === today && a.status === 'absent';
    });
    const students  = APP.getLocalBySchool('students', sid);
    const absent    = todayAtt.map(function(a) {
      return students.find(function(s) { return s.student_id === a.student_id; });
    }).filter(Boolean);

    content.innerHTML = `
      <div class="section-block">
        <h3 class="section-subtitle">Absent Today — ${absent.length} student(s)</h3>
        ${absent.length === 0
          ? '<p class="empty-msg">No absent students today or attendance not marked yet.</p>'
          : `<div class="list-cards">
              ${absent.map(function(s) {
                return `<div class="list-card">
                  <div class="list-card-info">
                    <strong>${s.name}</strong>
                    <small>Parent: ${s.parent_phone || 'No phone'}</small>
                  </div>
                  <div class="list-card-actions">
                    ${s.parent_phone
                      ? `<button class="btn-primary-sm"
                          onclick="TEACHER.sendWhatsApp('${s.parent_phone}','${s.name.replace(/'/g,"\\'")}')">
                          📱 WhatsApp
                        </button>`
                      : '<small class="text-warn">No phone</small>'
                    }
                  </div>
                </div>`;
              }).join('')}
            </div>
            <button class="btn-primary full-width" style="margin-top:12px;"
              onclick="TEACHER.sendAllWhatsApp()">
              📱 Send All WhatsApp Alerts
            </button>`
        }
      </div>
    `;
  },

  sendWhatsApp(phone, name) {
    const today = APP.today();
    const msg   = encodeURIComponent(
      'Dear Parent, your child ' + name +
      ' was ABSENT from school today (' + today + '). ' +
      'Please contact the school. — EduTrack'
    );
    window.open('https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + msg, '_blank');
  },

  sendAllWhatsApp() {
    const sid      = APP.session.school_id;
    const today    = APP.today();
    const todayAtt = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.date === today && a.status === 'absent';
    });
    const students = APP.getLocalBySchool('students', sid);
    let sent = 0;
    todayAtt.forEach(function(a) {
      const s = students.find(function(st) { return st.student_id === a.student_id; });
      if (s && s.parent_phone) { TEACHER.sendWhatsApp(s.parent_phone, s.name); sent++; }
    });
    if (sent === 0) APP.showToast('No parent phones available.', 'warning');
    else APP.showToast(sent + ' alerts sent.', 'ok');
  },

  // ─── REPORT CARDS ───────────────────────────────────────────────────
  async renderReportCards() {
    if (!document.getElementById('more-content')) {
      await TEACHER.loadTab('more');
      return;
    }
    const content  = document.getElementById('more-content');
    const sid      = APP.session.school_id;
    const classes  = APP.getLocalBySchool('classes',  sid);
    const students = APP.getLocalBySchool('students', sid);

    content.innerHTML = `
      <div class="section-block">
        <h3 class="section-subtitle">Report Cards</h3>
        <div class="form-card">
          <select id="rc-class" class="input" onchange="TEACHER.loadReportCardStudents()">
            <option value="">-- Select Class --</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
        </div>
        <div id="rc-students-list"></div>
      </div>
    `;
  },

  loadReportCardStudents() {
    const classId  = document.getElementById('rc-class').value;
    if (!classId) return;
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    students.sort(function(a, b) {
      return (a.roll_no || '').localeCompare(b.roll_no || '', undefined, { numeric: true });
    });
    const container = document.getElementById('rc-students-list');
    if (students.length === 0) {
      container.innerHTML = '<p class="empty-msg">No students in this class.</p>';
      return;
    }
    container.innerHTML = `
      <div class="list-cards">
        ${students.map(function(s) {
          return `<div class="list-card">
            <div class="list-card-info">
              <strong>${s.name}</strong>
              <small>Roll: ${s.roll_no || '—'}</small>
            </div>
            <div class="list-card-actions">
              <button class="btn-primary-sm"
                onclick="TEACHER.printReportCard('${s.student_id}')">🖨 Print</button>
              <button class="btn-secondary-sm"
                onclick="TEACHER.whatsAppReportCard('${s.student_id}')">📱 WA</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn-primary full-width" style="margin-top:12px;"
        onclick="TEACHER.printAllReportCards('${classId}')">
        🖨 Print All Report Cards
      </button>
    `;
  },

  _buildReportData(student_id) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const s        = students.find(function(st) { return st.student_id === student_id; });
    if (!s) return null;

    const classes  = APP.getLocalBySchool('classes',  sid);
    const exams    = APP.getLocalBySchool('exams',    sid);
    const subjects = APP.getLocalBySchool('subjects', sid);
    const allMarks = APP.getLocalBySchool('marks',    sid).filter(function(m) {
      return m.student_id === student_id;
    });
    const allAtt   = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.student_id === student_id;
    });
    const cls      = classes.find(function(c) { return c.class_id === s.class_id; });
    const present  = allAtt.filter(function(a) { return a.status === 'present'; }).length;
    const attPct   = allAtt.length > 0 ? Math.round((present / allAtt.length) * 100) : 0;

    // group marks by exam
    const byExam = {};
    allMarks.forEach(function(m) {
      if (!byExam[m.exam_id]) byExam[m.exam_id] = [];
      byExam[m.exam_id].push(m);
    });

    return { s, cls, exams, subjects, byExam, allAtt, present, attPct };
  },

  printReportCard(student_id) {
    const d = TEACHER._buildReportData(student_id);
    if (!d) { APP.showToast('Student not found.', 'error'); return; }
    const html = TEACHER._reportCardHTML(d);
    const win  = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },

  printAllReportCards(class_id) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === class_id;
    });
    if (students.length === 0) { APP.showToast('No students in this class.', 'warning'); return; }
    const allHTML = students.map(function(s) {
      const d = TEACHER._buildReportData(s.student_id);
      return d ? TEACHER._reportCardBody(d) : '';
    }).join('<div style="page-break-after:always;"></div>');

    const win = window.open('', '_blank');
    win.document.write(TEACHER._reportCardWrapper(allHTML));
    win.document.close();
  },

  _reportCardHTML(d) {
    return TEACHER._reportCardWrapper(TEACHER._reportCardBody(d));
  },

  _reportCardWrapper(bodyHTML) {
    return `<!DOCTYPE html><html><head><title>EduTrack Report Card</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #111; font-size: 13px; }
      h1   { font-size: 18px; margin: 0; }
      h2   { font-size: 14px; margin: 4px 0 0; color: #444; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
      .info-row { display: flex; gap: 20px; margin-bottom: 12px; }
      .info-item { flex: 1; }
      .label { font-size: 11px; color: #666; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 12px; }
      th { background: #f0f0f0; font-weight: 700; }
      .att-box { background: #f9f9f9; border: 1px solid #ccc; padding: 10px; border-radius: 4px; margin-bottom: 14px; }
      .grade-A\\+ { color: #0a7c42; font-weight: 700; }
      .grade-A   { color: #0a7c42; font-weight: 700; }
      .grade-B\\+ { color: #1a6fbf; font-weight: 700; }
      .grade-B   { color: #1a6fbf; font-weight: 700; }
      .grade-C   { color: #b07d00; font-weight: 700; }
      .grade-D   { color: #c85000; font-weight: 700; }
      .grade-F   { color: #cc0000; font-weight: 700; }
      .footer { font-size: 11px; color: #888; text-align: center; margin-top: 20px; }
      @media print { body { margin: 10px; } }
    </style></head><body>${bodyHTML}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
  },

  _reportCardBody(d) {
    const examRows = Object.keys(d.byExam).map(function(examId) {
      const exam    = d.exams.find(function(e) { return e.exam_id === examId; });
      const records = d.byExam[examId];
      let total = 0, maxTotal = 0;
      const rows = records.map(function(m) {
        const sub = d.subjects.find(function(s) { return s.subject_id === m.subject_id; });
        const pct = Math.round((m.marks_obtained / m.max_marks) * 100);
        const g   = m.grade || TEACHER.calcGrade(m.marks_obtained, m.max_marks);
        total    += m.marks_obtained;
        maxTotal += m.max_marks;
        return `<tr>
          <td>${sub ? sub.name : '—'}</td>
          <td>${m.marks_obtained} / ${m.max_marks}</td>
          <td>${pct}%</td>
          <td class="grade-${g}">${g}</td>
        </tr>`;
      }).join('');
      const totalPct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
      const totalG   = maxTotal > 0 ? TEACHER.calcGrade(total, maxTotal) : '—';
      return `<h3 style="font-size:13px;margin:10px 0 4px;">${exam ? exam.name : 'Exam'}</h3>
        <table>
          <thead><tr><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th></tr></thead>
          <tbody>${rows}
            <tr style="background:#f5f5f5;font-weight:700;">
              <td>Total</td><td>${total}/${maxTotal}</td>
              <td>${totalPct}%</td><td class="grade-${totalG}">${totalG}</td>
            </tr>
          </tbody>
        </table>`;
    }).join('');

    return `<div class="header">
        <h1>EduTrack — Student Report Card</h1>
        <h2>${d.cls ? d.cls.name : ''}</h2>
      </div>
      <div class="info-row">
        <div class="info-item"><div class="label">Student Name</div><div class="value">${d.s.name}</div></div>
        <div class="info-item"><div class="label">Roll No</div><div class="value">${d.s.roll_no || '—'}</div></div>
        <div class="info-item"><div class="label">Date of Birth</div><div class="value">${d.s.dob || '—'}</div></div>
      </div>
      <div class="att-box">
        <strong>Attendance:</strong> ${d.present} / ${d.allAtt.length} days present
        &nbsp;|&nbsp; <strong>${d.attPct}%</strong>
        ${d.attPct < 75 ? ' &nbsp;⚠️ Below 75% — Attendance Shortage' : ''}
      </div>
      ${examRows || '<p style="color:#888;">No marks recorded yet.</p>'}
      <div class="footer">Generated by EduTrack v2.1 — ${new Date().toLocaleDateString()}</div>`;
  },

  whatsAppReportCard(student_id) {
    const d = TEACHER._buildReportData(student_id);
    if (!d) { APP.showToast('Student not found.', 'error'); return; }
    if (!d.s.parent_phone) { APP.showToast('No parent phone for this student.', 'warning'); return; }

    let marksText = '';
    Object.keys(d.byExam).forEach(function(examId) {
      const exam = d.exams.find(function(e) { return e.exam_id === examId; });
      d.byExam[examId].forEach(function(m) {
        const sub = d.subjects.find(function(s) { return s.subject_id === m.subject_id; });
        const g   = m.grade || TEACHER.calcGrade(m.marks_obtained, m.max_marks);
        marksText += (exam ? exam.name : 'Exam') + ' - ' +
                     (sub  ? sub.name  : 'Subj') + ': ' +
                     m.marks_obtained + '/' + m.max_marks + ' (' + g + ')\n';
      });
    });

    const msg = encodeURIComponent(
      'EduTrack Report Card\n' +
      'Student: ' + d.s.name + '\n' +
      'Roll No: ' + (d.s.roll_no || '—') + '\n' +
      'Attendance: ' + d.attPct + '% (' + d.present + '/' + d.allAtt.length + ' days)\n' +
      (marksText ? '\nMarks:\n' + marksText : '\nNo marks recorded yet.')
    );
    window.open('https://wa.me/' + d.s.parent_phone.replace(/\D/g, '') + '?text=' + msg, '_blank');
  },

  // ─── REPORTS ────────────────────────────────────────────────────────
  async renderReports() {
    if (!document.getElementById('more-content')) {
      await TEACHER.loadTab('more');
      return;
    }
    const content = document.getElementById('more-content');
    const sid     = APP.session.school_id;
    const classes = APP.getLocalBySchool('classes', sid);

    content.innerHTML = `
      <div class="section-block">
        <h3 class="section-subtitle">Reports</h3>
        <div class="form-card">
          <select id="rep-class" class="input">
            <option value="">-- Select Class --</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
          <div class="form-actions">
            <button class="btn-primary-sm"   onclick="TEACHER.weeklyAttendanceReport()">Weekly Attendance</button>
            <button class="btn-secondary-sm" onclick="TEACHER.exportJSON()">Export JSON</button>
          </div>
        </div>
        <div id="report-output"></div>
      </div>
    `;
  },

  weeklyAttendanceReport() {
    const classId = document.getElementById('rep-class').value;
    if (!classId) { APP.showToast('Select a class first.', 'warning'); return; }
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === classId;
    });
    students.sort(function(a, b) {
      return (a.roll_no || '').localeCompare(b.roll_no || '', undefined, { numeric: true });
    });
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const allAtt = APP.getLocalBySchool('attendance', sid);
    const output = document.getElementById('report-output');
    if (students.length === 0) {
      output.innerHTML = '<p class="empty-msg">No students in this class.</p>';
      return;
    }
    output.innerHTML = `
      <div class="table-wrap">
        <table class="data-table small-table">
          <thead>
            <tr>
              <th>Roll</th><th>Student</th>
              ${days.map(function(d) { return '<th>' + d.slice(5) + '</th>'; }).join('')}
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(function(s) {
              const sAtt = allAtt.filter(function(a) { return a.student_id === s.student_id; });
              let presentCount = 0;
              const cells = days.map(function(d) {
                const rec = sAtt.find(function(a) { return a.date === d; });
                if (!rec)                    return '<td>—</td>';
                if (rec.status === 'present') { presentCount++; return '<td class="att-p">P</td>'; }
                if (rec.status === 'absent')               return '<td class="att-a">A</td>';
                if (rec.status === 'late')                 return '<td class="att-l">L</td>';
                return '<td>—</td>';
              }).join('');
              const total = sAtt.filter(function(a) { return days.includes(a.date); }).length;
              const pct   = total > 0 ? Math.round((presentCount / total) * 100) : 0;
              return `<tr>
                <td>${s.roll_no || '—'}</td>
                <td>${s.name}</td>
                ${cells}
                <td><strong>${pct}%</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  exportJSON() {
    const sid  = APP.session.school_id;
    const data = {
      exported_at: new Date().toISOString(),
      school_id:   sid,
      students:    APP.getLocalBySchool('students',   sid),
      attendance:  APP.getLocalBySchool('attendance', sid),
      marks:       APP.getLocalBySchool('marks',      sid),
      exams:       APP.getLocalBySchool('exams',      sid),
      subjects:    APP.getLocalBySchool('subjects',   sid)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'edutrack-export-' + APP.today() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    APP.showToast('JSON exported.', 'ok');
  },

  // ─── SYNC ────────────────────────────────────────────────────────────
  async renderSync() {
    if (!document.getElementById('more-content')) {
      await TEACHER.loadTab('more');
      return;
    }
    const content = document.getElementById('more-content');
    const stats   = await SYNC.getStats();
    const kb      = await SYNC.getPendingSizeKB();
    const last    = SYNC.lastSyncTime
      ? new Date(SYNC.lastSyncTime).toLocaleString() : 'Never';

    content.innerHTML = `
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-subtitle">Sync Status</h3>
          <button class="btn-primary-sm" onclick="TEACHER.manualSync()">🔄 Sync Now</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card ${stats.pending > 0 ? 'stat-warn' : ''}">
            <div class="stat-number">${stats.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-card ${stats.failed > 0 ? 'stat-danger' : ''}">
            <div class="stat-number">${stats.failed}</div>
            <div class="stat-label">Failed</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div class="stat-label">Total</div>
          </div>
        </div>
        <div class="info-block">
          <div class="info-row">
            <span>Status</span>
            <strong class="${SYNC.isOnline ? 'text-ok' : 'text-warn'}">
              ${SYNC.isOnline ? '🟢 Online' : '🔴 Offline'}
            </strong>
          </div>
          <div class="info-row"><span>Pending Size</span><strong>${kb} KB</strong></div>
          <div class="info-row"><span>Last Sync</span><strong>${last}</strong></div>
        </div>
      </div>
    `;
  },

  async manualSync() {
    if (!SYNC.isOnline) { APP.showToast('Offline — cannot sync.', 'warning'); return; }
    APP.showToast('Syncing...');
    await SYNC.runSync();
    APP.showToast('Sync complete.', 'ok');
    await TEACHER.renderSync();
  }
};