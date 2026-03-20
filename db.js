// db.js — shared Supabase client and data functions

const SUPABASE_URL = 'https://mrckiobnrykxmunpysqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wJ8a8fiYNnSgtg6DC3IYqQ_8Ec5TlRo';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth helpers ──────────────────────────────────────────
async function requireAuth() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.href = 'login.html';
    return null;
  }
  return data.session.user;
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// ── Sessions ──────────────────────────────────────────────
async function loadSessions(userId) {
  const { data, error } = await sb
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) { console.error('loadSessions:', error); return []; }
  return data.map(row => ({
    id:          row.id,
    date:        row.date,
    type:        row.type,
    duration:    row.duration,
    notes:       row.notes,
    exercises:   row.exercises   || [],
    runData:     row.run_data    || null,
    stairsData:  row.stairs_data || null,
    ruckData:    row.ruck_data   || null,
  }));
}

async function saveSession(userId, session) {
  const row = {
    user_id:     userId,
    date:        session.date,
    type:        session.type,
    duration:    session.duration,
    notes:       session.notes,
    exercises:   session.exercises   || [],
    run_data:    session.runData     || null,
    stairs_data: session.stairsData  || null,
    ruck_data:   session.ruckData    || null,
  };
  if (session.id) {
    const { error } = await sb.from('sessions').update(row).eq('id', session.id);
    if (error) console.error('updateSession:', error);
  } else {
    const { data, error } = await sb.from('sessions').insert(row).select().single();
    if (error) console.error('insertSession:', error);
    else session.id = data.id;
  }
}

async function deleteSession(sessionId) {
  const { error } = await sb.from('sessions').delete().eq('id', sessionId);
  if (error) console.error('deleteSession:', error);
}

// ── Weighins ──────────────────────────────────────────────
async function loadWeighins(userId) {
  const { data, error } = await sb
    .from('weighins')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) { console.error('loadWeighins:', error); return []; }
  return data;
}

async function saveWeighin(userId, entry) {
  const row = { user_id: userId, date: entry.date, weight: entry.weight, notes: entry.notes };
  if (entry.id) {
    const { error } = await sb.from('weighins').update(row).eq('id', entry.id);
    if (error) console.error('updateWeighin:', error);
  } else {
    const { data, error } = await sb.from('weighins').insert(row).select().single();
    if (error) console.error('insertWeighin:', error);
    else entry.id = data.id;
  }
}

async function deleteWeighin(id) {
  const { error } = await sb.from('weighins').delete().eq('id', id);
  if (error) console.error('deleteWeighin:', error);
}

// ── GTG entries ───────────────────────────────────────────
async function loadGTG(userId) {
  const { data, error } = await sb
    .from('gtg_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error('loadGTG:', error); return { pullups: [], pushups: [] }; }
  return {
    pullups: data.filter(e => e.type === 'pullup').map(e => ({ id:e.id, date:e.date, time:e.time, reps:e.reps, grip:e.variant })),
    pushups: data.filter(e => e.type === 'pushup').map(e => ({ id:e.id, date:e.date, time:e.time, reps:e.reps, variant:e.variant })),
  };
}

async function saveGTGEntry(userId, entry, type) {
  const row = {
    user_id: userId,
    date:    entry.date,
    time:    entry.time,
    reps:    entry.reps,
    type:    type,
    variant: type === 'pullup' ? entry.grip : entry.variant,
  };
  const { data, error } = await sb.from('gtg_entries').insert(row).select().single();
  if (error) console.error('insertGTG:', error);
  else entry.id = data.id;
}

async function deleteGTGEntry_db(id) {
  const { error } = await sb.from('gtg_entries').delete().eq('id', id);
  if (error) console.error('deleteGTG:', error);
}

// ── Profile ───────────────────────────────────────────────
async function loadProfile(userId) {
  const { data, error } = await sb
    .from('profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return {};
  return data;
}

async function saveProfileDB(userId, dob) {
  const existing = await loadProfile(userId);
  if (existing.id) {
    await sb.from('profile').update({ dob }).eq('id', existing.id);
  } else {
    await sb.from('profile').insert({ user_id: userId, dob });
  }
}

// ── Preferences ───────────────────────────────────────────
async function loadPreferences(userId) {
  const { data, error } = await sb
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return { weight_unit:'lbs', gtg_goal:15, pgu_goal:30, theme:'dark' };
  return data;
}

async function savePreferences(userId, prefs) {
  const existing = await loadPreferences(userId);
  if (existing.id) {
    await sb.from('preferences').update(prefs).eq('id', existing.id);
  } else {
    await sb.from('preferences').insert({ user_id: userId, ...prefs });
  }
}

// ── Migrate from localStorage ─────────────────────────────
async function migrateFromLocalStorage(userId) {
  const migrated = localStorage.getItem('sb-migrated');
  if (migrated) return;

  console.log('Migrating localStorage data to Supabase...');

  // Sessions
  const localSessions = JSON.parse(localStorage.getItem('workout-log') || '[]');
  for (const s of localSessions) {
    await saveSession(userId, s);
  }

  // Weighins
  const localWeighins = JSON.parse(localStorage.getItem('workout-weighins') || '[]');
  for (const w of localWeighins) {
    await saveWeighin(userId, w);
  }

  // GTG pull-ups
  const localGTG = JSON.parse(localStorage.getItem('gtg-log') || '[]');
  for (const e of localGTG) {
    await saveGTGEntry(userId, e, 'pullup');
  }

  // GTG push-ups
  const localPGU = JSON.parse(localStorage.getItem('pgu-log') || '[]');
  for (const e of localPGU) {
    await saveGTGEntry(userId, e, 'pushup');
  }

  // Profile
  const localProfile = JSON.parse(localStorage.getItem('workout-profile') || '{}');
  if (localProfile.dob) {
    await saveProfileDB(userId, localProfile.dob);
  }

  // Preferences
  await savePreferences(userId, {
    weight_unit: localStorage.getItem('weight-unit') || 'lbs',
    gtg_goal:    parseInt(localStorage.getItem('gtg-goal')  || '15'),
    pgu_goal:    parseInt(localStorage.getItem('pgu-goal')  || '30'),
    theme:       localStorage.getItem('theme') || 'dark',
  });

  localStorage.setItem('sb-migrated', 'true');
  console.log('Migration complete.');
}

async function loadRPGProfile(userId) {
  const { data, error } = await sb  // was: supabase
    .from('profile_rpg')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

async function saveRPGProfile(userId, profile) {
  const { data, error } = await sb  // was: supabase
    .from('profile_rpg')
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() });
  if (error) { console.error('saveRPGProfile error', error); return null; }
  return data;
}

async function logXP(userId, entries) {
  const rows = entries.map(e => ({ user_id: userId, ...e }));
  const { error } = await sb  // was: supabase
    .from('xp_log').insert(rows);
  if (error) console.error('logXP error', error);
}

async function loadXPTotals(userId) {
  const { data, error } = await sb  // was: supabase
    .from('xp_log')
    .select('muscle, xp_type, amount')
    .eq('user_id', userId);
  if (error) return {};
  const totals = {};
  data.forEach(row => {
    if (!totals[row.muscle]) totals[row.muscle] = 0;
    totals[row.muscle] += row.amount;
  });
  return totals;
}

// ── XP Engine ─────────────────────────────────────────────

// ── XP Engine ─────────────────────────────────────────────

const XP_TIERS = [
  { name: 'Rookie',       min: 0     },
  { name: 'Beginner',     min: 500   },
  { name: 'Intermediate', min: 2000  },
  { name: 'Advanced',     min: 5000  },
  { name: 'Expert',       min: 10000 },
  { name: 'Master',       min: 20000 },
  { name: 'Legend',       min: 50000 },
];

const CLASS_MULTIPLIERS = {
  Warrior: { power:1.25, persistence:1.0,  precision:1.0,  bodyweight:1.0,  functional:1.0,  all:1.0 },
  Scout:   { power:1.0,  persistence:1.25, precision:1.0,  bodyweight:1.0,  functional:1.0,  all:1.0 },
  Ranger:  { power:1.0,  persistence:1.0,  precision:1.0,  bodyweight:1.0,  functional:1.0,  all:1.1 },
  Monk:    { power:1.0,  persistence:1.0,  precision:1.0,  bodyweight:1.25, functional:1.0,  all:1.0 },
  Brawler: { power:1.0,  persistence:1.0,  precision:1.0,  bodyweight:1.0,  functional:1.25, all:1.0 },
};

const BODYWEIGHT_EXERCISES = [
  'pull-ups', 'negative pull-ups', 'push-up', 'dips', 'sissy squat',
  'step-ups', 'dead hang', 'scapular pull-ups', 'bird-dog', 'dead bug'
];

const FUNCTIONAL_EXERCISES = [
  'sandbag', 'farmer', 'ez bar axe', 'ruck', 'stair'
];

const ENDURANCE_SESSIONS = ['Stairs', 'Ruck', 'Run'];

function getTier(xp) {
  let tier = XP_TIERS[0];
  for (const t of XP_TIERS) {
    if (xp >= t.min) tier = t;
  }
  return tier;
}

function getTierIndex(xp) {
  let idx = 0;
  for (let i = 0; i < XP_TIERS.length; i++) {
    if (xp >= XP_TIERS[i].min) idx = i;
  }
  return idx;
}

function getClassMultiplier(classes, xpType, exerciseName) {
  if (!classes) return 1;
  const { primary, secondary } = classes;
  let mult = 1;
  const name = (exerciseName || '').toLowerCase();
  const isBodyweight = BODYWEIGHT_EXERCISES.some(e => name.includes(e));
  const isFunctional = FUNCTIONAL_EXERCISES.some(e => name.includes(e));
  for (const cls of [primary, secondary].filter(Boolean)) {
    const m = CLASS_MULTIPLIERS[cls] || CLASS_MULTIPLIERS.Ranger;
    mult *= m.all;
    if (xpType === 'power')       mult *= m.power;
    if (xpType === 'persistence') mult *= m.persistence;
    if (xpType === 'precision')   mult *= m.precision;
    if (isBodyweight)             mult *= m.bodyweight;
    if (isFunctional)             mult *= m.functional;
  }
  return mult;
}

async function calculateAndLogSessionXP(userId, session, muscleDB, rpgProfile, profileWeight) {
  const xpEntries = [];
  const classes = rpgProfile ? {
    primary:   rpgProfile.class_primary,
    secondary: rpgProfile.class_secondary,
  } : null;

  // bodyweight in lbs for relative strength calculation
  const bodyweightLbs = profileWeight ? profileWeight * 2.20462 : 154;

  // ── Power XP from exercises ───────────────────────────
  (session.exercises || []).forEach(ex => {
    const mapping = muscleDB[ex.name] || findPartialMapping(ex.name, muscleDB);
    if (!mapping) return;

    const name = ex.name.toLowerCase();
    const isBodyweight = BODYWEIGHT_EXERCISES.some(e => name.includes(e));

    let powerXP = 0;
    if (ex.varies && ex.setData) {
      powerXP = ex.setData.reduce((sum, s) => {
        const r = parseFloat(s.reps) || 0;
        const w = isBodyweight ? bodyweightLbs * 0.7 : (parseFloat(s.weight) || 0);
        const relativeLoad = w / bodyweightLbs;
        return sum + (r * relativeLoad * 100);
      }, 0);
    } else {
      const sets = parseFloat(ex.sets)   || 1;
      const reps = parseFloat(ex.reps)   || 0;
      const w    = isBodyweight ? bodyweightLbs * 0.7 : (parseFloat(ex.weight) || 0);
      const relativeLoad = w / bodyweightLbs;
      powerXP = sets * reps * relativeLoad * 100;
    }

    powerXP = Math.round(Math.sqrt(powerXP) * 10);
    const mult = getClassMultiplier(classes, 'power', ex.name);

    (mapping.primary   || []).forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'power', amount:Math.round(powerXP * mult),        source_id:session.id, source_type:'exercise' });
    });
    (mapping.secondary || []).forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'power', amount:Math.round(powerXP * mult * 0.5),  source_id:session.id, source_type:'exercise' });
    });
    (mapping.tertiary  || []).forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'power', amount:Math.round(powerXP * mult * 0.25), source_id:session.id, source_type:'exercise' });
    });
  });

  // ── GTG XP ───────────────────────────────────────────
  if (session.type === 'Pull-ups') {
    const gtgMult = getClassMultiplier(classes, 'persistence', 'pull-ups');
    ['lats','biceps','rhomboids'].forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'persistence', amount:Math.round(75 * gtgMult), source_id:session.id, source_type:'gtg' });
    });
  }

  // ── Persistence XP ────────────────────────────────────
  const persistMult = getClassMultiplier(classes, 'persistence', session.type);
  let persistXP = 50;

  if (ENDURANCE_SESSIONS.includes(session.type)) {
    const duration = parseFloat(session.duration) || 0;
    persistXP += duration * 2;
    const stairMuscles = ['quads','glutes','calves','hamstrings','hip_flexors','erector_spinae'];
    stairMuscles.forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'persistence', amount:Math.round((persistXP * persistMult) / stairMuscles.length), source_id:session.id, source_type:'session' });
    });
  } else {
    const workedMuscles = new Set();
    (session.exercises || []).forEach(ex => {
      const mapping = muscleDB[ex.name] || findPartialMapping(ex.name, muscleDB);
      if (!mapping) return;
      (mapping.primary || []).forEach(m => workedMuscles.add(m));
    });
    workedMuscles.forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'persistence', amount:Math.round(persistXP * persistMult), source_id:session.id, source_type:'session' });
    });
  }

  // ── Precision XP ──────────────────────────────────────
  if (session.type === 'Stairs' && session.stairsData) {
    const hit = session.stairsData.hitTarget;
    let precisionXP = 0;
    if (hit === 'exceeded') precisionXP = 150;
    if (hit === 'hit')      precisionXP = 100;
    if (hit === 'short')    precisionXP = 25;
    const precMult = getClassMultiplier(classes, 'precision', 'stair');
    ['quads','glutes','calves','erector_spinae'].forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'precision', amount:Math.round(precisionXP * precMult), source_id:session.id, source_type:'precision' });
    });
  }

  if (session.type === 'Ruck' && session.ruckData) {
    const dist   = parseFloat(session.ruckData.distance) || 0;
    const weight = parseFloat(session.ruckData.weight)   || 0;
    // Ruck precision is also relative to bodyweight
    const packRatio    = weight / bodyweightLbs;
    const precisionXP  = Math.round(dist * packRatio * 50);
    const precMult     = getClassMultiplier(classes, 'precision', 'ruck');
    ['quads','glutes','calves','erector_spinae','traps'].forEach(m => {
      xpEntries.push({ muscle:m, xp_type:'precision', amount:Math.round(precisionXP * precMult), source_id:session.id, source_type:'precision' });
    });
  }

  if (xpEntries.length > 0) {
    await logXP(userId, xpEntries);
    const total = xpEntries.reduce((s, e) => s + e.amount, 0);
    if (rpgProfile) {
      await saveRPGProfile(userId, {
        ...rpgProfile,
        total_xp: (rpgProfile.total_xp || 0) + total,
      });
    }
  }

  return xpEntries;
}

function findPartialMapping(name, muscleDB) {
  const lower = name.toLowerCase();
  const key = Object.keys(muscleDB).find(k =>
    lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  return key ? muscleDB[key] : null;
}

function computeRadarData(xpTotals) {
  const avg = (...muscles) => {
    const vals = muscles.map(m => xpTotals[m] || 0);
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  };
  return {
    'Chest':           avg('chest', 'front_delt'),
    'Back':            avg('lats', 'rhomboids', 'traps', 'rear_delt'),
    'Shoulders':       avg('front_delt', 'side_delt', 'rear_delt'),
    'Arms':            avg('biceps', 'triceps', 'forearms'),
    'Core':            avg('abs', 'obliques', 'erector_spinae', 'quadratus_lumborum'),
    'Lower Body':      avg('quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors'),
    'Posterior Chain': avg('hamstrings', 'glutes', 'erector_spinae'),
    'Endurance':       avg('quads', 'calves', 'glutes', 'erector_spinae'),
  };
}