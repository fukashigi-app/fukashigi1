// ========================================
// FUKASHIGI APP — メンバー用 JavaScript
// ========================================

let currentUser     = null;
let currentUserData = null;
let allEvents       = [];
let currentFilter   = 'all';
let qrScanner       = null;
let selectedEvent   = null;

// チャット
let chatUnsubscribe  = null;
let currentChatRoom  = 'global';

// プロフィール編集
let selectedIcon = null;

const ICON_LIST = [
  '👤','😎','🤩','👑','🎭','🦊',
  '🐺','🦁','🐯','🦄','🐉','👾',
  '🤖','👻','🎃','💀','⚡','🔥',
  '💎','🌙','⭐','🌟','💫','🎯',
  '🃏','🎲','⚔️','🛡','🔮','🗝',
];

// ========================================
// 初期化・認証
// ========================================

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  await loadUserData();
  loadHome();
  loadEvents();
});

async function loadUserData() {
  const doc = await db.collection('users').doc(currentUser.uid).get();
  if (!doc.exists) {
    const data = {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email.split('@')[0],
      email: currentUser.email,
      iconUrl: '👤',
      memberNumber: 'F' + String(Date.now()).slice(-6),
      role: 'member',
      points: 0, totalPoints: 0, chips: 0,
      rank: 'ROOKIE', title: '新参者',
      badges: [], checkInCount: 0, eventJoinCount: 0,
      comment: '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(currentUser.uid).set(data);
    currentUserData = data;
  } else {
    currentUserData = doc.data();
    const rankInfo = calcRank(currentUserData.checkInCount || 0);
    const title    = calcTitle(currentUserData.checkInCount || 0, currentUserData.eventJoinCount || 0);
    if (currentUserData.rank !== rankInfo.rank || currentUserData.title !== title) {
      await db.collection('users').doc(currentUser.uid).update({ rank: rankInfo.rank, title });
      currentUserData.rank  = rankInfo.rank;
      currentUserData.title = title;
    }
  }
  if (currentUserData.role === 'admin') { window.location.href = 'admin.html'; }
}

function doLogout() {
  if (chatUnsubscribe) chatUnsubscribe();
  auth.signOut().then(() => { window.location.href = 'index.html'; });
}

// ========================================
// タブ切り替え
// ========================================

function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('nav-' + tab).classList.add('active');

  if (tab === 'mypage') loadMyPage();
  if (tab === 'chat')   loadChat();
}

// ========================================
// ホーム
// ========================================

function loadHome() {
  if (!currentUserData) return;
  const d = currentUserData;

  document.getElementById('headerUserName').textContent = d.name;
  document.getElementById('homeUserName').textContent   = d.name;
  document.getElementById('homeAvatar').textContent     = d.iconUrl || '👤';

  const rankInfo = calcRank(d.checkInCount || 0);
  document.getElementById('homeRankRow').innerHTML = `
    <span class="badge badge-gold" style="font-size:11px;">${rankInfo.rank}</span>
    <span class="badge badge-gray" style="font-size:11px;">${d.title || '新参者'}</span>
  `;

  document.getElementById('statPoints').textContent   = (d.points || 0).toLocaleString();
  document.getElementById('statCheckins').textContent = d.checkInCount || 0;
  document.getElementById('statChips').textContent    = d.chips || 0;

  checkTodayCheckIn();
  loadTodayMembers();
  loadNotices();
  loadHomeEvents();
}

async function checkTodayCheckIn() {
  const today = todayStr();
  const snap = await db.collection('checkins')
    .where('userId', '==', currentUser.uid)
    .where('dateStr', '==', today)
    .limit(1).get();

  const btn    = document.getElementById('checkinBtn');
  const status = document.getElementById('checkinStatus');
  if (!snap.empty) {
    btn.disabled = true;
    btn.innerHTML = '<span class="icon">✓</span> 本日チェックイン済み';
    status.textContent = '次回のチェックインは明日から可能です';
  }
}

async function loadTodayMembers() {
  const today   = todayStr();
  const container = document.getElementById('todayMembers');
  try {
    const snap = await db.collection('checkins')
      .where('dateStr', '==', today)
      .orderBy('checkedInAt', 'asc')
      .limit(20).get();

    if (snap.empty) {
      container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">まだ来店者がいません</div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const c = doc.data();
      const icon = c.userIcon || (c.userName || '?').charAt(0);
      return `
        <div class="today-member-item">
          <div class="today-member-avatar">${icon}</div>
          <div class="today-member-name">${escHtml(c.userName || '—')}</div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">読み込みエラー</div>';
  }
}

async function loadNotices() {
  const container = document.getElementById('homeNotices');
  try {
    const snap = await db.collection('notices')
      .orderBy('pinned', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(3).get();

    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><p>お知らせはありません</p></div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const n = doc.data();
      return `
        <div class="notice-card ${n.pinned ? 'pinned' : ''}">
          ${n.pinned ? '<span class="badge badge-gold" style="margin-bottom:8px;display:inline-block;">固定</span>' : ''}
          <div class="notice-title">${escHtml(n.title)}</div>
          <div class="notice-body">${escHtml(n.body)}</div>
          <div class="notice-meta">${formatDate(n.createdAt)}</div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>読み込みエラー</p></div>';
  }
}

async function loadHomeEvents() {
  const container = document.getElementById('homeEvents');
  try {
    const today = new Date().toISOString().slice(0, 10);
    const snap  = await db.collection('events')
      .where('isPublic', '==', true)
      .orderBy('date', 'asc')
      .limit(10).get();

    const upcoming = snap.docs.filter(d => (d.data().date || '') >= today);

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>予定されているイベントはありません</p></div>';
      return;
    }
    container.innerHTML = upcoming.slice(0, 3).map(doc => renderEventCard(doc.id, doc.data())).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>読み込みエラー</p></div>';
  }
}

// ========================================
// イベント一覧
// ========================================

async function loadEvents() {
  const container = document.getElementById('eventsList');
  try {
    const snap = await db.collection('events')
      .where('isPublic', '==', true)
      .orderBy('date', 'desc')
      .get();
    allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderEventsList();
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>読み込みエラー</p></div>';
  }
}

function renderEventsList() {
  const container = document.getElementById('eventsList');
  const filtered  = currentFilter === 'all'
    ? allEvents
    : allEvents.filter(e => e.category === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>該当するイベントはありません</p></div>';
    return;
  }
  container.innerHTML = filtered.map(ev => renderEventCard(ev.id, ev)).join('');
}

function filterEvents(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEventsList();
}

function renderEventCard(id, ev) {
  const joined = (ev.participants || []).includes(currentUser?.uid || '');
  const count  = (ev.participants || []).length;

  let month = '', day = '', wd = '';
  if (ev.date) {
    const d = new Date(ev.date + 'T00:00:00');
    month = (d.getMonth() + 1) + '月';
    day   = d.getDate();
    wd    = ['日','月','火','水','木','金','土'][d.getDay()];
  }

  return `
    <div class="event-card ${joined ? 'joined' : ''} fade-in" onclick="openEventModal('${id}')">
      <div class="event-date-col">
        <div class="event-date-month">${month}</div>
        <div class="event-date-day">${day || '—'}</div>
        <div class="event-date-wd">${wd}</div>
      </div>
      <div class="event-info-col">
        <div class="event-card-title">${escHtml(ev.title)}</div>
        <div class="event-card-meta">
          ${ev.startTime ? `<span>${ev.startTime}〜${ev.endTime || ''}</span>` : ''}
          ${ev.fee ? `<span>${ev.fee.toLocaleString()}円</span>` : '<span>無料</span>'}
        </div>
        <div class="event-card-footer">
          <span class="participants-count">👥 ${count}${ev.capacity > 0 ? ' / ' + ev.capacity : ''}名</span>
          <span class="badge ${joined ? 'badge-green' : 'badge-gray'}">${joined ? '参加予定' : '未参加'}</span>
        </div>
      </div>
    </div>`;
}

// ========================================
// イベント詳細モーダル
// ========================================

async function openEventModal(eventId) {
  const ev = allEvents.find(e => e.id === eventId) || {};
  selectedEvent = { id: eventId, ...ev };
  const joined = (ev.participants || []).includes(currentUser.uid);
  const count  = (ev.participants || []).length;

  document.getElementById('eventModalTitle').textContent = ev.title || '';
  document.getElementById('eventModalContent').innerHTML = `
    <div class="divider"></div>
    <div style="margin-bottom:16px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        <span class="badge badge-gray">${categoryLabel(ev.category)}</span>
        ${joined ? '<span class="badge badge-green">参加予定</span>' : ''}
      </div>
      <div class="detail-list">
        ${dRow('開催日', ev.date || '未定')}
        ${dRow('時間', (ev.startTime || '?') + '〜' + (ev.endTime || '?'))}
        ${dRow('参加費', ev.fee ? ev.fee.toLocaleString() + '円' : '無料')}
        ${dRow('参加者', count + (ev.capacity > 0 ? ' / ' + ev.capacity : '') + '名')}
      </div>
    </div>
    ${ev.description ? `<div style="background:var(--bg-card2);border-radius:6px;padding:14px;font-size:13px;line-height:1.8;color:var(--text-sub);white-space:pre-line;margin-bottom:18px;">${escHtml(ev.description)}</div>` : ''}
    <button class="btn ${joined ? 'btn-danger' : 'btn-gold'} btn-block"
            id="joinCancelBtn"
            onclick="toggleJoin('${eventId}', ${joined})">
      ${joined ? '参加キャンセル' : '参加する'}
    </button>
    <div class="section-title" style="margin-top:24px;">管理者からの投稿</div>
    <div id="eventPostsList"><div class="loading"><div class="spinner"></div></div></div>
  `;

  document.getElementById('eventModal').classList.add('open');
  loadEventPosts(eventId);
}

async function loadEventPosts(eventId) {
  const container = document.getElementById('eventPostsList');
  if (!container) return;
  try {
    const snap = await db.collection('events').doc(eventId)
      .collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(20).get();

    if (snap.empty) {
      container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0 4px;">投稿はありません</div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const p = doc.data();
      return `
        <div class="event-post-card">
          <div class="event-post-admin-label">📌 管理者投稿</div>
          <div class="event-post-content">${escHtml(p.content)}</div>
          <div class="event-post-meta">
            <span>${escHtml(p.createdByName || '管理者')}</span>
            <span>${formatDate(p.createdAt)}</span>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);">読み込みエラー</div>';
  }
}

function dRow(label, val) {
  return `<div class="detail-row">
    <span class="label">${escHtml(label)}</span>
    <span class="value" style="font-size:15px;">${escHtml(String(val))}</span>
  </div>`;
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('open');
}

async function toggleJoin(eventId, currentlyJoined) {
  const btn = document.getElementById('joinCancelBtn');
  btn.disabled = true;

  try {
    const ref  = db.collection('events').doc(eventId);
    const ev   = await ref.get();
    const data = ev.data();

    if (currentlyJoined) {
      await ref.update({ participants: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
      await db.collection('users').doc(currentUser.uid).update({
        eventJoinCount: firebase.firestore.FieldValue.increment(-1)
      });
      showToast('参加をキャンセルしました', 'info');
    } else {
      if (data.capacity > 0 && (data.participants || []).length >= data.capacity) {
        showToast('定員に達しています', 'error');
        btn.disabled = false;
        return;
      }
      await ref.update({ participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      await db.collection('users').doc(currentUser.uid).update({
        eventJoinCount: firebase.firestore.FieldValue.increment(1)
      });
      showToast('参加登録しました', 'success');
    }

    closeEventModal();
    await loadUserData();
    loadEvents();
    loadHome();
  } catch (e) {
    showToast('エラー: ' + e.message, 'error');
    btn.disabled = false;
  }
}

// ========================================
// QRチェックイン
// ========================================

function openQRScanner() {
  document.getElementById('qrModal').classList.add('open');
  document.getElementById('qrMessage').style.display = 'none';

  if (qrScanner) { qrScanner.resume(); return; }

  qrScanner = new Html5Qrcode('qr-reader');
  qrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 180, height: 180 } },
    onQRSuccess,
    () => {}
  ).catch(() => {
    showQRMessage('カメラを起動できませんでした。\nブラウザのカメラ許可を確認してください。', 'var(--danger)');
  });
}

async function onQRSuccess(text) {
  if (text !== todayCheckinCode()) {
    showQRMessage('無効なQRコードです', 'var(--danger)');
    return;
  }

  if (qrScanner) qrScanner.pause();

  const today = todayStr();
  const snap  = await db.collection('checkins')
    .where('userId', '==', currentUser.uid)
    .where('dateStr', '==', today)
    .limit(1).get();

  if (!snap.empty) {
    showQRMessage('本日はすでにチェックイン済みです', 'var(--text-muted)');
    return;
  }

  const batch      = db.batch();
  const checkinRef = db.collection('checkins').doc();
  batch.set(checkinRef, {
    userId:      currentUser.uid,
    userName:    currentUserData.name,
    userIcon:    currentUserData.iconUrl || '👤',
    dateStr:     today,
    checkedInAt: firebase.firestore.FieldValue.serverTimestamp(),
    eventId:     '',
    pointsAdded: 10,
    memo:        '通常チェックイン',
  });
  batch.update(db.collection('users').doc(currentUser.uid), {
    checkInCount: firebase.firestore.FieldValue.increment(1),
    points:       firebase.firestore.FieldValue.increment(10),
    totalPoints:  firebase.firestore.FieldValue.increment(10),
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  showQRMessage('チェックイン完了  +10 pt', 'var(--gold)');
  showToast('チェックイン完了！ +10pt 獲得', 'success');
  await checkAndAwardBadges();

  setTimeout(() => {
    closeQRScanner();
    loadUserData().then(() => loadHome());
  }, 2000);
}

function showQRMessage(msg, color) {
  const el = document.getElementById('qrMessage');
  el.textContent = msg;
  el.style.color  = color;
  el.style.background = 'var(--bg-card2)';
  el.style.display = 'block';
}

function closeQRScanner() {
  document.getElementById('qrModal').classList.remove('open');
  if (qrScanner) {
    qrScanner.stop().then(() => {
      qrScanner = null;
      document.getElementById('qr-reader').innerHTML = '';
    }).catch(() => {});
  }
}

// ========================================
// バッジ付与
// ========================================

const BADGES_DEF = [
  { id: 'first_visit',  name: '初来店',      icon: '⭐', condition: d => d.checkInCount >= 1 },
  { id: 'visit_5',      name: '5回来店',      icon: '🌟', condition: d => d.checkInCount >= 5 },
  { id: 'visit_10',     name: '10回来店',     icon: '💎', condition: d => d.checkInCount >= 10 },
  { id: 'visit_30',     name: '30回来店',     icon: '👑', condition: d => d.checkInCount >= 30 },
  { id: 'event_join',   name: 'イベント参加', icon: '🎮', condition: d => d.eventJoinCount >= 1 },
  { id: 'event_5',      name: '5回参加',      icon: '🏆', condition: d => d.eventJoinCount >= 5 },
  { id: 'resistance',   name: 'レジスタンス', icon: '✊', condition: d => d.checkInCount >= 20 },
  { id: 'headquarters', name: '住人',         icon: '🏠', condition: d => d.checkInCount >= 50 },
  { id: 'executive',    name: '幹部候補',     icon: '🗝', condition: d => d.checkInCount >= 30 },
];

async function checkAndAwardBadges() {
  const doc     = await db.collection('users').doc(currentUser.uid).get();
  const data    = doc.data();
  const current = data.badges || [];
  const toAdd   = BADGES_DEF
    .filter(b => !current.includes(b.id) && b.condition(data))
    .map(b => b.id);
  if (toAdd.length > 0) {
    await db.collection('users').doc(currentUser.uid).update({
      badges: firebase.firestore.FieldValue.arrayUnion(...toAdd)
    });
    toAdd.forEach(id => {
      const badge = BADGES_DEF.find(b => b.id === id);
      if (badge) showToast(`バッジ獲得：${badge.name}`, 'success');
    });
  }
}

// ========================================
// チャット
// ========================================

function switchChatRoom(roomId, btn) {
  currentChatRoom = roomId;
  document.querySelectorAll('.chat-room-tabs .tag-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadChat();
}

function loadChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  const container = document.getElementById('chatMessages');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  chatUnsubscribe = db
    .collection('chats')
    .doc(currentChatRoom)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(100)
    .onSnapshot(snap => {
      renderChatMessages(snap.docs);
    }, err => {
      container.innerHTML = '<div class="chat-system-msg">読み込みエラー</div>';
    });
}

function renderChatMessages(docs) {
  const container = document.getElementById('chatMessages');
  const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;

  const visible = docs.filter(d => !d.data().deleted);

  if (visible.length === 0) {
    container.innerHTML = '<div class="chat-system-msg">まだメッセージがありません。最初のメッセージを送ってみましょう！</div>';
    return;
  }

  container.innerHTML = visible.map(doc => {
    const m   = doc.data();
    const own = m.userId === currentUser?.uid;
    const icon = m.userIcon || '👤';
    const canDelete = own || (currentUserData?.role === 'admin');
    const timeStr = m.createdAt ? formatTimeOnly(m.createdAt) : '';

    return `
      <div class="chat-msg ${own ? 'own' : ''}">
        ${!own ? `<div class="chat-avatar">${escHtml(icon)}</div>` : ''}
        <div class="chat-content">
          ${!own ? `<div class="chat-name">${escHtml(m.userName || '—')}</div>` : ''}
          <div class="chat-bubble">${escHtml(m.message)}</div>
          <div class="chat-time-row">
            <span class="chat-time">${timeStr}</span>
            ${canDelete ? `<button class="chat-delete" onclick="deleteChatMessage('${doc.id}')">削除</button>` : ''}
          </div>
        </div>
        ${own ? `<div class="chat-avatar">${escHtml(icon)}</div>` : ''}
      </div>`;
  }).join('');

  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const btn = document.getElementById('chatSendBtn');
  btn.disabled = true;
  input.value = '';
  autoResizeChatInput(input);

  try {
    await db
      .collection('chats')
      .doc(currentChatRoom)
      .collection('messages')
      .add({
        userId:   currentUser.uid,
        userName: currentUserData.name,
        userIcon: currentUserData.iconUrl || '👤',
        message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        deleted: false,
      });
  } catch (e) {
    showToast('送信に失敗しました', 'error');
    input.value = message;
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

async function deleteChatMessage(msgId) {
  if (!confirm('このメッセージを削除しますか？')) return;
  try {
    await db
      .collection('chats')
      .doc(currentChatRoom)
      .collection('messages')
      .doc(msgId)
      .update({ deleted: true });
  } catch (e) {
    showToast('削除に失敗しました', 'error');
  }
}

function chatKeyDown(e) {
  // PC: Enter で送信、Shift+Enter で改行
  if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 600) {
    e.preventDefault();
    sendChatMessage();
  }
}

function autoResizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ========================================
// プロフィール編集
// ========================================

function openEditProfile() {
  selectedIcon = currentUserData?.iconUrl || '👤';

  // アイコンピッカー生成
  const grid = document.getElementById('iconPickerGrid');
  grid.innerHTML = ICON_LIST.map(icon => `
    <div class="icon-opt ${icon === selectedIcon ? 'selected' : ''}"
         onclick="selectIcon('${icon}', this)">${icon}</div>
  `).join('');

  document.getElementById('editName').value = currentUserData?.name || '';
  document.getElementById('editProfileModal').classList.add('open');
}

function selectIcon(icon, el) {
  selectedIcon = icon;
  document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function closeEditProfile() {
  document.getElementById('editProfileModal').classList.remove('open');
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const icon = selectedIcon || '👤';

  if (!name) { showToast('名前を入力してください', 'error'); return; }
  if (name.length > 20) { showToast('名前は20文字以内で入力してください', 'error'); return; }

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.textContent = '保存中…';

  try {
    await db.collection('users').doc(currentUser.uid).update({
      name,
      iconUrl: icon,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    currentUserData.name    = name;
    currentUserData.iconUrl = icon;

    showToast('プロフィールを更新しました', 'success');
    closeEditProfile();
    loadHome();
    loadMyPage();
  } catch (e) {
    showToast('保存に失敗しました', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存する';
  }
}

// ========================================
// マイページ
// ========================================

async function loadMyPage() {
  const doc = await db.collection('users').doc(currentUser.uid).get();
  currentUserData = doc.data();
  const d   = currentUserData;

  document.getElementById('mypageAvatar').textContent   = d.iconUrl || '👤';
  document.getElementById('mypageName').textContent     = d.name;
  document.getElementById('mypageMemberNo').textContent = 'MEMBER #' + (d.memberNumber || '—');

  const rankInfo = calcRank(d.checkInCount || 0);
  document.getElementById('mypageRankRow').innerHTML = `
    <span class="badge badge-gold">${rankInfo.rank}</span>
    <span class="badge badge-gray" style="margin-left:6px;">${d.title || '新参者'}</span>
  `;

  document.getElementById('mypagePoints').textContent      = (d.points || 0).toLocaleString();
  document.getElementById('mypageTotalPoints').textContent = (d.totalPoints || 0).toLocaleString();
  document.getElementById('mypageChips').textContent       = d.chips || 0;
  document.getElementById('mypageCheckins').textContent    = d.checkInCount || 0;
  document.getElementById('mypageEventJoins').textContent  = d.eventJoinCount || 0;

  const earned = d.badges || [];
  document.getElementById('mypageBadges').innerHTML = BADGES_DEF.map(b => `
    <div class="badge-item ${earned.includes(b.id) ? 'earned' : ''}">
      <span class="badge-icon">${b.icon}</span>
      <span class="badge-name">${b.name}</span>
    </div>
  `).join('');

  loadPointLogs();
}

async function loadPointLogs() {
  const container = document.getElementById('mypagePointLogs');
  try {
    const snap = await db.collection('pointLogs')
      .where('userId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(20).get();

    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><p>履歴はありません</p></div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const l    = doc.data();
      const plus = l.amount > 0;
      return `
        <div class="log-row">
          <div>
            <div class="${plus ? 'log-amount-pos' : 'log-amount-neg'}">${plus ? '+' : ''}${l.amount}</div>
            <div class="log-reason">${escHtml(l.reason || '')}</div>
          </div>
          <div class="log-time">${formatDate(l.createdAt)}</div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p>読み込みエラー</p></div>';
  }
}

// ========================================
// ユーティリティ
// ========================================

function formatTimeOnly(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// モーダル外クリックで閉じる
document.getElementById('eventModal').addEventListener('click', function(e) {
  if (e.target === this) closeEventModal();
});
document.getElementById('qrModal').addEventListener('click', function(e) {
  if (e.target === this) closeQRScanner();
});
document.getElementById('editProfileModal').addEventListener('click', function(e) {
  if (e.target === this) closeEditProfile();
});
