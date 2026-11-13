const screen = document.querySelector('#screen');
const partners = ['Lyn', 'Edison'];
const habits = ['Wake by 7 a.m.', 'Work out', 'Share morning schedule', 'Phone-free first 30 minutes', 'Read 30 minutes', 'Sleep at least 7 hours', 'Reflect or journal', 'Work on career goal'];
const goals = ['Our one-year plan', 'Retire by 30'];
const key = 'duvie-v1';
const state = JSON.parse(localStorage.getItem(key) || '{}');
state.events ??= [];
state.logs ??= {};
state.answers ??= {};
state.milestones ??= [[], []];

const localDate = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part) => String(part).padStart(2, '0')).join('-');
const offset = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const monday = (date) => offset(date, -((date.getDay() + 6) % 7));
const week = () => localDate(monday(new Date()));
const today = () => localDate(new Date());
const longDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const save = () => localStorage.setItem(key, JSON.stringify(state));
let date = today();
let page = 'today';
let editing = null;
let goal = 0;
let answerAuthor = null;
const routineLog = (day, partner) => state.logs[day]?.[partner] || {};
function countRoutines(day, partner) {
  const log = routineLog(day, partner);
  return habits.reduce((count, _, index) => count + Number(Boolean(log[index])), 0);
}
const percentage = (done, due) => Math.round(done * 100 / due);
const currentAnswers = () => state.answers[week()] || {};
const time = (value) => new Date('2000-01-01T' + value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
const back = (target, label) => `<button class="back" data-go="${target}">← ${label}</button>`;

function dailyCommitment() {
  if (date > today()) return 'Routines open on this day.';
  const done = partners.reduce((total, partner) => total + countRoutines(date, partner), 0);
  const due = habits.length * partners.length;
  return `${done} of ${due} routines · ${percentage(done, due)}%`;
}

function routineTable() {
  const future = date > today();
  return `<section>
    <h2 id="routine-title">Daily routines</h2>
    <table class="routine-table" aria-labelledby="routine-title">
      <thead><tr><th scope="col">Routine</th>${partners.map((partner) => `<th scope="col">${partner}</th>`).join('')}</tr></thead>
      <tbody>${habits.map((habit, index) => `<tr><th scope="row">${habit}</th>
        ${partners.map((partner) => `<td><label class="routine-toggle">
          <input type="checkbox" data-habit="${index}" data-partner="${partner}" aria-label="${partner}: ${habit}"
            ${routineLog(date, partner)[index] ? 'checked' : ''} ${future ? 'disabled' : ''}>
        </label></td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <p class="routine-total" role="status"><strong>Together</strong> <span id="daily-commitment">${dailyCommitment()}</span></p>
  </section>`;
}

function todayView() {
  const start = monday(new Date(date + 'T12:00:00'));
  const days = Array.from({length:7}, (_, i) => offset(start,i));
  const events = state.events.filter((event) => event.date === date).sort((a,b) => a.start.localeCompare(b.start));
  return `<h1>Today</h1><p class="muted">${longDate(date)}</p>
    <div class="week" aria-label="Select a day">${days.map((day) => `<button data-date="${localDate(day)}" aria-pressed="${localDate(day) === date}"><span>${day.toLocaleDateString(undefined,{weekday:'short'})}</span><span>${day.getDate()}</span></button>`).join('')}</div>
    <div class="row"><button data-week="-7" aria-label="Previous week">←</button><button data-date="${today()}">Today</button><button data-week="7" aria-label="Next week">→</button></div>
    <section><div class="heading"><h2>Schedule</h2><button data-go="event">+ Add event</button></div>
    ${events.length ? events.map((event) => `<div class="row event"><small>${time(event.start)}</small><span>${esc(event.title)} <small>· ${esc(event.owner)}${event.end ? ' · until ' + time(event.end) : ''}</small></span><button data-edit="${event.id}" aria-label="Edit ${esc(event.title)}">Edit</button></div>`).join('') : '<p class="muted">Nothing scheduled for this day.</p>'}</section>
    ${routineTable()}`;
}

function eventView() {
  const event = state.events.find(({id}) => id === editing);
  return `${back('today','Today')}<h1>${event ? 'Edit event' : 'Add to schedule'}</h1><p class="muted">${longDate(date)}</p>
  <form id="event"><label>Event<input name="title" required maxlength="90" value="${esc(event?.title || '')}" placeholder="Dinner together"></label>
  <div class="times"><label>Starts<input name="start" type="time" required value="${event?.start || ''}"></label><label>Ends <small>Optional</small><input name="end" type="time" value="${event?.end || ''}"></label></div>
  <label>For<select name="owner" required>
    <option value="" disabled ${event ? '' : 'selected'}>Choose who this is for</option>
    ${[...partners, 'Together'].map((owner) => `<option ${owner === event?.owner ? 'selected' : ''}>${owner}</option>`).join('')}
  </select></label>
  <button class="primary">Save event</button><p class="error" role="alert" id="error"></p></form>
  ${event ? '<button data-delete>Delete event</button>' : ''}`;
}

function nookView() {
  const count = Object.values(state.answers).filter((answers) => answers.Lyn && answers.Edison).length;
  return `<h1>Nook</h1><button class="pet${count ? " learned" : ""}" data-pat><img src="nook-otter.png" alt="Otter floating with a stone">Tap to say hi</button>
  <p class="muted" id="pet-note" aria-live="polite">${count ? `${count} shared check-in${count === 1 ? '' : 's'} · Stone trick learned` : 'Finish a check-in together to teach your otter a stone trick.'}</p>
  <section><h2>Weekly check-in</h2><div class="row"><span>What helped us this week?</span><button data-go="checkin">Open</button></div></section>`;
}

function checkinView() {
  const answers = currentAnswers();
  const shared = partners.every((partner) => answers[partner]);
  return `${back('nook','Nook')}<h1>Weekly check-in</h1>
    <section><h2>What helped us this week?</h2>
    <p class="muted">${shared ? 'You’ve both answered.' : 'Answers appear here once both of you have shared.'}</p>
    ${partners.map((partner) => `<div class="row">
      <strong>${partner}</strong>
      <button data-answer-for="${partner}" aria-label="${answers[partner] ? 'Edit' : 'Write'} ${partner}’s answer">${answers[partner] ? 'Edit answer' : 'Write answer'}</button>
    </div>
    ${shared ? `<p class="checkin-answer">${esc(answers[partner])}</p>` : (answers[partner] ? '<p class="muted">Answer shared</p>' : '')}
    ${answerAuthor === partner ? `<form id="checkin" data-author="${partner}">
      <label>${partner}’s answer<textarea name="answer" required rows="5" maxlength="1500">${esc(answers[partner] || '')}</textarea></label>
      <button class="primary">${answers[partner] ? 'Update answer' : 'Share answer'}</button>
      <p class="error" role="alert" id="error"></p>
    </form>` : ''}`).join('')}</section>`;
}

function progressView() {
  const first = '2026-11-08';
  const last = '2027-11-08';
  const end = [today(), localDate(offset(new Date(last + 'T12:00:00'), 1))].sort()[0];
  const days = Math.max(0, (Date.parse(end) - Date.parse(first)) / 86400000);
  if (!days) return '<p class="muted">Progress starts after the first day of the plan.</p>';

  const scoredDays = Object.keys(state.logs).filter((day) => day >= first && day < end);
  const due = days * habits.length;
  const scores = partners.map((partner) => scoredDays.reduce((total, day) => total + countRoutines(day, partner), 0));
  const combined = scores.reduce((total, score) => total + score, 0);
  return `<dl class="commitment-scores">
    ${partners.map((partner, index) => `<div><dt>${partner}</dt><dd>${percentage(scores[index], due)}%</dd></div>`).join('')}
    <div><dt>Together</dt><dd>${percentage(combined, due * partners.length)}%</dd></div>
  </dl>`;
}

function goalView() {
  const milestones = state.milestones[goal];
  return `${back('plan','Plan')}<h1>${goals[goal]} <span class="plant" aria-label="${milestones.filter((item) => item.done).length} milestones complete">${milestones.some((item) => item.done) ? '✿' : '♧'}</span></h1>
  ${goal === 0 ? `<p class="muted">Through Nov 8, 2027 · Target over 90%</p><section><h2>Habit progress</h2><p class="muted">All routines due from Nov 8, 2026 through yesterday, up to the end of the plan.</p>${progressView()}</section>` : ''}
  <section><h2>Next milestones</h2>${milestones.map((item,i) => item.done ? '' : `<div class="row"><span>${esc(item.title)}</span><button data-complete="${i}">Mark complete</button></div>`).join('')}
  <form id="milestone"><label>Add a milestone<input name="title" required maxlength="140" placeholder="${goal === 1 ? 'Define what retirement means to us' : 'Choose a shared next step'}"></label><button class="primary">Add milestone</button><p class="error" role="alert" id="error"></p></form></section>
  <section><h2>Milestone history</h2>${milestones.some((item) => item.done) ? milestones.map((item,i) => item.done ? `<div class="row"><span>${esc(item.title)} <small>· ${longDate(item.done)}</small></span><button data-complete="${i}">Undo</button></div>` : '').join('') : '<p class="muted">Completed milestones will appear here.</p>'}</section>`;
}

function planView() {
  return `<h1>Plan</h1><section><h2>Our one-year plan</h2><p>Target · over 90%</p>
    <p class="muted">Commitment through yesterday</p>${progressView()}
    <button data-goal="0">Open plan</button></section>
  <section><h2>Retire by 30</h2><p class="muted">${esc(state.milestones[1].find((item) => !item.done)?.title || 'Choose your next milestone together.')}</p><button data-goal="1">Open goal</button></section>`;
}

const views = {today:todayView,event:eventView,nook:nookView,checkin:checkinView,plan:planView,goal:goalView};
function render() {
  screen.innerHTML = views[page]();
  const parent = {event:'today',checkin:'nook',goal:'plan'}[page] || page;
  document.querySelectorAll('nav button').forEach((button) => {
    if (button.dataset.page === parent) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const {page:tab,go,date:day,week:shift,edit,goal:target,complete} = button.dataset;
  if (button.hasAttribute('data-pat')) {
    button.classList.remove('pat');
    void button.offsetWidth;
    button.classList.add('pat');
    document.querySelector('#pet-note').textContent = Object.values(state.answers).some((a) => a.Lyn && a.Edison)
      ? 'Your otter balances the stone and catches it.' : 'Your otter gives a little wiggle.';
    return;
  }
  if (tab || go) { page = tab || go; editing = null; answerAuthor = null; }
  else if (button.dataset.answerFor) answerAuthor = button.dataset.answerFor;
  else if (day) date = day;
  else if (shift) date = localDate(offset(new Date(date + 'T12:00:00'),Number(shift)));
  else if (edit) { editing = edit; page = 'event'; }
  else if (target !== undefined) { goal = Number(target); page = 'goal'; }
  else if (complete !== undefined) {
    const item = state.milestones[goal][Number(complete)];
    item.done = item.done ? null : today();
    save();
  } else if (button.hasAttribute('data-delete')) {
    if (!confirm('Delete this event?')) return;
    state.events = state.events.filter(({id}) => id !== editing);
    editing = null;
    page = 'today';
    save();
  } else return;
  render();
});

screen.addEventListener('change', ({target}) => {
  const {habit, partner} = target.dataset;
  if (habit === undefined || !partners.includes(partner) || date > today()) return;
  state.logs[date] ??= {};
  state.logs[date][partner] ??= {};
  state.logs[date][partner][habit] = target.checked;
  save();
  screen.querySelector('#daily-commitment').textContent = dailyCommitment();
});

screen.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const error = (message) => { document.querySelector('#error').textContent = message; };
  switch (event.target.id) {
    case 'event': {
      if (!data.title.trim()) return error('Enter an event name.');
      if (![...partners, 'Together'].includes(data.owner)) return error('Choose who the event is for.');
      if (data.end && data.end <= data.start) return error('End time must be after start time.');
      const item = { ...data,title:data.title.trim(),date,id:editing || crypto.randomUUID() };
      if (editing) state.events = state.events.map((old) => old.id === editing ? item : old);
      else state.events.push(item);
      editing = null;
      page = 'today';
      break;
    }
    case 'checkin': {
      const {author} = event.target.dataset;
      if (!partners.includes(author)) return;
      if (!data.answer.trim()) return error('Write an answer before sharing.');
      state.answers[week()] ??= {};
      state.answers[week()][author] = data.answer.trim();
      answerAuthor = null;
      break;
    }
    case 'milestone':
      if (!data.title.trim()) return error('Enter a milestone.');
      state.milestones[goal].push({title:data.title.trim(),done:null});
      break;
  }
  save();
  render();
});

render();
