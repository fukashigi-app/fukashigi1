// ========================================
// FUKASHIGI APP — メンバー用 JavaScript
// ========================================

let currentUser     = null;
let currentUserData = null;
let allEvents       = [];
let qrScanner       = null;
let selectedEvent   = null;

// カレンダー
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

// チャット
let chatUnsubscribe = null;

// プロフィール編集
let selectedIcon      = null;
let selectedImageFile = null;

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
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (!doc.exists) {
      const data = {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        iconUrl: '',
        bio: '',
        role: 'member',
        points: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('users').doc(currentUser.uid).set(data);
      currentUserData = data;
    } else {
      currentUserData = doc.data();
    }
    // 管理者フラグをセット（自動リダイレクトはしない）
    currentUserData._isAdmin = (currentUserData.role === 'admin' || currentUserData.name === '不可思議');
  } catch (e) {
    console.error('ユーザーデータ読み込みエラー:', e);
  }
}

function doLogout() {
  if (chatUnsubscribe) chatUnsubscribe();
  auth.signOut().then(() => { window.location.href = 'index.html'; });
}

// ========================================
// アバター表示ヘルパー
// ========================================

function setAvatarEl(el, iconUrl) {
  if (!el) return;
  if (iconUrl && /^https?:\/\//.test(iconUrl)) {
    el.innerHTML = `<img src="${escHtml(iconUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  } else {
    el.innerHTML = escHtml(iconUrl || '👤');
  }
}

function avatarContent(iconUrl) {
  if (iconUrl && /^https?:\/\//.test(iconUrl)) {
    return `<img src="${escHtml(iconUrl)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  }
  return escHtml(iconUrl || '👤');
}

// ========================================
// タブ切り替え
// ========================================

function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');

  if (tab === 'mypage') loadMyPage();
  if (tab === 'chat')   loadChat();
  if (tab === 'events') { renderCalendar(); renderDayList(); }
}

// ========================================
// ホーム
// ========================================

function loadHome() {
  if (!currentUserData) return;
  const d = currentUserData;

  document.getElementById('headerUserName').textContent = d.name;
  document.getElementById('homeUserName').textContent   = d.name;
  setAvatarEl(document.getElementById('homeAvatar'), d.iconUrl);

  document.getElementById('statPoints').textContent = (d.points || 0).toLocaleString();

  // 管理者なら管理者ページボタンを表示
  const adminBtn = document.getElementById('adminPageBtn');
  if (adminBtn) adminBtn.style.display = d._isAdmin ? '' : 'none';

  checkTodayCheckIn();
  loadTodayMembers();
  loadNotices();
  loadHomeEvents();
}

async function checkTodayCheckIn() {
  const today = todayStr();
  try {
    const snap = await db.collection('checkins')
      .where('uid', '==', currentUser.uid)
      .where('date', '==', today)
      .limit(1).get();

    const btn    = document.getElementById('checkinBtn');
    const status = document.getElementById('checkinStatus');
    if (!snap.empty) {
      btn.disabled = true;
      btn.innerHTML = '<span class="icon">✓</span> 本日チェックイン済み';
      status.textContent = '次回のチェックインは明日から可能です';
    }
  } catch (e) {
    console.error('チェックイン確認エラー:', e);
  }
}

async function loadTodayMembers() {
  const today     = todayStr();
  const container = document.getElementById('todayMembers');
  try {
    const snap = await db.collection('checkins')
      .where('date', '==', today)
      .limit(20).get();

    if (snap.empty) {
      container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">まだ来店者がいません</div>';
      return;
    }

    const sorted = snap.docs.sort((a, b) => {
      const at = a.data().createdAt?.toMillis?.() || 0;
      const bt = b.data().createdAt?.toMillis?.() || 0;
      return at - bt;
    });

    container.innerHTML = sorted.map(doc => {
      const c = doc.data();
      return `
        <div class="today-member-item">
          <div class="today-member-avatar">${avatarContent(c.userIcon)}</div>
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
    const snap = await db.collection('announcements')
      .orderBy('createdAt', 'desc')
      .limit(5).get();

    if (snap.empty) {
      container.innerHTML = '<div class="empty-state"><p>お知らせはありません</p></div>';
      return;
    }
    container.innerHTML = snap.docs.map(doc => {
      const n = doc.data();
      return `
        <div class="notice-card">
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
      .orderBy('date', 'asc')
      .limit(20).get();

    const upcoming = snap.docs.filter(d => {
      const ev = d.data();
      return ev.isPublic !== false && (ev.date || '') >= today;
    });

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
// イベント一覧（カレンダー＋日別一覧）
// ========================================

async function loadEvents() {
  try {
    const snap = await db.collection('events')
      .orderBy('date', 'asc')
      .get();
    allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    allEvents = [];
  }
  renderCalendar();
  renderDayList();
}

function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
  renderDayList();
}

function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
  renderDayList();
}

function renderCalendar() {
  const label = document.getElementById('calMonthLabel');
  if (label) label.textContent = calYear + '年 ' + (calMonth + 1) + '月';

  const grid = document.getElementById('calGrid');
  if (!grid) return;

  const today = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const eventDays = new Set(
    allEvents
      .filter(ev => {
        if (!ev.date) return false;
        const d = new Date(ev.date + 'T00:00:00');
        return d.getFullYear() === calYear && d.getMonth() === calMonth;
      })
      .map(ev => parseInt(ev.date.split('-')[2]))
  );

  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
    const hasEv   = eventDays.has(d);
    html += `<div class="cal-cell${isToday ? ' today' : ''}${hasEv ? ' has-event' : ''}" onclick="jumpToDay(${d})">${d}${hasEv ? '<span class="cal-dot"></span>' : ''}</div>`;
  }
  grid.innerHTML = html;
}

function jumpToDay(day) {
  const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  const el = document.getElementById('day-' + dateStr);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDayList() {
  const container = document.getElementById('eventsDayList');
  if (!container) return;

  const prefix = calYear + '-' + String(calMonth + 1).padStart(2, '0');
  const monthEvents = allEvents.filter(ev => ev.date && ev.date.startsWith(prefix));

  if (monthEvents.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>この月のイベントはありません</p></div>';
    return;
  }

  const groups = {};
  monthEvents.forEach(ev => {
    const key = ev.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });

  const sortedDates = Object.keys(groups).sort();
  container.innerHTML = sortedDates.map(dateStr => {
    const d   = new Date(dateStr + 'T00:00:00');
    const mon = d.getMonth() + 1;
    const day = d.getDate();
    const wd  = ['日','月','火','水','木','金','土'][d.getDay()];
    const items = groups[dateStr].map(ev => {
      const timePart = ev.time || ev.startTime || '';
      return `
        <div class="day-event-item">
          <div class="day-event-title">・${escHtml(ev.title)}</div>
          ${timePart ? `<div class="day-event-meta">${escHtml(timePart)} 開始</div>` : ''}
          ${ev.description ? `<div class="day-event-desc">${escHtml(ev.description)}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="day-group" id="day-${dateStr}">
        <div class="day-group-header">${mon}月${day}日（${wd}）</div>
        ${items}
      </div>`;
  }).join('');
}

function renderEventCard(id, ev) {
  let month = '', day = '', wd = '';
  if (ev.date) {
    const d = new Date(ev.date + 'T00:00:00');
    month = (d.getMonth() + 1) + '月';
    day   = d.getDate();
    wd    = ['日','月','火','水','木','金','土'][d.getDay()];
  }

  return `
    <div class="event-card fade-in">
      <div class="event-date-col">
        <div class="event-date-month">${month}</div>
        <div class="event-date-day">${day || '—'}</div>
        <div class="event-date-wd">${wd}</div>
      </div>
      <div class="event-info-col">
        <div class="event-card-title">${escHtml(ev.title)}</div>
        <div class="event-card-meta">
          ${ev.time || ev.startTime ? `<span>${escHtml(ev.time || ev.startTime)}</span>` : ''}
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

  document.getElementById('eventModalTitle').textContent = ev.title || '';
  document.getElementById('eventModalContent').innerHTML = `
    <div class="divider"></div>
    <div style="margin-bottom:16px;">
      <div class="detail-list">
        ${dRow('開催日', ev.date || '未定')}
        ${ev.time || ev.startTime ? dRow('時間', ev.time || ev.startTime) : ''}
      </div>
    </div>
    ${ev.description ? `<div style="background:var(--bg-card2);border-radius:6px;padding:14px;font-size:13px;line-height:1.8;color:var(--text-sub);white-space:pre-line;">${escHtml(ev.description)}</div>` : ''}
  `;

  document.getElementById('eventModal').classList.add('open');
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
  try {
    const snap = await db.collection('checkins')
      .where('uid', '==', currentUser.uid)
      .where('date', '==', today)
      .limit(1).get();

    if (!snap.empty) {
      showQRMessage('本日はすでにチェックイン済みです', 'var(--text-muted)');
      return;
    }

    const batch      = db.batch();
    const checkinRef = db.collection('checkins').doc();
    batch.set(checkinRef, {
      uid:      currentUser.uid,
      userName: currentUserData.name,
      userIcon: currentUserData.iconUrl || '👤',
      date:     today,
      points:   10,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(db.collection('users').doc(currentUser.uid), {
      points:    firebase.firestore.FieldValue.increment(10),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    showQRMessage('チェックイン完了  +10 pt', 'var(--gold)');
    showToast('チェックイン完了！ +10pt 獲得', 'success');

    setTimeout(() => {
      closeQRScanner();
      loadUserData().then(() => loadHome());
    }, 2000);
  } catch (e) {
    showQRMessage('エラーが発生しました: ' + e.message, 'var(--danger)');
    if (qrScanner) qrScanner.resume();
  }
}

function showQRMessage(msg, color) {
  const el = document.getElementById('qrMessage');
  el.textContent = msg;
  el.style.color      = color;
  el.style.background = 'var(--bg-card2)';
  el.style.display    = 'block';
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
// チャット
// ========================================

function loadChat() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  // 24時間以内のメッセージのみ取得
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firestoreCutoff = firebase.firestore.Timestamp.fromDate(cutoff);

  chatUnsubscribe = db
    .collection('chats')
    .where('createdAt', '>=', firestoreCutoff)
    .orderBy('createdAt', 'asc')
    .limit(100)
    .onSnapshot(snap => {
      renderChatMessages(snap.docs);
    }, err => {
      const errMsg = err.code === 'permission-denied'
        ? 'チャットの読み込み権限がありません。'
        : '読み込みエラー: ' + err.message;
      container.innerHTML = `<div class="chat-system-msg">${escHtml(errMsg)}</div>`;
    });
}

function renderChatMessages(docs) {
  const container = document.getElementById('chatMessages');
  const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 60;

  if (docs.length === 0) {
    container.innerHTML = '<div class="chat-system-msg">まだメッセージがありません。最初のメッセージを送ってみましょう！</div>';
    return;
  }

  container.innerHTML = docs.map(doc => {
    const m   = doc.data();
    const own = m.uid === currentUser?.uid;
    const iconHtml = avatarContent(m.iconUrl || m.userIcon);
    const canDelete = own || (currentUserData?.role === 'admin');
    const timeStr = m.createdAt ? formatTimeOnly(m.createdAt) : '';
    const nameLabel = escHtml(m.name || '—');

    return `
      <div class="chat-msg ${own ? 'own' : ''}">
        <div class="chat-avatar-col">
          <div class="chat-avatar">${iconHtml}</div>
          <div class="chat-username">${nameLabel}</div>
        </div>
        <div class="chat-content">
          <div class="chat-bubble">${escHtml(m.message)}</div>
          <div class="chat-time-row">
            <span class="chat-time">${timeStr}</span>
            ${canDelete ? `<button class="chat-delete" onclick="deleteChatMessage('${doc.id}')">削除</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendChatMessage() {
  const input   = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message || !currentUser) return;

  const btn = document.getElementById('chatSendBtn');
  btn.disabled = true;
  const savedMsg = input.value;
  input.value = '';
  autoResizeChatInput(input);

  try {
    await db.collection('chats').add({
      uid:      currentUser.uid,
      name:     currentUserData?.name || '名無し',
      iconUrl:  currentUserData?.iconUrl || '',
      message,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    const errMsgs = {
      'permission-denied': '送信権限がありません。ログインし直してください。',
      'unavailable':       'ネットワークエラーが発生しました。接続を確認してください。',
    };
    const code = e.code?.split('/')[1] || '';
    showToast(errMsgs[code] || '送信に失敗しました：' + e.message, 'error');
    input.value = savedMsg;
    autoResizeChatInput(input);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

async function deleteChatMessage(msgId) {
  if (!confirm('このメッセージを削除しますか？')) return;
  try {
    await db.collection('chats').doc(msgId).delete();
  } catch (e) {
    showToast('削除に失敗しました', 'error');
  }
}

function chatKeyDown(e) {
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
  selectedIcon      = currentUserData?.iconUrl || '👤';
  selectedImageFile = null;

  const preview = document.getElementById('profileImagePreview');
  if (preview) {
    if (selectedIcon && /^https?:\/\//.test(selectedIcon)) {
      preview.innerHTML = `<img src="${escHtml(selectedIcon)}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      preview.innerHTML = selectedIcon || '👤';
    }
  }

  const grid = document.getElementById('iconPickerGrid');
  if (grid) {
    const isEmoji = !selectedIcon || !/^https?:\/\//.test(selectedIcon);
    grid.innerHTML = ICON_LIST.map(icon => `
      <div class="icon-opt ${(isEmoji && icon === selectedIcon) ? 'selected' : ''}"
           onclick="selectIcon('${icon}', this)">${icon}</div>
    `).join('');
  }

  document.getElementById('editName').value = currentUserData?.name || '';
  const bioEl = document.getElementById('editBio');
  if (bioEl) bioEl.value = currentUserData?.bio || '';
  document.getElementById('editProfileModal').classList.add('open');
}

function selectIcon(icon, el) {
  selectedIcon      = icon;
  selectedImageFile = null;
  document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const preview = document.getElementById('profileImagePreview');
  if (preview) preview.innerHTML = icon;
}

function handleProfileImageChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('ファイルサイズは5MB以下にしてください', 'error');
    event.target.value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('画像ファイルを選択してください', 'error');
    event.target.value = '';
    return;
  }

  selectedImageFile = file;
  selectedIcon = null;
  document.querySelectorAll('.icon-opt').forEach(o => o.classList.remove('selected'));

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('profileImagePreview');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    }
  };
  reader.readAsDataURL(file);
}

async function uploadProfileImage(file) {
  const storage    = firebase.storage();
  const storageRef = storage.ref(`profile_images/${currentUser.uid}`);
  const snapshot   = await storageRef.put(file);
  return await snapshot.ref.getDownloadURL();
}

function closeEditProfile() {
  document.getElementById('editProfileModal').classList.remove('open');
  selectedImageFile = null;
  const fileInput = document.getElementById('profileImageInput');
  if (fileInput) fileInput.value = '';
}

async function saveProfile() {
  const name  = document.getElementById('editName').value.trim();
  const bioEl = document.getElementById('editBio');
  const bio   = bioEl ? bioEl.value.trim() : '';

  if (!name) { showToast('名前を入力してください', 'error'); return; }
  if (name.length > 20) { showToast('名前は20文字以内で入力してください', 'error'); return; }

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.textContent = '保存中…';

  try {
    let iconUrl = selectedIcon || currentUserData?.iconUrl || '👤';

    if (selectedImageFile) {
      btn.textContent = '画像アップロード中…';
      try {
        iconUrl = await uploadProfileImage(selectedImageFile);
      } catch (uploadErr) {
        const detail = uploadErr.code
          ? `[${uploadErr.code}] ${uploadErr.message}`
          : uploadErr.message || String(uploadErr);
        showToast('プロフィール画像の保存に失敗しました: ' + detail, 'error');
        return;
      }
      btn.textContent = '保存中…';
    }

    const updateData = {
      name,
      iconUrl,
      bio,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await Promise.race([
      db.collection('users').doc(currentUser.uid).update(updateData),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      ),
    ]);

    currentUserData.name    = name;
    currentUserData.iconUrl = iconUrl;
    currentUserData.bio     = bio;
    selectedImageFile = null;

    showToast('プロフィールを更新しました', 'success');
    closeEditProfile();
    loadHome();
    loadMyPage();
  } catch (e) {
    const errMsgs = {
      'permission-denied': '保存権限がありません。ログインし直してください。',
      'unavailable':       'サービスが利用できません。しばらくしてから再試行してください。',
      'TIMEOUT':           '保存がタイムアウトしました。ネットワーク接続を確認してください。',
    };
    const code = e.message === 'TIMEOUT' ? 'TIMEOUT' : (e.code?.split('/')[1] || '');
    showToast(errMsgs[code] || '保存に失敗しました：' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存する';
  }
}

// ========================================
// マイページ
// ========================================

async function loadMyPage() {
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (!doc.exists) return;
    currentUserData = doc.data();
    const d = currentUserData;

    setAvatarEl(document.getElementById('mypageAvatar'), d.iconUrl);
    document.getElementById('mypageName').textContent   = d.name;
    document.getElementById('mypagePoints').textContent = (d.points || 0).toLocaleString();

    const bioWrap = document.getElementById('mypageBioWrap');
    if (bioWrap) {
      const bio = d.bio || '';
      if (bio) {
        bioWrap.textContent   = bio;
        bioWrap.style.display = '';
      } else {
        bioWrap.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('マイページ読み込みエラー:', e);
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
  }, 4000);
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
