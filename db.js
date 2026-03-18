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