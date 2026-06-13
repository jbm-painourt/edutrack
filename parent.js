// ─── PARENT MODULE v2.1 ──────────────────────────────────────────────────────
const PARENT = {
  studentData: null,  // { student, attendance, marks, exams, subjects, class }
  activeTab:   'overview',

  // ─── INIT ───────────────────────────────────────────────────────────
  async init() {
    APP.showScreen('screen-parent');
    PARENT.renderShell();
    await PARENT.loadData();
  },

  // ─── SHELL ──────────────────────────────────────────────────────────
  renderShell() {
    const screen = document.getElementById('screen-parent');
    screen.innerHTML = `
      <div class="app-header">
        <div class="app-logo-sm">ET</div>
        <span class="app-title">Edu<span>Track</span></span>
        <span class="role-badge parent">Parent</span>
        <button class="btn-icon" onclick="APP.logout()">Out</button>
      </div>
      <div id="sync-banner" class="sync-banner"></div>
      <div id="parent-content" class="tab-content">
        <div class="loading">Loading your child's data...</div>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn active" data-tab="overview"
          onclick="PARENT.showTab('overview')">
          <span>🏠</span><small>Overview</small>
        </button>
        <button class="nav-btn" data-tab="attendance"
          onclick="PARENT.showTab('attendance')">
          <span>📋</span><small>Attendance</small>
        </button>
        <button class="nav-btn" data-tab="marks"
          onclick="PARENT.showTab('marks')">
          <span>📝</span><small>Marks</small>
        </button>
        <button class="nav-btn" data-tab="report"
          onclick="PARENT.showTab('report')">
          <span>📄</span><small>Report</small>
        </button>
      </nav>
    `;
  },

  // ─── LOAD DATA FROM SUPABASE ─────────────────────────────────────────
  async loadData() {
    const content    = document.getElementById('parent-content');
    const sid        = APP.session.school_id;
    const student_id = APP.session.student_id;

    if (!student_id) {
      content.innerHTML = '<p class="error-msg" style="padding:24px;">Session error. Please log in again.</p>';
      return;
    }

    const online = await DB.ping();
    if (!online) {
      content.innerHTML = `
        <div class="offline-msg">
          <h3>📡 You are offline</h3>
          <p>Parent view requires internet to load your child's data. Please connect and retry.</p>
          <button class="btn-primary" onclick="PARENT.loadData()">↺ Retry</button>
        </div>
      `;
      return;
    }

    content.innerHTML = '<div class="loading">Fetching data...</div>';

    try {
      const [studRes, attRes, marksRes, examsRes, subjectsRes, classRes] = await Promise.all([
        DB.request('GET', 'students',   null, '?student_id=eq.' + student_id),
        DB.request('GET', 'attendance', null, '?student_id=eq.' + student_id + '&order=date.desc'),
        DB.request('GET', 'marks',      null, '?student_id=eq.' + student_id),
        DB.request('GET', 'exams',      null, '?school_id=eq.'  + sid),
        DB.request('GET', 'subjects',   null, '?school_id=eq.'  + sid),
        DB.request('GET', 'classes',    null, '?school_id=eq.'  + sid)
      ]);

      if (studRes.error || !studRes.data || studRes.data.length === 0) {
        content.innerHTML = '<p class="error-msg" style="padding:24px;">Student record not found. Please contact school.</p>';
        return;
      }

      const student    = studRes.data[0];
      const allClasses = classRes.data || [];
      const cls        = allClasses.find(function(c) { return c.class_id === student.class_id; });

      // fetch school name for display
      let schoolName = '';
      try {
        const schoolRes = await DB.request('GET', 'schools', null, '?school_id=eq.' + sid);
        if (!schoolRes.error && schoolRes.data && schoolRes.data.length > 0) {
          schoolName = schoolRes.data[0].name || '';
        }
      } catch(e) { /* non-critical, skip */ }

      PARENT.studentData = {
        student:    student,
        cls:        cls || null,
        schoolName: schoolName,
        attendance: attRes.data      || [],
        marks:      marksRes.data    || [],
        exams:      examsRes.data    || [],
        subjects:   subjectsRes.data || []
      };

      PARENT.showTab('overview');
    } catch (e) {
      content.innerHTML = `
        <div class="offline-msg">
          <h3>⚠️ Load Failed</h3>
          <p>Could not load data. Please check your connection and retry.</p>
          <button class="btn-primary" onclick="PARENT.loadData()">↺ Retry</button>
        </div>
      `;
      console.error('Parent loadData error:', e);
    }
  },

  // ─── TAB SWITCHER ────────────────────────────────────────────────────
  showTab(tab) {
    PARENT.activeTab = tab;
    document.querySelectorAll('#screen-parent .nav-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const content = document.getElementById('parent-content');

    // if data not loaded yet show message instead of blank screen
    if (!PARENT.studentData) {
      content.innerHTML = `
        <div class="offline-msg">
          <h3>⏳ Data not loaded yet</h3>
          <p>Still fetching your child's data. Please wait or retry.</p>
          <button class="btn-primary" onclick="PARENT.loadData()">↺ Retry</button>
        </div>`;
      return;
    }

    content.innerHTML = '<div class="loading">Loading...</div>';
    setTimeout(function() {
      if      (tab === 'overview')   PARENT.renderOverview();
      else if (tab === 'attendance') PARENT.renderAttendance();
      else if (tab === 'marks')      PARENT.renderMarks();
      else if (tab === 'report')     PARENT.renderReport();
    }, 60);
  },

  // ─── GRADE HELPER ────────────────────────────────────────────────────
  calcGrade(obtained, max) {
    const pct = max > 0 ? (obtained / max) * 100 : 0;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 35) return 'D';
    return 'F';
  },

  // ─── SHARED MARKS SUMMARY BUILDER ────────────────────────────────────
  _buildMarksSummary() {
    const d        = PARENT.studentData;
    const marks    = d.marks;
    const totalObt = marks.reduce(function(sum, m) { return sum + m.marks_obtained; }, 0);
    const totalMax = marks.reduce(function(sum, m) { return sum + m.max_marks; }, 0);
    const overallPct   = totalMax > 0 ? Math.round((totalObt / totalMax) * 100) : 0;
    const overallGrade = PARENT.calcGrade(totalObt, totalMax);
    const grouped      = {};
    marks.forEach(function(m) {
      if (!grouped[m.exam_id]) grouped[m.exam_id] = [];
      grouped[m.exam_id].push(m);
    });
    return { totalObt, totalMax, overallPct, overallGrade, grouped };
  },

  // ─── OVERVIEW ────────────────────────────────────────────────────────
  renderOverview() {
    if (!PARENT.studentData) return;
    const content = document.getElementById('parent-content');
    const d       = PARENT.studentData;
    const s       = d.student;
    const att     = d.attendance;

    const present  = att.filter(function(a) { return a.status === 'present'; }).length;
    const absent   = att.filter(function(a) { return a.status === 'absent';  }).length;
    const late     = att.filter(function(a) { return a.status === 'late';    }).length;
    const attPct   = att.length > 0 ? Math.round((present / att.length) * 100) : null;
    const isAtRisk = attPct !== null && attPct < 75;

    // overall marks — use shared helper
    const ms         = PARENT._buildMarksSummary();
    const overallPct   = ms.totalMax > 0 ? ms.overallPct : null;
    const overallGrade = ms.totalMax > 0 ? ms.overallGrade : '—';

    // today attendance
    const today    = APP.today();
    const todayAtt = att.find(function(a) { return a.date === today; });

    // last 7 days
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const dayObj = new Date();
      dayObj.setDate(dayObj.getDate() - i);
      last7.push(dayObj.toISOString().split('T')[0]);
    }
    const last7Att = last7.map(function(date) {
      return att.find(function(a) { return a.date === date; }) || { date: date, status: null };
    });

    content.innerHTML = `
      <div class="section-block">

        <!-- Student profile -->
        <div class="student-profile">
          <div class="student-avatar">${s.name.charAt(0).toUpperCase()}</div>
          <div class="student-info">
            <h2>${s.name}</h2>
            <small>Roll: ${s.roll_no || '—'} &bull; ${d.cls ? d.cls.name : 'No class'}</small>
            <small>DOB: ${s.dob || '—'}</small>
            ${d.schoolName ? `<small style="color:var(--primary-lt);">🏫 ${d.schoolName}</small>` : ''}
          </div>
        </div>

        <!-- At-risk alert -->
        ${isAtRisk
          ? `<div class="alert-block">
              ⚠️ Attendance below 75% — Please contact the school immediately.
            </div>`
          : ''
        }

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card ${isAtRisk ? 'stat-danger' : 'stat-ok'}">
            <div class="stat-number">${attPct !== null ? attPct + '%' : 'N/A'}</div>
            <div class="stat-label">Attendance</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${present}</div>
            <div class="stat-label">Present</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-number">${absent}</div>
            <div class="stat-label">Absent</div>
          </div>
          <div class="stat-card stat-warn">
            <div class="stat-number">${late}</div>
            <div class="stat-label">Late</div>
          </div>
        </div>

        <!-- Overall marks -->
        <div class="form-card" style="text-align:center;padding:16px;">
          <div class="stat-number" style="font-size:32px;">
            ${overallPct !== null ? overallPct + '%' : 'N/A'}
          </div>
          <div class="stat-label">Overall Marks Performance</div>
          ${overallPct !== null
            ? `<div style="margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <span class="pct-badge ${overallPct >= 60 ? 'pct-ok' : overallPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                  ${ms.totalObt}/${ms.totalMax} marks
                </span>
                <span class="pct-badge ${overallPct >= 60 ? 'pct-ok' : overallPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                  Grade: ${overallGrade}
                </span>
              </div>`
            : '<p style="color:var(--text2);font-size:12px;margin-top:6px;">No marks recorded yet</p>'
          }
        </div>

        <!-- Today's status -->
        <div class="section-block">
          <h3 class="section-subtitle">Today's Status</h3>
          <div class="today-status ${todayAtt ? 'status-' + todayAtt.status : 'status-unknown'}">
            ${todayAtt
              ? (todayAtt.status === 'present' ? '✅ Present'
                : todayAtt.status === 'absent'  ? '❌ Absent'
                : '⏰ Late')
              : '— Not marked yet'
            }
          </div>
        </div>

        <!-- Last 7 days -->
        <div class="section-block">
          <h3 class="section-subtitle">Last 7 Days</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${last7Att.map(function(a) {
              const label = a.date.slice(5); // MM-DD
              const color = !a.status        ? 'var(--bg3)'
                          : a.status === 'present' ? 'var(--success)'
                          : a.status === 'absent'  ? 'var(--danger)'
                          : 'var(--warn)';
              const icon  = !a.status        ? '—'
                          : a.status === 'present' ? 'P'
                          : a.status === 'absent'  ? 'A'
                          : 'L';
              return `<div style="flex:1;min-width:36px;text-align:center;padding:8px 4px;
                background:${color}22;border:1px solid ${color};border-radius:8px;">
                <div style="font-weight:800;font-size:14px;color:${color};">${icon}</div>
                <div style="font-size:10px;color:var(--text2);margin-top:2px;">${label}</div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Refresh -->
        <button class="btn-secondary full-width" onclick="PARENT.loadData()">
          🔄 Refresh Data
        </button>
      </div>
    `;
  },

  // ─── ATTENDANCE ──────────────────────────────────────────────────────
  renderAttendance() {
    if (!PARENT.studentData) return;
    const content = document.getElementById('parent-content');
    const att     = PARENT.studentData.attendance;

    if (att.length === 0) {
      content.innerHTML = `
        <div class="tab-section">
          <h2 class="section-title">Attendance</h2>
          <p class="empty-msg">No attendance records yet.</p>
        </div>`;
      return;
    }

    const present = att.filter(function(a) { return a.status === 'present'; }).length;
    const absent  = att.filter(function(a) { return a.status === 'absent';  }).length;
    const late    = att.filter(function(a) { return a.status === 'late';    }).length;
    const pct     = Math.round((present / att.length) * 100);

    // group by month for monthly view
    const byMonth = {};
    att.forEach(function(a) {
      const month = a.date.slice(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(a);
    });
    const monthKeys = Object.keys(byMonth).sort().reverse();

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Attendance</h2>
        </div>

        <!-- Summary stats -->
        <div class="stats-grid">
          <div class="stat-card ${pct < 75 ? 'stat-danger' : 'stat-ok'}">
            <div class="stat-number">${pct}%</div>
            <div class="stat-label">Overall</div>
          </div>
          <div class="stat-card stat-ok">
            <div class="stat-number">${present}</div>
            <div class="stat-label">Present</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-number">${absent}</div>
            <div class="stat-label">Absent</div>
          </div>
          <div class="stat-card stat-warn">
            <div class="stat-number">${late}</div>
            <div class="stat-label">Late</div>
          </div>
        </div>

        ${pct < 75
          ? `<div class="alert-block">
              ⚠️ Attendance is below 75% (${pct}%). Minimum required is 75%.
              Please contact the school.
            </div>`
          : ''
        }

        <!-- Monthly breakdown -->
        ${monthKeys.map(function(month) {
          const records = byMonth[month];
          const mPresent = records.filter(function(a) { return a.status === 'present'; }).length;
          const mAbsent  = records.filter(function(a) { return a.status === 'absent';  }).length;
          const mLate    = records.filter(function(a) { return a.status === 'late';    }).length;
          const mPct     = Math.round((mPresent / records.length) * 100);
          const monthLabel = (function() {
            const parts = month.split('-');
            const dt    = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, 1));
            return dt.toLocaleString('default', { month: 'long', year: 'numeric' });
          })();
          return `<div class="form-card">
            <div class="section-header">
              <h3 style="font-size:14px;font-weight:700;">${monthLabel}</h3>
              <span class="pct-badge ${mPct >= 75 ? 'pct-ok' : 'pct-danger'}">${mPct}%</span>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:10px;font-size:12px;color:var(--text2);">
              <span class="text-ok">P: ${mPresent}</span>
              <span class="text-warn" style="color:var(--danger);">A: ${mAbsent}</span>
              <span class="text-warn">L: ${mLate}</span>
              <span>Total: ${records.length}</span>
            </div>
            <div class="table-wrap">
              <table class="data-table small-table">
                <thead><tr><th>Date</th><th>Status</th></tr></thead>
                <tbody>
                  ${records.map(function(a) {
                    const cls = a.status === 'present' ? 'att-p'
                              : a.status === 'absent'  ? 'att-a'
                              : 'att-l';
                    const icon = a.status === 'present' ? '✅'
                               : a.status === 'absent'  ? '❌'
                               : '⏰';
                    return `<tr>
                      <td>${a.date}</td>
                      <td class="${cls}">${icon} ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</td>
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

  // ─── MARKS ───────────────────────────────────────────────────────────
  renderMarks() {
    if (!PARENT.studentData) return;
    const content  = document.getElementById('parent-content');
    const marks    = PARENT.studentData.marks;
    const exams    = PARENT.studentData.exams;
    const subjects = PARENT.studentData.subjects;

    if (marks.length === 0) {
      content.innerHTML = `
        <div class="tab-section">
          <h2 class="section-title">Marks</h2>
          <p class="empty-msg">No marks recorded yet.</p>
        </div>`;
      return;
    }

    // use shared helper
    const ms         = PARENT._buildMarksSummary();
    const totalObt   = ms.totalObt;
    const totalMax   = ms.totalMax;
    const overallPct = ms.overallPct;
    const overallG   = ms.overallGrade;
    const grouped    = ms.grouped;

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Marks</h2>
        </div>

        <!-- Overall summary card -->
        <div class="stats-grid" style="margin-bottom:20px;">
          <div class="stat-card ${overallPct >= 60 ? 'stat-ok' : overallPct >= 35 ? 'stat-warn' : 'stat-danger'}">
            <div class="stat-number">${overallPct}%</div>
            <div class="stat-label">Overall %</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${overallG}</div>
            <div class="stat-label">Overall Grade</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${totalObt}</div>
            <div class="stat-label">Total Obtained</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${totalMax}</div>
            <div class="stat-label">Total Max</div>
          </div>
        </div>

        <!-- Per exam breakdown -->
        ${Object.keys(grouped).map(function(exam_id) {
          const exam      = exams.find(function(e) { return e.exam_id === exam_id; });
          const examName  = exam ? exam.name : 'Unknown Exam';
          const examMarks = grouped[exam_id];
          const examObt   = examMarks.reduce(function(sum, m) { return sum + m.marks_obtained; }, 0);
          const examMax   = examMarks.reduce(function(sum, m) { return sum + m.max_marks; }, 0);
          const examPct   = examMax > 0 ? Math.round((examObt / examMax) * 100) : 0;
          const examGrade = PARENT.calcGrade(examObt, examMax);

          return `<div class="form-card">
            <div class="section-header">
              <h3 style="font-size:14px;font-weight:700;">${examName}</h3>
              <div style="display:flex;gap:6px;align-items:center;">
                <span class="pct-badge ${examPct >= 60 ? 'pct-ok' : examPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                  ${examPct}%
                </span>
                <span class="pct-badge ${examPct >= 60 ? 'pct-ok' : examPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                  ${examGrade}
                </span>
              </div>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th></tr>
                </thead>
                <tbody>
                  ${examMarks.map(function(m) {
                    const sub    = subjects.find(function(s) { return s.subject_id === m.subject_id; });
                    const subPct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
                    const subG   = m.grade || PARENT.calcGrade(m.marks_obtained, m.max_marks);
                    const cls    = subPct >= 60 ? 'att-p' : subPct >= 35 ? '' : 'att-a';
                    return `<tr>
                      <td>${sub ? sub.name : '—'}</td>
                      <td>${m.marks_obtained}</td>
                      <td>${m.max_marks}</td>
                      <td class="${cls}">${subPct}%</td>
                      <td><strong>${subG}</strong></td>
                    </tr>`;
                  }).join('')}
                  <tr class="total-row">
                    <td><strong>Total</strong></td>
                    <td><strong>${examObt}</strong></td>
                    <td><strong>${examMax}</strong></td>
                    <td><strong>${examPct}%</strong></td>
                    <td><strong>${examGrade}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  },

  // ─── REPORT CARD ─────────────────────────────────────────────────────
  renderReport() {
    if (!PARENT.studentData) return;
    const content = document.getElementById('parent-content');
    const d       = PARENT.studentData;
    const s       = d.student;

    const att      = d.attendance;
    const present  = att.filter(function(a) { return a.status === 'present'; }).length;
    const attPct   = att.length > 0 ? Math.round((present / att.length) * 100) : 0;

    // use shared helper
    const ms           = PARENT._buildMarksSummary();
    const totalObt     = ms.totalObt;
    const totalMax     = ms.totalMax;
    const overallPct   = ms.overallPct;
    const overallGrade = ms.overallGrade;
    const grouped      = ms.grouped;

    content.innerHTML = `
      <div class="tab-section">
        <div class="section-header">
          <h2 class="section-title">Report Card</h2>
          <button class="btn-primary-sm" onclick="PARENT.printReport()">🖨 Print</button>
        </div>

        <!-- Preview card -->
        <div id="report-preview">
          <!-- Header -->
          <div class="form-card" style="text-align:center;padding:20px;">
            <div style="font-size:20px;font-weight:900;color:var(--primary-lt);margin-bottom:4px;">
              EduTrack
            </div>
            <div style="font-size:14px;color:var(--text2);margin-bottom:2px;">Student Report Card</div>
            <div style="font-size:12px;color:var(--text3);">
              ${d.cls ? d.cls.name : ''} &bull; Generated ${APP.today()}
            </div>
          </div>

          <!-- Student info -->
          <div class="info-block">
            <div class="info-row">
              <span>Student Name</span><strong>${s.name}</strong>
            </div>
            <div class="info-row">
              <span>Roll No</span><strong>${s.roll_no || '—'}</strong>
            </div>
            <div class="info-row">
              <span>Class</span><strong>${d.cls ? d.cls.name : '—'}</strong>
            </div>
            <div class="info-row">
              <span>Date of Birth</span><strong>${s.dob || '—'}</strong>
            </div>
          </div>

          <!-- Attendance summary -->
          <div class="form-card">
            <h3>Attendance Summary</h3>
            <div class="stats-grid">
              <div class="stat-card ${attPct >= 75 ? 'stat-ok' : 'stat-danger'}">
                <div class="stat-number">${attPct}%</div>
                <div class="stat-label">Attendance %</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${present}/${att.length}</div>
                <div class="stat-label">Days Present</div>
              </div>
            </div>
            ${attPct < 75
              ? `<div class="alert-block" style="margin-top:10px;margin-bottom:0;">
                  ⚠️ Below 75% attendance — Shortage
                </div>`
              : ''
            }
          </div>

          <!-- Marks per exam -->
          ${Object.keys(grouped).length === 0
            ? `<div class="form-card">
                <h3>Marks</h3>
                <p class="empty-msg">No marks recorded yet.</p>
              </div>`
            : Object.keys(grouped).map(function(exam_id) {
                const exam      = d.exams.find(function(e) { return e.exam_id === exam_id; });
                const examMarks = grouped[exam_id];
                const examObt   = examMarks.reduce(function(sum, m) { return sum + m.marks_obtained; }, 0);
                const examMax   = examMarks.reduce(function(sum, m) { return sum + m.max_marks; }, 0);
                const examPct   = examMax > 0 ? Math.round((examObt / examMax) * 100) : 0;
                const examGrade = PARENT.calcGrade(examObt, examMax);

                return `<div class="form-card">
                  <div class="section-header">
                    <h3>${exam ? exam.name : 'Exam'}</h3>
                    <span class="pct-badge ${examPct >= 60 ? 'pct-ok' : examPct >= 35 ? 'pct-warn' : 'pct-danger'}">
                      ${examGrade} — ${examPct}%
                    </span>
                  </div>
                  <div class="table-wrap">
                    <table class="data-table small-table">
                      <thead>
                        <tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th></tr>
                      </thead>
                      <tbody>
                        ${examMarks.map(function(m) {
                          const sub  = d.subjects.find(function(s) { return s.subject_id === m.subject_id; });
                          const sPct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
                          const sG   = m.grade || PARENT.calcGrade(m.marks_obtained, m.max_marks);
                          return `<tr>
                            <td>${sub ? sub.name : '—'}</td>
                            <td>${m.marks_obtained}</td>
                            <td>${m.max_marks}</td>
                            <td>${sPct}%</td>
                            <td><strong>${sG}</strong></td>
                          </tr>`;
                        }).join('')}
                        <tr class="total-row">
                          <td><strong>Total</strong></td>
                          <td><strong>${examObt}</strong></td>
                          <td><strong>${examMax}</strong></td>
                          <td><strong>${examPct}%</strong></td>
                          <td><strong>${examGrade}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>`;
              }).join('')
          }

          <!-- Overall summary -->
          ${totalMax > 0
            ? `<div class="form-card" style="text-align:center;padding:18px;">
                <div class="stat-number" style="font-size:36px;">${overallPct}%</div>
                <div class="stat-label">Overall Performance</div>
                <div style="margin-top:10px;">
                  <span class="pct-badge ${overallPct >= 60 ? 'pct-ok' : overallPct >= 35 ? 'pct-warn' : 'pct-danger'}"
                    style="font-size:16px;padding:6px 18px;">
                    Grade: ${overallGrade}
                  </span>
                </div>
                <div style="font-size:12px;color:var(--text2);margin-top:8px;">
                  ${totalObt} out of ${totalMax} marks
                </div>
              </div>`
            : ''
          }
        </div>

        <!-- Print button bottom -->
        <button class="btn-primary full-width" style="margin-top:8px;"
          onclick="PARENT.printReport()">
          🖨 Print Report Card
        </button>
        <button class="btn-secondary full-width" style="margin-top:8px;"
          onclick="PARENT.whatsAppReport()">
          📱 Share via WhatsApp
        </button>
      </div>
    `;
  },

  // ─── PRINT REPORT ────────────────────────────────────────────────────
  printReport() {
    if (!PARENT.studentData) { APP.showToast('No data to print.', 'warning'); return; }
    const d       = PARENT.studentData;
    const s       = d.student;
    const att     = d.attendance;
    const present = att.filter(function(a) { return a.status === 'present'; }).length;
    const attPct  = att.length > 0 ? Math.round((present / att.length) * 100) : 0;

    // use shared helper
    const ms           = PARENT._buildMarksSummary();
    const totalObt     = ms.totalObt;
    const totalMax     = ms.totalMax;
    const overallPct   = ms.overallPct;
    const overallGrade = ms.overallGrade;
    const grouped      = ms.grouped;

    const examHTML = Object.keys(grouped).map(function(exam_id) {
      const exam      = d.exams.find(function(e) { return e.exam_id === exam_id; });
      const examMarks = grouped[exam_id];
      const examObt   = examMarks.reduce(function(sum, m) { return sum + m.marks_obtained; }, 0);
      const examMax   = examMarks.reduce(function(sum, m) { return sum + m.max_marks; }, 0);
      const examPct   = examMax > 0 ? Math.round((examObt / examMax) * 100) : 0;
      const examGrade = PARENT.calcGrade(examObt, examMax);
      const rows      = examMarks.map(function(m) {
        const sub  = d.subjects.find(function(subj) { return subj.subject_id === m.subject_id; });
        const sPct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
        const sG   = m.grade || PARENT.calcGrade(m.marks_obtained, m.max_marks);
        return `<tr>
          <td>${sub ? sub.name : '—'}</td>
          <td>${m.marks_obtained}</td>
          <td>${m.max_marks}</td>
          <td>${sPct}%</td>
          <td>${sG}</td>
        </tr>`;
      }).join('');
      return `<h3 style="font-size:13px;margin:12px 0 6px;">${exam ? exam.name : 'Exam'} — ${examGrade} (${examPct}%)</h3>
        <table>
          <thead><tr><th>Subject</th><th>Marks</th><th>Max</th><th>%</th><th>Grade</th></tr></thead>
          <tbody>${rows}
            <tr style="background:#f0f0f0;font-weight:700;">
              <td>Total</td><td>${examObt}</td><td>${examMax}</td>
              <td>${examPct}%</td><td>${examGrade}</td>
            </tr>
          </tbody>
        </table>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
    <title>EduTrack Report Card — ${s.name}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #111; font-size: 13px; }
      .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
      .header h1 { font-size: 20px; margin: 0 0 4px; }
      .header p  { margin: 2px 0; color: #555; font-size: 12px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .info-table td { padding: 5px 8px; font-size: 12px; border: 1px solid #ddd; }
      .info-table td:first-child { font-weight: 700; width: 140px; background: #f5f5f5; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
      th { background: #f0f0f0; font-weight: 700; }
      .att-box { background: #f9f9f9; border: 1px solid #ccc; padding: 10px 14px;
        border-radius: 4px; margin-bottom: 14px; font-size: 13px; }
      .overall { text-align: center; border: 2px solid #333; border-radius: 6px;
        padding: 14px; margin-top: 14px; }
      .overall .big { font-size: 32px; font-weight: 900; }
      .footer { font-size: 10px; color: #999; text-align: center; margin-top: 20px; }
      .warn { color: #c00; font-weight: 700; }
      @media print { body { margin: 10px; } }
    </style>
    </head><body>
    <div class="header">
      <h1>EduTrack — Student Report Card</h1>
      <p>${d.schoolName || ''}</p>
      <p>${d.cls ? d.cls.name : ''}</p>
      <p>Generated: ${APP.today()}</p>
    </div>

    <table class="info-table">
      <tr><td>Student Name</td><td>${s.name}</td></tr>
      <tr><td>Roll No</td><td>${s.roll_no || '—'}</td></tr>
      <tr><td>Class</td><td>${d.cls ? d.cls.name : '—'}</td></tr>
      <tr><td>Date of Birth</td><td>${s.dob || '—'}</td></tr>
    </table>

    <div class="att-box">
      <strong>Attendance:</strong> ${present} / ${att.length} days present
      &nbsp;|&nbsp; <strong>${attPct}%</strong>
      ${attPct < 75 ? ' &nbsp;<span class="warn">⚠️ Below 75% — Attendance Shortage</span>' : ''}
    </div>

    ${examHTML || '<p style="color:#888;">No marks recorded yet.</p>'}

    ${totalMax > 0
      ? `<div class="overall">
          <div class="big">${overallPct}%</div>
          <div style="font-size:14px;margin-top:4px;">Overall Grade: <strong>${overallGrade}</strong></div>
          <div style="font-size:12px;color:#555;margin-top:4px;">${totalObt} / ${totalMax} marks</div>
        </div>`
      : ''
    }

    <div class="footer">Generated by EduTrack v2.1 — School Management for Rural India</div>
    <script>window.onload = function() { window.print(); }<\/script>
    </body></html>`);
    win.document.close();
  },

  // ─── WHATSAPP SHARE ──────────────────────────────────────────────────
  whatsAppReport() {
    if (!PARENT.studentData) { APP.showToast('No data to share.', 'warning'); return; }
    const d   = PARENT.studentData;
    const s   = d.student;
    const ms  = PARENT._buildMarksSummary();
    const att = d.attendance;

    const present = att.filter(function(a) { return a.status === 'present'; }).length;
    const attPct  = att.length > 0 ? Math.round((present / att.length) * 100) : 0;

    let marksText = '';
    Object.keys(ms.grouped).forEach(function(examId) {
      const exam    = d.exams.find(function(e) { return e.exam_id === examId; });
      const records = ms.grouped[examId];
      const eObt    = records.reduce(function(s, m) { return s + m.marks_obtained; }, 0);
      const eMax    = records.reduce(function(s, m) { return s + m.max_marks; }, 0);
      const ePct    = eMax > 0 ? Math.round((eObt / eMax) * 100) : 0;
      const eGrade  = PARENT.calcGrade(eObt, eMax);
      marksText    += (exam ? exam.name : 'Exam') + ': ' + eObt + '/' + eMax +
                      ' (' + ePct + '% · ' + eGrade + ')\n';
    });

    const msg = encodeURIComponent(
      '📋 EduTrack Report Card\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'Student: ' + s.name + '\n' +
      'Roll No: ' + (s.roll_no || '—') + '\n' +
      'Class:   ' + (d.cls ? d.cls.name : '—') + '\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'Attendance: ' + attPct + '% (' + present + '/' + att.length + ' days)\n' +
      (attPct < 75 ? '⚠️ Attendance below 75%\n' : '') +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      (marksText ? 'Marks:\n' + marksText : 'No marks recorded yet\n') +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      'Overall: ' + ms.overallPct + '% · Grade ' + ms.overallGrade + '\n' +
      'Generated by EduTrack v2.1'
    );
    window.open('https://wa.me/?text=' + msg, '_blank');
  }
};