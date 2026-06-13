// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  // Supabase
  SUPABASE_URL:  'https://vvhtrksohzsgykqtpyio.supabase.co',
  SUPABASE_KEY:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aHRya3NvaHpzZ3lrcXRweWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjQ4ODQsImV4cCI6MjA5NDYwMDg4NH0.OjHbb26fzGSrHq8LWUcDIFFeJsydPkXBSg65t3cm1gk',

  // localStorage key prefix — prevents collisions with other apps
  LS_PREFIX: 'edutrack_',

  // IndexedDB config
  IDB_NAME:    'edutrack_sync',
  IDB_VERSION: 1,
  IDB_STORE:   'queue',

  // Sync settings
  SYNC_INTERVAL:  30000,   // auto-sync every 30 seconds
  MAX_RETRIES:    3,        // max retry attempts per failed record
  PING_TIMEOUT:   5000,     // connectivity check timeout ms

  // App info
  APP_NAME:    'EduTrack',
  APP_VERSION: '2.1',

  // Attendance thresholds
  ATTENDANCE_RISK_PCT: 75,  // below this = at-risk

  // Grade thresholds
  GRADES: [
    { min: 90, grade: 'A+' },
    { min: 80, grade: 'A'  },
    { min: 70, grade: 'B+' },
    { min: 60, grade: 'B'  },
    { min: 50, grade: 'C'  },
    { min: 35, grade: 'D'  },
    { min: 0,  grade: 'F'  }
  ]
};