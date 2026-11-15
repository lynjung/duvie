(() => {
  const {url, publishableKey, signupEnabled = false} = window.duvieSyncConfig;
  if (!url && !publishableKey) return;

  let client;
  const tables = {
    events: 'duvie_events',
    routines: 'duvie_routines',
    milestones: 'duvie_milestones',
    answers: 'duvie_answers',
    profilePhotos: 'duvie_profile_photos'
  };

  function rows({data, error}) {
    if (error) throw error;
    return data;
  }

  async function read(table, spaceId, orderBy) {
    const size = 200;
    const result = [];
    for (let start = 0; ; start += size) {
      let query = client.from(table).select('*').eq('space_id', spaceId);
      for (const column of orderBy) query = query.order(column);
      const batch = rows(await query.range(start, start + size - 1));
      result.push(...batch);
      if (batch.length < size) return result;
    }
  }

  window.duvieSync = {
    signupEnabled,
    async connect() {
      if (!url || !publishableKey.startsWith('sb_publishable_') || new URL(url).protocol !== 'https:') {
        throw new Error('Set the Supabase HTTPS project URL and publishable key.');
      }
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.98.0/+esm');
      // The SDK clears a valid link's fragment during initialization.
      const link = new URLSearchParams(location.hash.slice(1));
      const type = link.get('type');
      const setupLink = link.has('access_token') && (type === 'recovery' || type === 'invite');
      client = sdk.createClient(url, publishableKey, {
        auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
      });
      const {error} = await client.auth.initialize();
      const linkFailed = link.has('error_code') || link.has('error_description') || (link.has('access_token') && Boolean(error));
      if (linkFailed) history.replaceState(history.state, '', location.pathname + location.search);
      const {session} = rows(await client.auth.getSession());
      return {session, setupPassword: Boolean(setupLink && !linkFailed && session), linkFailed};
    },
    async getSession() {
      return rows(await client.auth.getSession()).session;
    },
    onSessionChange(callback) {
      client.auth.onAuthStateChange((_event, session) => {
        // Run app requests outside the authentication callback.
        setTimeout(() => callback(session), 0);
      });
    },
    async signIn(email, password) {
      return rows(await client.auth.signInWithPassword({email, password})).session;
    },
    async sendPasswordLink(email) {
      return rows(await client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/', location.origin).href
      }));
    },
    async updatePassword(password) {
      rows(await client.auth.updateUser({password}));
    },
    async signUp(email, password) {
      return rows(await client.auth.signUp({
        email, password,
        options: {emailRedirectTo: new URL('/', location.origin).href}
      }));
    },
    async onboard(name, code) {
      return rows(await client.rpc('onboard_duvie_space', {display_name: name, partner_code: code}));
    },
    async createCoupleCode() {
      return rows(await client.rpc('create_duvie_couple_code'));
    },
    async signOut() {
      rows(await client.auth.signOut({scope: 'local'}));
    },
    async member(userId) {
      return rows(await client.from('duvie_members').select('space_id,name,user_id').eq('user_id', userId).maybeSingle());
    },
    async load(spaceId) {
      const [members, events, routines, milestones, answers, photos, space] = await Promise.all([
        read('duvie_members', spaceId, ['name']),
        read(tables.events, spaceId, ['id']),
        read(tables.routines, spaceId, ['member_id', 'day', 'habit']),
        read(tables.milestones, spaceId, ['created_at', 'id']),
        read(tables.answers, spaceId, ['author_id', 'week_start']),
        read(tables.profilePhotos, spaceId, ['member_id']),
        signupEnabled ? client.from('duvie_spaces').select('plan_start').eq('id', spaceId).single().then(rows) : null
      ]);
      const names = Object.fromEntries(members.map(({user_id, name}) => [user_id, name]));
      const logs = {};
      const weekly = {};
      const byGoal = [[], []];
      for (const {member_id, day, habit, done} of routines) {
        logs[day] ??= Object.create(null);
        logs[day][names[member_id]] ??= {};
        logs[day][names[member_id]][habit] = done;
      }
      for (const {author_id, week_start, answer} of answers) {
        weekly[week_start] ??= Object.create(null);
        weekly[week_start][names[author_id]] = answer;
      }
      for (const {goal, id, title, done} of milestones) byGoal[goal].push({id, title, done});
      return {
        events: events.map(({id, day, title, starts, ends, owner}) =>
          ({id, date: day, title, start: starts.slice(0, 5), end: ends?.slice(0, 5) || '', owner})),
        logs, milestones: byGoal, answers: weekly,
        ...(space ? {planStart: space.plan_start} : {}),
        spaceMembers: members.map(({name}) => name),
        profilePhotos: Object.fromEntries(photos.map(({member_id, photo}) => [names[member_id], photo]))
      };
    },
    async write(table, action, values, id) {
      const query = client.from(tables[table]);
      if (action === 'update' || action === 'delete') {
        const mutation = action === 'update' ? query.update(values) : query.delete();
        // An entry removed since the last refresh must not be reported as saved.
        const affected = rows(await mutation.eq('space_id', values.space_id).eq('id', id).select('id'));
        if (!affected.length) throw new Error('This entry has changed. Refresh and try again.');
        return;
      }
      rows(await query[action](values));
    }
  };
})();
