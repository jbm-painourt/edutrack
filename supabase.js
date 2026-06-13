// ─── SUPABASE / DB LAYER ─────────────────────────────────────────────────────
// All Supabase REST API calls go through this file.
// No Supabase JS SDK — raw fetch calls for PWA compatibility.

const DB = {

  // ─── BASE REQUEST ──────────────────────────────────────────────────
  async request(method, table, body, query) {
    query = query || '';
    const url     = CONFIG.SUPABASE_URL + '/rest/v1/' + table + query;
    const headers = {
      'apikey':        CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        method === 'POST' ? 'return=representation' : 'return=representation'
    };

    try {
      const options = { method: method, headers: headers };
      if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }
      const res  = await fetch(url, options);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      if (!res.ok) {
        console.error('[DB] ' + method + ' ' + table + ' failed:', res.status, data);
        return { error: data, data: null };
      }
      return { error: null, data: Array.isArray(data) ? data : [data] };
    } catch (e) {
      console.error('[DB] network error:', e);
      return { error: e.message, data: null };
    }
  },

  // ─── PING (connectivity check) ─────────────────────────────────────
  async ping() {
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(function() { controller.abort(); }, CONFIG.PING_TIMEOUT);
      const res = await fetch(
        CONFIG.SUPABASE_URL + '/rest/v1/schools?limit=1',
        {
          method:  'GET',
          headers: {
            'apikey':        CONFIG.SUPABASE_KEY,
            'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeout);
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // ─── USERS ─────────────────────────────────────────────────────────
  async getUserByUsername(username) {
    return DB.request('GET', 'users', null,
      '?username=eq.' + encodeURIComponent(username));
  },

  async getUsersBySchool(school_id, role) {
    let query = '?school_id=eq.' + school_id;
    if (role) query += '&role=eq.' + role;
    return DB.request('GET', 'users', null, query);
  },

  async createUser(school_id, name, role, username, password, phone) {
    return DB.request('POST', 'users', {
      school_id:  school_id,
      name:       name,
      role:       role,
      username:   username,
      password:   password,
      phone:      phone || null,
      created_at: new Date().toISOString()
    });
  },

  // ─── SCHOOLS ───────────────────────────────────────────────────────
  async createSchool(name, code, address) {
    return DB.request('POST', 'schools', {
      name:       name,
      code:       code,
      address:    address || null,
      created_at: new Date().toISOString()
    });
  },

  async getSchool(school_id) {
    return DB.request('GET', 'schools', null,
      '?school_id=eq.' + school_id);
  },

  // ─── CLASSES ───────────────────────────────────────────────────────
  async getClassesBySchool(school_id) {
    return DB.request('GET', 'classes', null,
      '?school_id=eq.' + school_id);
  },

  // ─── STUDENTS ──────────────────────────────────────────────────────
  async getStudentsBySchool(school_id) {
    return DB.request('GET', 'students', null,
      '?school_id=eq.' + school_id + '&order=name.asc');
  },

  async getStudentsByClass(class_id) {
    return DB.request('GET', 'students', null,
      '?class_id=eq.' + class_id + '&order=roll_no.asc');
  },

  async deleteStudentCascade(student_id) {
    // delete marks, attendance, then student
    await DB.request('DELETE', 'marks',      null, '?student_id=eq.' + student_id);
    await DB.request('DELETE', 'attendance', null, '?student_id=eq.' + student_id);
    return DB.request('DELETE', 'students',  null, '?student_id=eq.' + student_id);
  },

  // ─── ATTENDANCE ────────────────────────────────────────────────────
  async getAttendanceBySchool(school_id) {
    return DB.request('GET', 'attendance', null,
      '?school_id=eq.' + school_id + '&order=date.desc');
  },

  async getAttendanceByDate(school_id, date) {
    return DB.request('GET', 'attendance', null,
      '?school_id=eq.' + school_id + '&date=eq.' + date);
  },

  async getAttendanceByStudent(student_id) {
    return DB.request('GET', 'attendance', null,
      '?student_id=eq.' + student_id + '&order=date.desc');
  },

  // ─── MARKS ─────────────────────────────────────────────────────────
  async getMarksBySchool(school_id) {
    return DB.request('GET', 'marks', null,
      '?school_id=eq.' + school_id);
  },

  async getMarksByStudent(student_id) {
    return DB.request('GET', 'marks', null,
      '?student_id=eq.' + student_id);
  },

  // ─── EXAMS ─────────────────────────────────────────────────────────
  async getExamsBySchool(school_id) {
    return DB.request('GET', 'exams', null,
      '?school_id=eq.' + school_id);
  },

  // ─── SUBJECTS ──────────────────────────────────────────────────────
  async getSubjectsBySchool(school_id) {
    return DB.request('GET', 'subjects', null,
      '?school_id=eq.' + school_id);
  },

  // ─── SYNC UPSERT ───────────────────────────────────────────────────
  // used by sync.js to push a single record to Supabase
  async syncRecord(table, record) {
    // upsert — insert or update based on primary key
    const url     = CONFIG.SUPABASE_URL + '/rest/v1/' + table;
    const headers = {
      'apikey':        CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal'
    };
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: headers,
        body:    JSON.stringify(record)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('[DB] syncRecord failed:', res.status, text);
        return { error: text };
      }
      return { error: null };
    } catch (e) {
      console.error('[DB] syncRecord network error:', e);
      return { error: e.message };
    }
  },

  // ─── BULK SYNC ─────────────────────────────────────────────────────
  // upsert multiple records at once — used for initial cache load
  async bulkUpsert(table, records) {
    if (!records || records.length === 0) return { error: null };
    const url     = CONFIG.SUPABASE_URL + '/rest/v1/' + table;
    const headers = {
      'apikey':        CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal'
    };
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: headers,
        body:    JSON.stringify(records)
      });
      if (!res.ok) {
        const text = await res.text();
        return { error: text };
      }
      return { error: null };
    } catch (e) {
      return { error: e.message };
    }
  }
};