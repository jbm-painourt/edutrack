// ─── PRINCIPAL MODULE v2.1 ───────────────────────────────────────────────────
const PRINCIPAL = {
  activeTab: 'dashboard',

  // ─── INIT ───────────────────────────────────────────────────────────
  async init() {
    APP.showScreen('screen-principal');
    PRINCIPAL.renderShell();
    await PRINCIPAL.loadTab('dashboard');
  },

  // ─── SHELL ──────────────────────────────────────────────────────────
  renderShell() {
    const screen = document.getElementById('screen-principal');
    screen.innerHTML = `
      <div class="app-header">
        <div class="app-logo-sm">ET</div>
        <span class="app-title">Edu<span>Track</span></span>
        <span class="role-badge principal">Principal</span>
        <button class="btn-icon" onclick="APP.logout()">Out</button>
      </div>
      <div id="sync-banner" class="sync-banner"></div>
      <div id="principal-content" class="tab-content"></div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-tab="dashboard" onclick="PRINCIPAL.loadTab('dashboard')">
          <span>🏠</span><small>Home</small>
        </button>
        <button class="nav-btn" data-tab="teachers" onclick="PRINCIPAL.loadTab('teachers')">
          <span>👨‍🏫</span><small>Teachers</small>
        </button>
        <button class="nav-btn" data-tab="classes" onclick="PRINCIPAL.loadTab('classes')">
          <span>🏫</span><small>Classes</small>
        </button>
        <button class="nav-btn" data-tab="exams" onclick="PRINCIPAL.loadTab('exams')">
          <span>📝</span><small>Exams</small>
        </button>
        <button class="nav-btn" data-tab="monitor" onclick="PRINCIPAL.loadTab('monitor')">
          <span>⚙️</span><small>Monitor</small>
        </button>
      </nav>
    `;
    SYNC.updateBanner();
  },

  // ─── TAB LOADER ─────────────────────────────────────────────────────
  async loadTab(tab) {
    PRINCIPAL.activeTab = tab;
    document.querySelectorAll('#screen-principal .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const content = document.getElementById('principal-content');
    content.innerHTML = '<div class="loading">Loading...</div>';
    if      (tab === 'dashboard') await PRINCIPAL.renderDashboard();
    else if (tab === 'teachers')  await PRINCIPAL.renderTeachers();
    else if (tab === 'classes')   await PRINCIPAL.renderClasses();
    else if (tab === 'exams')     await PRINCIPAL.renderExams();
    else if (tab === 'monitor')   await PRINCIPAL.renderMonitor();
  },

  // ─── DASHBOARD ──────────────────────────────────────────────────────
  async renderDashboard() {
    const sid     = APP.session.school_id;
    const content = document.getElementById('principal-content');
    const today   = APP.today();

    const students   = APP.getLocalBySchool('students',   sid);
    const classes    = APP.getLocalBySchool('classes',    sid);
    const teachers   = APP.getLocalUsers().filter(function(u) {
      return u.school_id === sid && u.role === 'teacher';
    });
    const exams      = APP.getLocalBySchool('exams',    sid);
    const allMarks   = APP.getLocalBySchool('marks',    sid);
    const pending    = await SYNC.getPendingCount();
    const attendance = APP.getLocalBySchool('attendance', sid).filter(function(a) {
      return a.date === today;
    });
    const present    = attendance.filter(function(a) { return a.status === 'present'; }).length;
    const attPct     = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : null;
    const atRisk     = PRINCIPAL.getAtRiskStudents(students, sid);

    // school info
    const schools  = APP.getLocal('schools');
    const school   = schools.find(function(s) { return s.school_id === sid; });
    const schoolNm = school ? school.name : 'Your School';

    // per-class attendance breakdown for today
    const classBreakdown = classes.map(function(c) {
      const classStudents = students.filter(function(s) { return s.class_id === c.class_id; });
      const classAtt      = attendance.filter(function(a) {
        return classStudents.some(function(s) { return s.student_id === a.student_id; });
      });
      const classPresent  = classAtt.filter(function(a) { return a.status === 'present'; }).length;
      const classPct      = classAtt.length > 0 ? Math.round((classPresent / classAtt.length) * 100) : null;
      return { name: c.name, total: classStudents.length, present: classPresent, pct: classPct, marked: classAtt.length };
    });

    content.innerHTML = `
      <div class="section-block">
        <h2 class="section-title">Good day, ${APP.session.name} 👋</h2>
        <p class="section-sub">${schoolNm} &bull; ${today}</p>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${students.length}</div>
            <div class="stat-label">Total Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${classes.length}</div>
            <div class="stat-label">Classes</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${teachers.length}</div>
            <div class="stat-label">Teachers</div>
          </div>
          <div class="stat-card ${pending > 0 ? 'stat-warn' : 'stat-ok'}">
            <div class="stat-number">${pending}</div>
            <div class="stat-label">Pending Sync</div>
          </div>
        </div>

        <!-- Exams & Marks summary -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${exams.length}</div>
            <div class="stat-label">Exams Created</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${allMarks.length}</div>
            <div class="stat-label">Marks Entered</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-number">${atRisk.length}</div>
            <div class="stat-label">At-Risk Students</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${attPct !== null ? attPct + '%' : 'N/A'}</div>
            <div class="stat-label">Today's Attendance</div>
          </div>
        </div>

        <!-- Today's attendance card -->
        <div class="form-card" style="text-align:center;padding:18px;">
          <div class="stat-number" style="font-size:36px;">
            ${attPct !== null ? attPct + '%' : 'N/A'}
          </div>
          <div class="stat-label">Today's School Attendance</div>
          ${attPct !== null
            ? `<div style="margin-top:8px;">
                <span class="pct-badge ${attPct >= 75 ? 'pct-ok' : 'pct-danger'}">
                  ${present} present out of ${attendance.length} marked
                </span>
              </div>`
            : '<p style="color:var(--text2);font-size:12px;margin-top:6px;">No attendance marked yet today</p>'
          }
        </div>

        <!-- Per-class attendance breakdown -->
        ${classBreakdown.length > 0 ? `
        <div class="section-block">
          <h3 class="section-subtitle">Class-wise Attendance Today</h3>
          <div class="table-wrap">
            <table class="data-table small-table">
              <thead><tr>
                <th>Class</th><th>Students</th><th>Marked</th><th>Present</th><th>%</th>
              </tr></thead>
              <tbody>
                ${classBreakdown.map(function(c) {
                  return `<tr>
                    <td>${c.name}</td>
                    <td>${c.total}</td>
                    <td>${c.marked}</td>
                    <td>${c.present}</td>
                    <td>${c.pct !== null
                      ? `<span class="pct-badge ${c.pct >= 75 ? 'pct-ok' : 'pct-danger'}">${c.pct}%</span>`
                      : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        <!-- At-risk students -->
        <div class="section-block">
          <div class="section-header">
            <h3 class="section-subtitle">⚠️ At-Risk Students <small style="text-transform:none;font-weight:400;">(below 75%)</small></h3>
            <span class="pct-badge pct-danger">${atRisk.length}</span>
          </div>
          ${atRisk.length === 0
            ? '<p class="empty-msg">✅ No at-risk students. Great attendance!</p>'
            : `<div class="table-wrap">
                <table class="data-table small-table">
                  <thead><tr>
                    <th>Name</th><th>Roll</th><th>Class</th><th>Attendance</th>
                  </tr></thead>
                  <tbody>
                    ${atRisk.map(function(s) {
                      return `<tr class="row-risk">
                        <td>${s.name}</td>
                        <td>${s.roll_no || '—'}</td>
                        <td>${s.className}</td>
                        <td><span class="pct-badge pct-danger">${s.pct}%</span></td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- Quick actions -->
        <div class="section-block">
          <h3 class="section-subtitle">Quick Actions</h3>
          <div class="more-grid">
            <button class="more-card" onclick="PRINCIPAL.loadTab('teachers')">
              <span>👨‍🏫</span><strong>Teachers</strong><small>Manage staff</small>
            </button>
            <button class="more-card" onclick="PRINCIPAL.loadTab('classes')">
              <span>🏫</span><strong>Classes</strong><small>Manage classes</small>
            </button>
            <button class="more-card" onclick="PRINCIPAL.loadTab('exams')">
              <span>📝</span><strong>Exams</strong><small>Exams &amp; subjects</small>
            </button>
            <button class="more-card" onclick="PRINCIPAL.showSettings()">
              <span>⚙️</span><strong>Settings</strong><small>School &amp; account</small>
            </button>
            <button class="more-card" onclick="PRINCIPAL.showImport()">
              <span>📥</span><strong>Import</strong><small>Bulk upload</small>
            </button>
            <button class="more-card" onclick="PRINCIPAL.showMarksOverview()">
              <span>📊</span><strong>Marks</strong><small>School overview</small>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // ─── AT-RISK CALCULATION ────────────────────────────────────────────
  getAtRiskStudents(students, school_id) {
    const allAtt = APP.getLocalBySchool('attendance', school_id);
    const classes = APP.getLocalBySchool('classes',   school_id);
    const result  = [];
    students.forEach(function(s) {
      const sAtt    = allAtt.filter(function(a) { return a.student_id === s.student_id; });
      if (sAtt.length === 0) return;
      const present = sAtt.filter(function(a) { return a.status === 'present'; }).length;
      const pct     = Math.round((present / sAtt.length) * 100);
      if (pct < 75) {
        const cls = classes.find(function(c) { return c.class_id === s.class_id; });
        result.push({
          name:      s.name,
          roll_no:   s.roll_no || '—',
          className: cls ? cls.name : '—',
          pct:       pct
        });
      }
    });
    return result.sort(function(a, b) { return a.pct - b.pct; });
  },

  // ─── GRADE HELPER ────────────────────────────────────────────────────
  _calcGrade(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  },

  // ─── TEACHERS ───────────────────────────────────────────────────────
  async renderTeachers() {
    const sid     = APP.session.school_id;
    const content = document.getElementById('principal-content');

    if (SYNC.isOnline) {
      const res = await DB.getUsersBySchool(sid, 'teacher');
      if (!res.error && res.data) {
        res.data.forEach(function(u) { APP.cacheUser(u); });
      }
    }
    const teachers = APP.getLocalUsers().filter(function(u) {
      return u.school_id === sid && u.role === 'teacher';
    });
    const classes  = APP.getLocalBySchool('classes', sid);
    const allAtt   = APP.getLocalBySchool('attendance', sid);
    const today    = APP.today();

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Teachers</h2>
          <button class="btn-primary-sm" onclick="PRINCIPAL.showAddTeacher()">+ Add Teacher</button>
        </div>

        <div id="add-teacher-form" class="form-card hidden">
          <h3>New Teacher</h3>
          <div class="two-col">
            <input id="t-name"  class="input" type="text"     placeholder="Full name *" />
            <input id="t-user"  class="input" type="text"     placeholder="Username *" />
          </div>
          <div class="two-col">
            <input id="t-pass"  class="input" type="password" placeholder="Password (min 4 chars) *" />
            <input id="t-phone" class="input" type="tel"      placeholder="Phone (optional)" />
          </div>
          <select id="t-class" class="input">
            <option value="">-- Assign Class (optional) --</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
          <div id="t-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="PRINCIPAL.hideAddTeacher()">Cancel</button>
            <button class="btn-primary"   onclick="PRINCIPAL.addTeacher()">Create Teacher</button>
          </div>
        </div>

        ${teachers.length === 0
          ? '<p class="empty-msg">No teachers yet. Add one above.</p>'
          : `<div class="list-cards" id="teachers-list">
              ${teachers.map(function(t) {
                const assignedClass = classes.find(function(c) { return c.teacher_id === t.user_id; });

                // last attendance marked by this teacher
                const teacherAtt = allAtt
                  .filter(function(a) { return a.teacher_id === t.user_id; })
                  .sort(function(a, b) { return b.date.localeCompare(a.date); });
                const lastAtt      = teacherAtt[0];
                const lastActivity = lastAtt ? 'Last marked: ' + lastAtt.date : 'No attendance marked yet';

                // geo verification status from last session
                let geoBadge = '';
                if (lastAtt) {
                  if (lastAtt.geo_lat !== null && lastAtt.geo_lat !== undefined) {
                    if (lastAtt.geo_verified) {
                      geoBadge = '<span style="color:var(--success);font-size:11px;">📍 Location verified</span>';
                    } else {
                      geoBadge = '<span style="color:var(--warn);font-size:11px;">⚠️ Location uncertain (' + (lastAtt.geo_accuracy || '?') + 'm)</span>';
                    }
                  } else {
                    geoBadge = '<span style="color:var(--text3);font-size:11px;">📍 No location data</span>';
                  }
                }

                // today's geo status
                const todayAtt = allAtt.filter(function(a) {
                  return a.teacher_id === t.user_id && a.date === today;
                });
                const todayVerified  = todayAtt.some(function(a) { return a.geo_verified; });
                const todayHasGeo    = todayAtt.some(function(a) { return a.geo_lat !== null && a.geo_lat !== undefined; });
                const todayMarked    = todayAtt.length > 0;

                let todayStatus = '';
                if (todayMarked) {
                  if (todayVerified) {
                    todayStatus = '<span class="pct-badge pct-ok" style="font-size:10px;">✅ Marked today · verified</span>';
                  } else if (todayHasGeo) {
                    todayStatus = '<span class="pct-badge pct-warn" style="font-size:10px;">⚠️ Marked today · location uncertain</span>';
                  } else {
                    todayStatus = '<span class="pct-badge pct-warn" style="font-size:10px;">📋 Marked today · no location</span>';
                  }
                } else {
                  todayStatus = '<span class="pct-badge pct-danger" style="font-size:10px;">❌ Not marked today</span>';
                }

                return `<div class="list-card">
                  <div class="list-card-info">
                    <strong>${t.name}</strong>
                    <small>@${t.username} &bull; ${t.phone || 'No phone'}</small>
                    <small>Class: ${assignedClass ? assignedClass.name : 'Unassigned'}</small>
                    <small style="color:var(--text3);">📅 ${lastActivity}</small>
                    <small>${todayStatus}</small>
                    <small>${geoBadge}</small>
                  </div>
                  <div class="list-card-actions">
                    <button class="btn-secondary-sm"
                      onclick="PRINCIPAL.showGeoLog('${t.user_id}','${t.name.replace(/'/g,"\\'")}')">
                      📍
                    </button>
                    <button class="btn-primary-sm"
                      onclick="PRINCIPAL.showEditTeacher('${t.user_id}')">✏️</button>
                    <button class="btn-secondary-sm"
                      onclick="PRINCIPAL.showAssignClass('${t.user_id}','${t.name.replace(/'/g,"\\'")}')">
                      Assign
                    </button>
                    <button class="btn-danger-sm"
                      onclick="PRINCIPAL.deleteTeacher('${t.user_id}','${t.name.replace(/'/g,"\\'")}')">
                      Del
                    </button>
                  </div>
                </div>`;
              }).join('')}
            </div>`
        }
        <div id="teacher-sub-form"></div>
      </div>
    `;
  },

  showAddTeacher() {
    document.getElementById('add-teacher-form').classList.remove('hidden');
    const sub = document.getElementById('teacher-sub-form');
    if (sub) sub.innerHTML = '';
  },

  hideAddTeacher() {
    document.getElementById('add-teacher-form').classList.add('hidden');
    ['t-name','t-user','t-pass','t-phone'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const cls = document.getElementById('t-class');
    if (cls) cls.selectedIndex = 0;
    document.getElementById('t-error').textContent = '';
  },

  async addTeacher() {
    const name    = document.getElementById('t-name').value.trim();
    const uname   = document.getElementById('t-user').value.trim();
    const pass    = document.getElementById('t-pass').value.trim();
    const phone   = document.getElementById('t-phone').value.trim();
    const classId = document.getElementById('t-class').value;
    const errEl   = document.getElementById('t-error');
    errEl.textContent = '';

    if (!name || !uname || !pass) { errEl.textContent = 'Name, username and password are required.'; return; }
    if (pass.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; return; }

    const localDup = APP.getLocalUsers().find(function(u) { return u.username === uname; });
    if (localDup) { errEl.textContent = 'Username already taken.'; return; }

    if (SYNC.isOnline) {
      const check = await DB.getUserByUsername(uname);
      if (check.data && check.data.length > 0) { errEl.textContent = 'Username already taken.'; return; }
    }

    const user_id = APP.uuid();
    const record  = {
      user_id:    user_id,
      school_id:  APP.session.school_id,
      name:       name,
      role:       'teacher',
      username:   uname,
      password:   pass,
      phone:      phone || null,
      created_at: new Date().toISOString()
    };

    await APP.writeRecord('users', record, 'user_id');
    if (classId) await PRINCIPAL.assignClassToTeacher(user_id, classId);
    APP.showToast('Teacher ' + name + ' created.', 'ok');
    PRINCIPAL.hideAddTeacher();
    await PRINCIPAL.renderTeachers();
  },

  // ─── EDIT TEACHER ────────────────────────────────────────────────────
  showEditTeacher(user_id) {
    const teacher = APP.getLocalUsers().find(function(u) { return u.user_id === user_id; });
    if (!teacher) { APP.showToast('Teacher not found.', 'error'); return; }
    const sub = document.getElementById('teacher-sub-form');
    sub.innerHTML = `
      <div class="form-card">
        <h3>Edit Teacher</h3>
        <div class="two-col">
          <input id="et-name"  class="input" type="text"
            placeholder="Full name *" value="${teacher.name.replace(/"/g,'&quot;')}" />
          <input id="et-phone" class="input" type="tel"
            placeholder="Phone" value="${teacher.phone || ''}" />
        </div>
        <input id="et-pass" class="input" type="password"
          placeholder="New password (leave blank to keep current)" />
        <div id="et-error" class="error-msg"></div>
        <div class="form-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('teacher-sub-form').innerHTML=''">Cancel</button>
          <button class="btn-primary"
            onclick="PRINCIPAL.saveEditTeacher('${user_id}')">💾 Save</button>
        </div>
      </div>
    `;
    sub.scrollIntoView({ behavior: 'smooth' });
  },

  async saveEditTeacher(user_id) {
    const name  = document.getElementById('et-name').value.trim();
    const phone = document.getElementById('et-phone').value.trim();
    const pass  = document.getElementById('et-pass').value.trim();
    const errEl = document.getElementById('et-error');
    errEl.textContent = '';

    if (!name) { errEl.textContent = 'Name is required.'; return; }
    if (pass && pass.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; return; }

    const teacher = APP.getLocalUsers().find(function(u) { return u.user_id === user_id; });
    if (!teacher) { errEl.textContent = 'Teacher not found.'; return; }

    teacher.name       = name;
    teacher.phone      = phone || null;
    if (pass) teacher.password = pass;
    teacher.updated_at = new Date().toISOString();

    // FIX BUG 6 — only writeRecord, skip redundant cacheUser
    await APP.writeRecord('users', teacher, 'user_id');
    APP.showToast(name + ' updated.', 'ok');
    document.getElementById('teacher-sub-form').innerHTML = '';
    await PRINCIPAL.renderTeachers();
  },

  // ─── TEACHER-CLASS ASSIGNMENT ─────────────────────────────────────────
  showAssignClass(user_id, teacherName) {
    const sid     = APP.session.school_id;
    const classes = APP.getLocalBySchool('classes', sid);
    const current = classes.find(function(c) { return c.teacher_id === user_id; });
    const sub     = document.getElementById('teacher-sub-form');
    sub.innerHTML = `
      <div class="form-card">
        <h3>Assign Class to ${teacherName}</h3>
        <select id="assign-class-select" class="input">
          <option value="">-- No class (unassign) --</option>
          ${classes.map(function(c) {
            return `<option value="${c.class_id}"
              ${c.class_id === (current ? current.class_id : '') ? 'selected' : ''}>
              ${c.name}
            </option>`;
          }).join('')}
        </select>
        <div class="form-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('teacher-sub-form').innerHTML=''">Cancel</button>
          <button class="btn-primary"
            onclick="PRINCIPAL.saveAssignClass('${user_id}')">💾 Save Assignment</button>
        </div>
      </div>
    `;
    sub.scrollIntoView({ behavior: 'smooth' });
  },

  async saveAssignClass(user_id) {
    const classId = document.getElementById('assign-class-select').value;
    await PRINCIPAL.assignClassToTeacher(user_id, classId);
    APP.showToast('Class assignment saved.', 'ok');
    document.getElementById('teacher-sub-form').innerHTML = '';
    await PRINCIPAL.renderTeachers();
  },

  async assignClassToTeacher(user_id, classId) {
    const sid = APP.session.school_id;
    // FIX BUG 2 — read fresh before each write to avoid stale array
    const classesToUnassign = APP.getLocalBySchool('classes', sid).filter(function(c) {
      return c.teacher_id === user_id;
    });
    for (const c of classesToUnassign) {
      const updated = Object.assign({}, c, { teacher_id: null });
      await APP.writeRecord('classes', updated, 'class_id');
    }
    if (classId) {
      const freshClasses = APP.getLocalBySchool('classes', sid);
      const cls = freshClasses.find(function(c) { return c.class_id === classId; });
      if (cls) {
        const updated = Object.assign({}, cls, { teacher_id: user_id });
        await APP.writeRecord('classes', updated, 'class_id');
      }
    }
  },

  async deleteTeacher(user_id, name) {
    APP.showModal('Delete Teacher',
      'Delete ' + name + '? Their class assignment will also be removed.',
      async function() {
        await PRINCIPAL.assignClassToTeacher(user_id, null);
        await APP.deleteRecord('users', 'user_id', user_id, APP.session.school_id);
        APP.showToast('Teacher deleted.', 'ok');
        await PRINCIPAL.renderTeachers();
      }, 'Delete');
  },

  // ─── GEO LOG ─────────────────────────────────────────────────────────
  showGeoLog(user_id, teacherName) {
    const sid    = APP.session.school_id;
    const allAtt = APP.getLocalBySchool('attendance', sid)
      .filter(function(a) { return a.teacher_id === user_id; })
      .sort(function(a, b) { return b.date.localeCompare(a.date); });

    // get unique sessions by date (one row per day, not per student)
    const sessions = [];
    const seen     = {};
    allAtt.forEach(function(a) {
      if (!seen[a.date]) {
        seen[a.date] = true;
        sessions.push(a);
      }
    });

    const sub = document.getElementById('teacher-sub-form');
    if (!sub) return;

    if (sessions.length === 0) {
      sub.innerHTML = `
        <div class="form-card">
          <div class="section-header">
            <h3>📍 Geo Log — ${teacherName}</h3>
            <button class="btn-secondary-sm"
              onclick="document.getElementById('teacher-sub-form').innerHTML=''">Close</button>
          </div>
          <p class="empty-msg">No attendance sessions recorded yet.</p>
        </div>`;
      sub.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // summary stats
    const totalSessions  = sessions.length;
    const verifiedCount  = sessions.filter(function(a) { return a.geo_verified; }).length;
    const noGeoCount     = sessions.filter(function(a) {
      return a.geo_lat === null || a.geo_lat === undefined;
    }).length;
    const uncertainCount = totalSessions - verifiedCount - noGeoCount;

    sub.innerHTML = `
      <div class="form-card">
        <div class="section-header">
          <h3>📍 Geo Attendance Log — ${teacherName}</h3>
          <button class="btn-secondary-sm"
            onclick="document.getElementById('teacher-sub-form').innerHTML=''">Close</button>
        </div>

        <!-- Summary stats -->
        <div class="stats-grid" style="margin-bottom:14px;">
          <div class="stat-card stat-ok">
            <div class="stat-number">${verifiedCount}</div>
            <div class="stat-label">Verified</div>
          </div>
          <div class="stat-card stat-warn">
            <div class="stat-number">${uncertainCount}</div>
            <div class="stat-label">Uncertain</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${noGeoCount}</div>
            <div class="stat-label">No Location</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${totalSessions}</div>
            <div class="stat-label">Total Sessions</div>
          </div>
        </div>

        <!-- Session log table -->
        <div class="table-wrap">
          <table class="data-table small-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location Status</th>
                <th>Accuracy</th>
                <th>Coordinates</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.slice(0, 20).map(function(a) {
                let statusBadge, coords;
                if (a.geo_lat !== null && a.geo_lat !== undefined) {
                  if (a.geo_verified) {
                    statusBadge = '<span class="pct-badge pct-ok">✅ Verified</span>';
                  } else {
                    statusBadge = '<span class="pct-badge pct-warn">⚠️ Uncertain</span>';
                  }
                  coords = `<a href="https://maps.google.com/?q=${a.geo_lat},${a.geo_long}"
                    target="_blank"
                    style="color:var(--primary-lt);font-size:11px;">
                    ${a.geo_lat}, ${a.geo_long}
                  </a>`;
                } else {
                  statusBadge = '<span class="pct-badge" style="background:var(--bg3);color:var(--text2);">— No Data</span>';
                  coords      = '<span style="color:var(--text3);">—</span>';
                }
                return `<tr>
                  <td>${a.date}</td>
                  <td>${statusBadge}</td>
                  <td>${a.geo_accuracy !== null && a.geo_accuracy !== undefined ? a.geo_accuracy + 'm' : '—'}</td>
                  <td>${coords}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${sessions.length > 20
          ? `<p style="font-size:12px;color:var(--text2);margin-top:8px;text-align:center;">
              Showing latest 20 of ${sessions.length} sessions
            </p>`
          : ''
        }
      </div>
    `;
    sub.scrollIntoView({ behavior: 'smooth' });
  },

  // ─── CLASSES ────────────────────────────────────────────────────────
  async renderClasses() {
    const sid      = APP.session.school_id;
    const content  = document.getElementById('principal-content');
    const classes  = APP.getLocalBySchool('classes',  sid);
    const students = APP.getLocalBySchool('students', sid);
    const teachers = APP.getLocalUsers().filter(function(u) {
      return u.school_id === sid && u.role === 'teacher';
    });

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Classes</h2>
          <button class="btn-primary-sm" onclick="PRINCIPAL.showAddClass()">+ Add Class</button>
        </div>

        <div id="add-class-form" class="form-card hidden">
          <h3>New Class</h3>
          <input id="c-name" class="input" type="text" placeholder="Class name (e.g. Class 6A) *" />
          <select id="c-teacher" class="input">
            <option value="">-- Assign Teacher (optional) --</option>
            ${teachers.map(function(t) {
              return `<option value="${t.user_id}">${t.name} (@${t.username})</option>`;
            }).join('')}
          </select>
          <div id="c-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="PRINCIPAL.hideAddClass()">Cancel</button>
            <button class="btn-primary"   onclick="PRINCIPAL.addClass()">Create Class</button>
          </div>
        </div>

        ${classes.length === 0
          ? '<p class="empty-msg">No classes yet. Add one above.</p>'
          : `<div class="list-cards">
              ${classes.map(function(c) {
                const count   = students.filter(function(s) { return s.class_id === c.class_id; }).length;
                const teacher = teachers.find(function(t) { return t.user_id === c.teacher_id; });
                return `<div class="list-card">
                  <div class="list-card-info">
                    <strong>${c.name}</strong>
                    <small>${count} student(s) &bull; Teacher: ${teacher ? teacher.name : 'Unassigned'}</small>
                  </div>
                  <div class="list-card-actions">
                    <button class="btn-secondary-sm"
                      onclick="PRINCIPAL.viewClassStudents('${c.class_id}','${c.name.replace(/'/g,"\\'")}')">
                      View
                    </button>
                    <button class="btn-primary-sm"
                      onclick="PRINCIPAL.showEditClass('${c.class_id}','${c.name.replace(/'/g,"\\'")}')">
                      ✏️
                    </button>
                    <button class="btn-danger-sm"
                      onclick="PRINCIPAL.deleteClass('${c.class_id}','${c.name.replace(/'/g,"\\'")}')">
                      Del
                    </button>
                  </div>
                </div>`;
              }).join('')}
            </div>`
        }
        <div id="class-sub-view"></div>
      </div>
    `;
  },

  showAddClass() {
    document.getElementById('add-class-form').classList.remove('hidden');
    const sub = document.getElementById('class-sub-view');
    if (sub) sub.innerHTML = '';
  },

  hideAddClass() {
    document.getElementById('add-class-form').classList.add('hidden');
    document.getElementById('c-name').value = '';
    document.getElementById('c-error').textContent = '';
    const ct = document.getElementById('c-teacher');
    if (ct) ct.selectedIndex = 0;
  },

  async addClass() {
    const name      = document.getElementById('c-name').value.trim();
    const teacherId = document.getElementById('c-teacher').value;
    const errEl     = document.getElementById('c-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Class name is required.'; return; }

    const sid      = APP.session.school_id;
    const existing = APP.getLocalBySchool('classes', sid);
    const dup      = existing.find(function(c) {
      return c.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { errEl.textContent = 'A class with this name already exists.'; return; }

    const record = {
      class_id:   APP.uuid(),
      school_id:  sid,
      name:       name,
      teacher_id: teacherId || null,
      created_at: new Date().toISOString()
    };
    await APP.writeRecord('classes', record, 'class_id');
    APP.showToast('Class ' + name + ' created.', 'ok');
    PRINCIPAL.hideAddClass();
    await PRINCIPAL.renderClasses();
  },

  showEditClass(class_id, currentName) {
    const sid      = APP.session.school_id;
    const teachers = APP.getLocalUsers().filter(function(u) {
      return u.school_id === sid && u.role === 'teacher';
    });
    const classes  = APP.getLocalBySchool('classes', sid);
    const cls      = classes.find(function(c) { return c.class_id === class_id; });
    const sub      = document.getElementById('class-sub-view');
    sub.innerHTML = `
      <div class="form-card">
        <h3>Edit Class</h3>
        <input id="ec-name" class="input" type="text"
          placeholder="Class name *" value="${currentName.replace(/"/g,'&quot;')}" />
        <select id="ec-teacher" class="input">
          <option value="">-- Unassigned --</option>
          ${teachers.map(function(t) {
            return `<option value="${t.user_id}"
              ${cls && cls.teacher_id === t.user_id ? 'selected' : ''}>
              ${t.name} (@${t.username})
            </option>`;
          }).join('')}
        </select>
        <div id="ec-error" class="error-msg"></div>
        <div class="form-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('class-sub-view').innerHTML=''">Cancel</button>
          <button class="btn-primary"
            onclick="PRINCIPAL.saveEditClass('${class_id}')">💾 Save</button>
        </div>
      </div>
    `;
    sub.scrollIntoView({ behavior: 'smooth' });
  },

  async saveEditClass(class_id) {
    const name      = document.getElementById('ec-name').value.trim();
    const teacherId = document.getElementById('ec-teacher').value;
    const errEl     = document.getElementById('ec-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Class name is required.'; return; }

    const sid     = APP.session.school_id;
    const classes = APP.getLocalBySchool('classes', sid);
    const dup     = classes.find(function(c) {
      return c.class_id !== class_id && c.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { errEl.textContent = 'Another class with this name already exists.'; return; }

    const cls = classes.find(function(c) { return c.class_id === class_id; });
    if (!cls) { errEl.textContent = 'Class not found.'; return; }

    const updated = Object.assign({}, cls, {
      name:       name,
      teacher_id: teacherId || null,
      updated_at: new Date().toISOString()
    });
    await APP.writeRecord('classes', updated, 'class_id');
    APP.showToast('Class updated.', 'ok');
    document.getElementById('class-sub-view').innerHTML = '';
    await PRINCIPAL.renderClasses();
  },

  // FIX BUG 5 — deleteClass now orphans students by clearing their class_id
  async deleteClass(class_id, name) {
    APP.showModal('Delete Class',
      'Delete ' + name + '? All students in this class will be unassigned.',
      async function() {
        const sid      = APP.session.school_id;
        // unassign all students in this class
        const students = APP.getLocalBySchool('students', sid).filter(function(s) {
          return s.class_id === class_id;
        });
        for (const s of students) {
          const updated = Object.assign({}, s, { class_id: null });
          await APP.writeRecord('students', updated, 'student_id');
        }
        await APP.deleteRecord('classes', 'class_id', class_id, sid);
        APP.showToast('Class deleted. ' + students.length + ' student(s) unassigned.', 'ok');
        await PRINCIPAL.renderClasses();
      }, 'Delete');
  },

  // ─── VIEW CLASS STUDENTS ─────────────────────────────────────────────
  viewClassStudents(class_id, className) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid).filter(function(s) {
      return s.class_id === class_id;
    });
    students.sort(function(a, b) {
      return (a.roll_no || '').localeCompare(b.roll_no || '', undefined, { numeric: true });
    });

    const sub = document.getElementById('class-sub-view');
    sub.innerHTML = `
      <div class="section-block">
        <div class="section-header">
          <h3 class="section-subtitle">Students in ${className}</h3>
          <button class="btn-secondary-sm"
            onclick="document.getElementById('class-sub-view').innerHTML=''">Close</button>
        </div>
        ${students.length === 0
          ? '<p class="empty-msg">No students in this class yet.</p>'
          : `<div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>Roll</th><th>Name</th><th>DOB</th><th>Parent Phone</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  ${students.map(function(s) {
                    return `<tr>
                      <td>${s.roll_no || '—'}</td>
                      <td>${s.name}</td>
                      <td>${s.dob || '—'}</td>
                      <td>${s.parent_phone || '—'}</td>
                      <td>
                        <div style="display:flex;gap:4px;">
                          <button class="btn-primary-sm"
                            onclick="PRINCIPAL.showEditStudent('${s.student_id}')">✏️</button>
                          <button class="btn-danger-sm"
                            onclick="PRINCIPAL.deleteStudent('${s.student_id}','${s.name.replace(/'/g,"\\'")}')">Del</button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`
        }
        <div id="student-edit-area"></div>
      </div>
    `;
    sub.scrollIntoView({ behavior: 'smooth' });
  },

  // ─── EDIT STUDENT (principal override) ──────────────────────────────
  showEditStudent(student_id) {
    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);
    const s        = students.find(function(st) { return st.student_id === student_id; });
    if (!s) { APP.showToast('Student not found.', 'error'); return; }

    const classes = APP.getLocalBySchool('classes', sid);
    // FIX UI ISSUE 2 — ensure student-edit-area exists, if not recreate it in class-sub-view
    let area = document.getElementById('student-edit-area');
    if (!area) {
      const sub = document.getElementById('class-sub-view');
      if (!sub) { APP.showToast('Please open class view first.', 'warning'); return; }
      const div  = document.createElement('div');
      div.id     = 'student-edit-area';
      sub.appendChild(div);
      area = div;
    }

    area.innerHTML = `
      <div class="form-card" style="margin-top:12px;">
        <h3>Edit Student — Principal Override</h3>
        <small class="override-note">⚠️ Changes will be timestamped and synced.</small>
        <div class="two-col">
          <input id="pe-name"  class="input" type="text"
            placeholder="Full name *" value="${s.name.replace(/"/g,'&quot;')}" />
          <input id="pe-roll"  class="input" type="text"
            placeholder="Roll No *" value="${s.roll_no || ''}" />
        </div>
        <div class="two-col">
          <input id="pe-dob"   class="input" type="date"   value="${s.dob || ''}" />
          <input id="pe-phone" class="input" type="tel"
            placeholder="Parent phone" value="${s.parent_phone || ''}" />
        </div>
        <select id="pe-class" class="input">
          <option value="">-- Select Class --</option>
          ${classes.map(function(c) {
            return `<option value="${c.class_id}" ${c.class_id === s.class_id ? 'selected' : ''}>
              ${c.name}
            </option>`;
          }).join('')}
        </select>
        <div id="pe-error" class="error-msg"></div>
        <div class="form-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('student-edit-area').innerHTML=''">Cancel</button>
          <button class="btn-primary"
            onclick="PRINCIPAL.saveEditStudent('${student_id}')">💾 Save Override</button>
        </div>
      </div>
    `;
    area.scrollIntoView({ behavior: 'smooth' });
  },

  async saveEditStudent(student_id) {
    const name    = document.getElementById('pe-name').value.trim();
    const roll    = document.getElementById('pe-roll').value.trim();
    const dob     = document.getElementById('pe-dob').value;
    const phone   = document.getElementById('pe-phone').value.trim();
    const classId = document.getElementById('pe-class').value;
    const errEl   = document.getElementById('pe-error');
    errEl.textContent = '';

    if (!name)    { errEl.textContent = 'Name is required.';    return; }
    if (!roll)    { errEl.textContent = 'Roll No is required.'; return; }
    if (!classId) { errEl.textContent = 'Select a class.';      return; }

    const sid      = APP.session.school_id;
    const students = APP.getLocalBySchool('students', sid);

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

    const original = students.find(function(s) { return s.student_id === student_id; });
    if (!original) { errEl.textContent = 'Student not found.'; return; }

    const updated = Object.assign({}, original, {
      name:         name,
      roll_no:      roll,
      dob:          dob || null,
      parent_phone: phone || null,
      class_id:     classId,
      edited_by:    'principal',
      edited_at:    new Date().toISOString()
    });

    await APP.writeRecord('students', updated, 'student_id');
    APP.showToast(name + ' updated.', 'ok');
    document.getElementById('student-edit-area').innerHTML = '';
    await PRINCIPAL.renderClasses();
  },

  async deleteStudent(student_id, name) {
    APP.showModal('Delete Student',
      'Delete ' + name + ' and all their attendance/marks? This cannot be undone.',
      async function() {
        const hasPending = await SYNC.studentHasPending(student_id);
        if (hasPending) await SYNC.removePendingForStudent(student_id);
        APP.removeLocal('students',   'student_id', student_id);
        APP.removeLocal('attendance', 'student_id', student_id);
        APP.removeLocal('marks',      'student_id', student_id);
        if (SYNC.isOnline) {
          await DB.deleteStudentCascade(student_id);
        } else {
          await SYNC.addToQueue('students', 'delete',
            { student_id: student_id }, APP.session.school_id);
        }
        APP.showToast('Student deleted.', 'ok');
        await PRINCIPAL.renderClasses();
      }, 'Delete');
  },

  // ─── EXAMS & SUBJECTS ───────────────────────────────────────────────
  async renderExams() {
    const sid      = APP.session.school_id;
    const content  = document.getElementById('principal-content');
    const exams    = APP.getLocalBySchool('exams',    sid);
    const subjects = APP.getLocalBySchool('subjects', sid);

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Exams &amp; Subjects</h2>
        </div>

        <!-- Subject form — outside two-col so it expands properly -->
        <div id="add-subject-form" class="form-card hidden">
          <h3>New Subject</h3>
          <input id="sub-name" class="input" type="text" placeholder="Subject name *" />
          <div id="sub-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="PRINCIPAL.hideAddSubject()">Cancel</button>
            <button class="btn-primary"   onclick="PRINCIPAL.addSubject()">Add Subject</button>
          </div>
        </div>

        <!-- Exam form — outside two-col so it expands properly -->
        <div id="add-exam-form" class="form-card hidden">
          <h3>New Exam</h3>
          <input id="exam-name" class="input" type="text"
            placeholder="Exam name (e.g. Unit Test 1, Mid Term) *" />
          <div id="exam-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-secondary" onclick="PRINCIPAL.hideAddExam()">Cancel</button>
            <button class="btn-primary"   onclick="PRINCIPAL.addExam()">Add Exam</button>
          </div>
        </div>

        <div class="two-col">
          <div class="col-block">
            <div class="section-header">
              <h3 class="section-subtitle">Subjects</h3>
              <button class="btn-primary-sm" onclick="PRINCIPAL.showAddSubject()">+ Add</button>
            </div>
            ${subjects.length === 0
              ? '<p class="empty-msg">No subjects yet.</p>'
              : `<ul class="simple-list">
                  ${subjects.map(function(s) {
                    return `<li>
                      <span>${s.name}</span>
                      <button class="btn-danger-sm"
                        onclick="PRINCIPAL.deleteSubject('${s.subject_id}','${s.name.replace(/'/g,"\\'")}')">✕</button>
                    </li>`;
                  }).join('')}
                </ul>`
            }
          </div>

          <div class="col-block">
            <div class="section-header">
              <h3 class="section-subtitle">Exams</h3>
              <button class="btn-primary-sm" onclick="PRINCIPAL.showAddExam()">+ Add</button>
            </div>
            ${exams.length === 0
              ? '<p class="empty-msg">No exams yet.</p>'
              : `<ul class="simple-list">
                  ${exams.map(function(e) {
                    return `<li>
                      <span>${e.name}</span>
                      <button class="btn-danger-sm"
                        onclick="PRINCIPAL.deleteExam('${e.exam_id}','${e.name.replace(/'/g,"\\'")}')">✕</button>
                    </li>`;
                  }).join('')}
                </ul>`
            }
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px;">
          <button class="btn-secondary full-width" onclick="PRINCIPAL.showMarksOverview()">
            📊 View School-Wide Marks Overview
          </button>
          <button class="btn-secondary full-width" onclick="PRINCIPAL.exportData()">
            📤 Export All Data
          </button>
        </div>
      </div>
    `;
  },

  showAddSubject() { document.getElementById('add-subject-form').classList.remove('hidden'); },
  hideAddSubject() {
    document.getElementById('add-subject-form').classList.add('hidden');
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-error').textContent = '';
  },

  async addSubject() {
    const name  = document.getElementById('sub-name').value.trim();
    const errEl = document.getElementById('sub-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Subject name is required.'; return; }
    const sid = APP.session.school_id;
    const dup = APP.getLocalBySchool('subjects', sid).find(function(s) {
      return s.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { errEl.textContent = 'Subject already exists.'; return; }
    const record = { subject_id: APP.uuid(), school_id: sid, name: name, created_at: new Date().toISOString() };
    await APP.writeRecord('subjects', record, 'subject_id');
    APP.showToast('Subject added.', 'ok');
    PRINCIPAL.hideAddSubject();
    await PRINCIPAL.renderExams();
  },

  async deleteSubject(subject_id, name) {
    APP.showModal('Delete Subject', 'Delete subject "' + name + '"?', async function() {
      await APP.deleteRecord('subjects', 'subject_id', subject_id, APP.session.school_id);
      APP.showToast('Subject deleted.', 'ok');
      await PRINCIPAL.renderExams();
    }, 'Delete');
  },

  showAddExam() { document.getElementById('add-exam-form').classList.remove('hidden'); },
  hideAddExam() {
    document.getElementById('add-exam-form').classList.add('hidden');
    document.getElementById('exam-name').value = '';
    document.getElementById('exam-error').textContent = '';
  },

  async addExam() {
    const name  = document.getElementById('exam-name').value.trim();
    const errEl = document.getElementById('exam-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'Exam name is required.'; return; }
    const sid = APP.session.school_id;
    const dup = APP.getLocalBySchool('exams', sid).find(function(e) {
      return e.name.toLowerCase() === name.toLowerCase();
    });
    if (dup) { errEl.textContent = 'Exam already exists.'; return; }
    const record = { exam_id: APP.uuid(), school_id: sid, name: name, created_at: new Date().toISOString() };
    await APP.writeRecord('exams', record, 'exam_id');
    APP.showToast('Exam added.', 'ok');
    PRINCIPAL.hideAddExam();
    await PRINCIPAL.renderExams();
  },

  async deleteExam(exam_id, name) {
    APP.showModal('Delete Exam', 'Delete exam "' + name + '"?', async function() {
      await APP.deleteRecord('exams', 'exam_id', exam_id, APP.session.school_id);
      APP.showToast('Exam deleted.', 'ok');
      await PRINCIPAL.renderExams();
    }, 'Delete');
  },

  // ─── MARKS OVERVIEW ─────────────────────────────────────────────────
  showMarksOverview() {
    const sid      = APP.session.school_id;
    const content  = document.getElementById('principal-content');
    const allMarks = APP.getLocalBySchool('marks',    sid);
    const students = APP.getLocalBySchool('students', sid);
    const classes  = APP.getLocalBySchool('classes',  sid);

    // FIX UI ISSUE 1 — update nav to show exams tab active
    document.querySelectorAll('#screen-principal .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === 'exams');
    });

    if (allMarks.length === 0) {
      content.innerHTML = `
        <div class="tab-section">
          <div class="section-header">
            <h2 class="section-title">Marks Overview</h2>
            <button class="btn-secondary-sm" onclick="PRINCIPAL.loadTab('exams')">← Back</button>
          </div>
          <p class="empty-msg">No marks recorded yet.</p>
        </div>`;
      return;
    }

    const byClass = {};
    classes.forEach(function(c) { byClass[c.class_id] = []; });
    students.forEach(function(s) {
      const sMarks   = allMarks.filter(function(m) { return m.student_id === s.student_id; });
      if (sMarks.length === 0) return;
      const totalObt = sMarks.reduce(function(acc, m) { return acc + m.marks_obtained; }, 0);
      const totalMax = sMarks.reduce(function(acc, m) { return acc + m.max_marks; }, 0);
      const pct      = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
      const grade    = PRINCIPAL._calcGrade(pct);
      if (!byClass[s.class_id]) byClass[s.class_id] = [];
      byClass[s.class_id].push({ name: s.name, roll: s.roll_no || '—', pct, grade });
    });

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Marks Overview</h2>
          <button class="btn-secondary-sm" onclick="PRINCIPAL.loadTab('exams')">← Back</button>
        </div>
        ${classes.map(function(c) {
          const rows = (byClass[c.class_id] || []).sort(function(a, b) { return b.pct - a.pct; });
          if (rows.length === 0) return '';
          const avgPct = Math.round(rows.reduce(function(a, r) { return a + r.pct; }, 0) / rows.length);
          return `<div class="form-card">
            <div class="section-header">
              <h3>${c.name}</h3>
              <span class="pct-badge ${avgPct >= 60 ? 'pct-ok' : avgPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                Avg: ${avgPct}%
              </span>
            </div>
            <div class="table-wrap">
              <table class="data-table small-table">
                <thead><tr><th>Roll</th><th>Name</th><th>Overall %</th><th>Grade</th></tr></thead>
                <tbody>
                  ${rows.map(function(r) {
                    return `<tr>
                      <td>${r.roll}</td><td>${r.name}</td>
                      <td><span class="pct-badge ${r.pct >= 60 ? 'pct-ok' : r.pct >= 35 ? 'pct-warn' : 'pct-danger'}">${r.pct}%</span></td>
                      <td><strong>${r.grade}</strong></td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  },

  // ─── EXPORT DATA (MISSING FEATURE 1) ────────────────────────────────
  exportData() {
    const sid  = APP.session.school_id;
    const data = {
      exported_at: new Date().toISOString(),
      exported_by: APP.session.name,
      school_id:   sid,
      schools:     APP.getLocal('schools').filter(function(s) { return s.school_id === sid; }),
      classes:     APP.getLocalBySchool('classes',    sid),
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
    a.download = 'edutrack-backup-' + APP.today() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    APP.showToast('Data exported successfully.', 'ok');
  },

  // ─── SETTINGS ───────────────────────────────────────────────────────
  showSettings() {
    const sid     = APP.session.school_id;
    const content = document.getElementById('principal-content');

    // FIX UI ISSUE 1 — update nav active state
    document.querySelectorAll('#screen-principal .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === 'monitor');
    });

    const schools  = APP.getLocal('schools');
    const school   = schools.find(function(s) { return s.school_id === sid; });
    const schoolNm = school ? school.name    : '';
    const schoolAd = school ? (school.address || '') : '';

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Settings</h2>
          <button class="btn-secondary-sm" onclick="PRINCIPAL.loadTab('monitor')">← Back</button>
        </div>

        <div class="form-card">
          <h3>School Information</h3>
          <input id="set-school-name" class="input" type="text"
            placeholder="School name *" value="${schoolNm.replace(/"/g,'&quot;')}" />
          <input id="set-school-addr" class="input" type="text"
            placeholder="Address" value="${schoolAd.replace(/"/g,'&quot;')}" />
          <div id="set-school-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-primary" onclick="PRINCIPAL.saveSchoolInfo()">💾 Save School Info</button>
          </div>
        </div>

        <div class="form-card">
          <h3>Change Principal Password</h3>
          <input id="set-old-pass" class="input" type="password" placeholder="Current password *" />
          <input id="set-new-pass" class="input" type="password" placeholder="New password (min 4 chars) *" />
          <input id="set-cfm-pass" class="input" type="password" placeholder="Confirm new password *" />
          <div id="set-pass-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-primary" onclick="PRINCIPAL.changePassword()">🔒 Change Password</button>
          </div>
        </div>

        <div class="info-block">
          <div class="info-row">
            <span>School ID</span>
            <strong style="font-size:11px;word-break:break-all;">${sid}</strong>
          </div>
          <div class="info-row"><span>Principal</span><strong>${APP.session.name}</strong></div>
          <div class="info-row"><span>Username</span><strong>@${APP.session.username}</strong></div>
          <div class="info-row"><span>App Version</span><strong>EduTrack v2.1</strong></div>
        </div>

        <div class="form-card" style="border-color:rgba(239,68,68,0.3);">
          <h3 style="color:var(--danger);">Danger Zone</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:12px;">
            Clear all local data from this device. Synced data in Supabase is safe.
          </p>
          <button class="btn-danger full-width" style="margin-top:0;"
            onclick="PRINCIPAL.clearLocalData()">🗑 Clear All Local Data</button>
        </div>
      </div>
    `;
  },

  async saveSchoolInfo() {
    const name  = document.getElementById('set-school-name').value.trim();
    const addr  = document.getElementById('set-school-addr').value.trim();
    const errEl = document.getElementById('set-school-error');
    errEl.textContent = '';
    if (!name) { errEl.textContent = 'School name is required.'; return; }

    const sid     = APP.session.school_id;
    const schools = APP.getLocal('schools');
    const idx     = schools.findIndex(function(s) { return s.school_id === sid; });
    const record  = idx >= 0 ? schools[idx] : { school_id: sid, created_at: new Date().toISOString() };
    record.name       = name;
    record.address    = addr || null;
    record.updated_at = new Date().toISOString();

    if (idx >= 0) { schools[idx] = record; } else { schools.push(record); }
    APP.setLocal('schools', schools);

    if (SYNC.isOnline) {
      await DB.request('PATCH', 'schools', { name: name, address: addr || null },
        '?school_id=eq.' + sid);
    } else {
      await SYNC.addToQueue('schools', 'insert', record, sid);
    }
    APP.showToast('School info saved.', 'ok');
  },

  async changePassword() {
    const oldPass = document.getElementById('set-old-pass').value;
    const newPass = document.getElementById('set-new-pass').value;
    const cfmPass = document.getElementById('set-cfm-pass').value;
    const errEl   = document.getElementById('set-pass-error');
    errEl.textContent = '';

    if (!oldPass || !newPass || !cfmPass) { errEl.textContent = 'All password fields are required.'; return; }
    if (newPass.length < 4) { errEl.textContent = 'New password must be at least 4 characters.'; return; }
    if (newPass !== cfmPass) { errEl.textContent = 'New passwords do not match.'; return; }

    const user = APP.getLocalUsers().find(function(u) { return u.user_id === APP.session.user_id; });
    if (!user) { errEl.textContent = 'User not found.'; return; }
    if (user.password !== oldPass) { errEl.textContent = 'Current password is incorrect.'; return; }

    user.password   = newPass;
    user.updated_at = new Date().toISOString();
    APP.cacheUser(user);
    await APP.writeRecord('users', user, 'user_id');
    APP.showToast('Password changed.', 'ok');
    ['set-old-pass','set-new-pass','set-cfm-pass'].forEach(function(id) {
      document.getElementById(id).value = '';
    });
  },

  clearLocalData() {
    APP.showModal('Clear Local Data',
      'This will remove ALL data from this device. Synced data in Supabase is safe. Continue?',
      function() {
        const keys = Object.keys(localStorage).filter(function(k) {
          return k.startsWith(CONFIG.LS_PREFIX);
        });
        keys.forEach(function(k) { localStorage.removeItem(k); });
        APP.showToast('Local data cleared.', 'ok');
        setTimeout(function() { APP.logout(); }, 1500);
      }, 'Clear Everything');
  },

  // ─── IMPORT DATA ────────────────────────────────────────────────────
  showImport() {
    const content = document.getElementById('principal-content');
    const classes = APP.getLocalBySchool('classes', APP.session.school_id);

    // FIX UI ISSUE 1 — update nav active state
    document.querySelectorAll('#screen-principal .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === 'monitor');
    });

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Import Data</h2>
          <button class="btn-secondary-sm" onclick="PRINCIPAL.loadTab('monitor')">← Back</button>
        </div>

        <div class="form-card">
          <h3>Import from JSON Backup</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:12px;">
            Upload a previously exported EduTrack JSON file to restore data.
          </p>
          <input id="import-json-file" class="input" type="file" accept=".json" style="padding:8px;" />
          <div id="import-json-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-primary" onclick="PRINCIPAL.importJSON()">📥 Import JSON</button>
          </div>
        </div>

        <div class="form-card">
          <h3>Bulk Import Students via CSV</h3>
          <p style="font-size:13px;color:var(--text2);margin-bottom:8px;">
            CSV format: <code style="background:var(--bg3);padding:2px 6px;border-radius:4px;">
            name, roll_no, dob (YYYY-MM-DD), parent_phone</code>
          </p>
          <select id="import-class" class="input">
            <option value="">-- Select Class for Import *--</option>
            ${classes.map(function(c) {
              return `<option value="${c.class_id}">${c.name}</option>`;
            }).join('')}
          </select>
          <input id="import-csv-file" class="input" type="file" accept=".csv" style="padding:8px;" />
          <div id="import-csv-error" class="error-msg"></div>
          <div class="form-actions">
            <button class="btn-primary" onclick="PRINCIPAL.importCSV()">📥 Import CSV</button>
          </div>
          <div id="import-csv-preview"></div>
        </div>

        <div class="form-card">
          <h3>Download CSV Template</h3>
          <button class="btn-secondary full-width" style="margin-top:0;"
            onclick="PRINCIPAL.downloadCSVTemplate()">⬇️ Download Template</button>
        </div>
      </div>
    `;
  },

  async importJSON() {
    const fileInput = document.getElementById('import-json-file');
    const errEl     = document.getElementById('import-json-error');
    errEl.textContent = '';
    if (!fileInput.files || fileInput.files.length === 0) {
      errEl.textContent = 'Select a JSON file first.'; return;
    }
    const file   = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result);
        let imported = 0;
        if (data.students && Array.isArray(data.students)) {
          for (const s of data.students) {
            if (!s.student_id || !s.name) continue;
            s.school_id = APP.session.school_id;
            await APP.writeRecord('students', s, 'student_id');
            imported++;
          }
        }
        if (data.attendance && Array.isArray(data.attendance)) {
          for (const a of data.attendance) {
            if (!a.attendance_id) continue;
            a.school_id = APP.session.school_id;
            await APP.writeRecord('attendance', a, 'attendance_id');
          }
        }
        if (data.marks && Array.isArray(data.marks)) {
          for (const m of data.marks) {
            if (!m.mark_id) continue;
            m.school_id = APP.session.school_id;
            await APP.writeRecord('marks', m, 'mark_id');
          }
        }
        APP.showToast(imported + ' students imported from JSON.', 'ok');
        errEl.textContent = '';
      } catch (err) {
        errEl.textContent = 'Invalid JSON file. Please check the format.';
      }
    };
    reader.readAsText(file);
  },

  async importCSV() {
    const classId   = document.getElementById('import-class').value;
    const fileInput = document.getElementById('import-csv-file');
    const errEl     = document.getElementById('import-csv-error');
    const preview   = document.getElementById('import-csv-preview');
    errEl.textContent = '';
    preview.innerHTML = '';

    if (!classId) { errEl.textContent = 'Select a class first.'; return; }
    if (!fileInput.files || fileInput.files.length === 0) {
      errEl.textContent = 'Select a CSV file first.'; return;
    }

    const file   = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const lines    = e.target.result.split('\n').map(function(l) { return l.trim(); });
        const sid      = APP.session.school_id;
        const existing = APP.getLocalBySchool('students', sid);
        const results  = [];
        let imported   = 0;
        let skipped    = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line || line.startsWith('#')) continue;
          const parts = line.split(',').map(function(p) { return p.trim(); });
          const name  = parts[0];
          const roll  = parts[1];
          const dob   = parts[2] || null;
          const phone = parts[3] || null;

          if (!name || !roll) {
            results.push({ status: 'skip', name: name || '(empty)', reason: 'Missing name or roll no' });
            skipped++; continue;
          }

          const dupName = existing.find(function(s) {
            return s.class_id === classId && s.name.toLowerCase() === name.toLowerCase();
          });
          const dupRoll = existing.find(function(s) {
            return s.class_id === classId && s.roll_no === roll;
          });
          if (dupName || dupRoll) {
            results.push({ status: 'skip', name: name, reason: dupName ? 'Name duplicate' : 'Roll duplicate' });
            skipped++; continue;
          }

          const record = {
            student_id:   APP.uuid(),
            school_id:    sid,
            class_id:     classId,
            name:         name,
            roll_no:      roll,
            dob:          dob,
            parent_phone: phone,
            created_at:   new Date().toISOString()
          };
          await APP.writeRecord('students', record, 'student_id');
          existing.push(record);
          results.push({ status: 'ok', name: name, reason: 'Imported' });
          imported++;
        }

        preview.innerHTML = `
          <div class="section-block" style="margin-top:12px;">
            <h3 class="section-subtitle">Result: ${imported} imported, ${skipped} skipped</h3>
            <div class="table-wrap">
              <table class="data-table small-table">
                <thead><tr><th>Name</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>
                  ${results.map(function(r) {
                    return `<tr>
                      <td>${r.name}</td>
                      <td class="${r.status === 'ok' ? 'text-ok' : 'text-warn'}">
                        ${r.status === 'ok' ? '✅ OK' : '⚠️ Skipped'}
                      </td>
                      <td>${r.reason}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
        APP.showToast(imported + ' students imported.', 'ok');
      } catch(err) {
        APP.showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  downloadCSVTemplate() {
    const csv  = '# EduTrack Student Import Template\n' +
                 '# Format: name, roll_no, dob (YYYY-MM-DD), parent_phone\n' +
                 'Ravi Kumar, 1, 2010-06-15, 9876543210\n' +
                 'Priya Sharma, 2, 2011-03-22, 9123456789\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'edutrack-student-template.csv'; a.click();
    URL.revokeObjectURL(url);
    APP.showToast('Template downloaded.', 'ok');
  },

  // ─── SYNC MONITOR ───────────────────────────────────────────────────
  async renderMonitor() {
    const content = document.getElementById('principal-content');
    const stats   = await SYNC.getStats();
    const kb      = await SYNC.getPendingSizeKB();
    const last    = SYNC.lastSyncTime
      ? new Date(SYNC.lastSyncTime).toLocaleString() : 'Never';

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Monitor &amp; Settings</h2>
        </div>
        <div class="more-grid" style="margin-bottom:16px;">
          <button class="more-card" onclick="PRINCIPAL.showSettings()">
            <span>⚙️</span><strong>Settings</strong><small>School &amp; account</small>
          </button>
          <button class="more-card" onclick="PRINCIPAL.showImport()">
            <span>📥</span><strong>Import</strong><small>Bulk upload</small>
          </button>
          <button class="more-card" onclick="PRINCIPAL.exportData()">
            <span>📤</span><strong>Export</strong><small>JSON backup</small>
          </button>
          <button class="more-card" onclick="PRINCIPAL.showMarksOverview()">
            <span>📊</span><strong>Marks</strong><small>Overview</small>
          </button>
        </div>
        <div class="section-header">
          <h3 class="section-subtitle">Sync Status</h3>
          <button class="btn-primary-sm" onclick="PRINCIPAL.manualSync()">🔄 Sync Now</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card ${stats.pending > 0 ? 'stat-warn' : ''}">
            <div class="stat-number">${stats.pending}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="stat-card stat-ok">
            <div class="stat-number">${stats.synced}</div>
            <div class="stat-label">Synced</div>
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
          <div class="info-row"><span>Auto Sync</span><strong>Every 30 seconds</strong></div>
        </div>
        ${stats.failed > 0
          ? `<div class="warn-block">
              ⚠️ ${stats.failed} record(s) failed to sync.
              <button class="btn-secondary-sm" onclick="PRINCIPAL.retryFailed()">Retry Failed</button>
            </div>`
          : ''
        }
      </div>
    `;
  },

  async manualSync() {
    if (!SYNC.isOnline) { APP.showToast('Offline — cannot sync.', 'warning'); return; }
    APP.showToast('Syncing...');
    await SYNC.runSync();
    APP.showToast('Sync complete.', 'ok');
    await PRINCIPAL.renderMonitor();
  },

  async retryFailed() {
    return new Promise(function(resolve) {
      if (!SYNC.db) { resolve(); return; }
      const tx    = SYNC.db.transaction(CONFIG.IDB_STORE, 'readwrite');
      const store = tx.objectStore(CONFIG.IDB_STORE);
      const req   = store.openCursor();
      req.onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.status === 'failed') {
            const item   = cursor.value;
            item.status  = 'pending';
            item.retries = 0;
            cursor.update(item);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror  = function() { console.error('[PRINCIPAL] retryFailed IDB error'); resolve(); };
      tx.onerror   = function() { console.error('[PRINCIPAL] retryFailed tx error');  resolve(); };
    }).then(async function() {
      await PRINCIPAL.manualSync();
    });
  }
};