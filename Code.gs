/**
 * 환자 수용 요청 — Google Apps Script 웹앱 (서버)
 *
 * 경찰관이 보낸 수용 요청을 참여 병원 전체에 보여주고,
 * 병원의 수용 가능/불가 응답을 경찰관 화면으로 돌려준다.
 * 데이터는 스프레드시트 없이 스크립트 임시 저장소에만 두고 자동 삭제한다.
 * 화면이 꺼진 병원 휴대폰에는 ntfy 앱으로 알린다 (경찰관 브라우저가 ntfy.sh 로 직접 보냄).
 */

const CONFIG = {
  REQUEST_TTL_MIN: 60, // 응답 대기 중인 요청은 60분 후 자동 삭제
  DONE_KEEP_MIN: 10,   // 종료된 요청은 10분 동안 결과만 표시 후 삭제
  TYPES: ['주취자', '정신응급', '일반응급', '외상', '기타'],
  REGIONS: ['서울', '인천', '경기', '기타'],
  STATUSES: ['accept', 'reject', 'call'], // 수용 가능 / 수용 불가 / 전화 확인 필요
  // 화면이 꺼져도 오는 알림: ntfy 앱 (무료, 회원가입 없음). Apps Script 서버는 ntfy.sh 에 접속할 수 없어
  // 경찰관 브라우저가 직접 보낸다. 토픽 이름은 스크립트 속성 NTFY_PREFIX 에 무작위로 만들어 저장한다.
  NTFY_SERVER: 'https://ntfy.sh',
  NTFY_KEEP: 3, // ntfy 앱에 남길 최근 요청 알림 수 (지역별). 더 오래된 알림은 앱에서 자동으로 지워진다.
};

const CACHE_KEY = 'state_v1';
const CODE_CACHE_KEY = 'access_code_v1';
const PREFIX = 'req_';
const CACHE_SEC = 21600; // CacheService 최대 보관 시간(6시간)
const APP_URL_KEY = 'WEBAPP_URL';
const NTFY_PREFIX_KEY = 'NTFY_PREFIX';
const NTFY_SLOT_KEY = 'NTFY_SLOT_'; // + 지역 번호: 다음에 쓸 sequence_id 칸

function doGet() {
  rememberAppUrl_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('환자 수용 요청')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- 화면에서 호출하는 함수 (google.script.run) ---------- */

function getConfig() {
  return { needsCode: !!accessCode_(), types: CONFIG.TYPES, regions: CONFIG.REGIONS };
}

function verifyCode(code) {
  checkCode_(code);
  return true;
}

function createRequest(code, data) {
  checkCode_(code);
  const req = {
    id: newId_(),
    createdAt: Date.now(),
    status: 'open',
    type: pick_(data.type, CONFIG.TYPES),
    region: pick_(data.region, CONFIG.REGIONS),
    condition: clean_(data.condition, 300),
    officer: clean_(data.officer, 40),
    contact: clean_(data.contact, 30),
    responses: {},
  };
  mutate_((state, changed) => {
    state[req.id] = req;
    changed.push(req.id);
  });
  // 경찰관 브라우저가 이 내용을 그대로 ntfy.sh 에 보낸다. 환자 상태 문구는 담지 않는다.
  return Object.assign({}, req, { ntfy: ntfyMessage_(req) });
}

/** 병원 화면의 'ntfy 구독' 안내용: 담당 지역(없으면 전체)의 토픽 목록 */
function ntfyTopics(code, regions) {
  checkCode_(code);
  regions = (regions || []).filter((r) => CONFIG.REGIONS.indexOf(r) >= 0);
  return (regions.length ? regions : CONFIG.REGIONS).map((r) => {
    const topic = ntfyTopic_(r);
    return { region: r, topic: topic, link: 'ntfy://' + CONFIG.NTFY_SERVER.replace(/^https?:\/\//, '') + '/' + topic };
  });
}

function respond(code, id, hospital, status, note) {
  checkCode_(code);
  hospital = clean_(hospital, 40);
  if (!hospital) throw new Error('병원명을 입력하세요.');
  if (CONFIG.STATUSES.indexOf(status) < 0) throw new Error('잘못된 응답입니다.');
  return mutate_((state, changed) => {
    const req = state[id];
    if (!req) throw new Error('이미 종료되었거나 삭제된 요청입니다.');
    if (req.status !== 'open') throw new Error('이미 종료된 요청입니다.');
    req.responses[hospital] = { status: status, note: clean_(note, 100), at: Date.now() };
    changed.push(id);
    return true;
  });
}

/** chosen: 이송할 병원명. 빈 값이면 요청 취소. */
function closeRequest(code, id, chosen) {
  checkCode_(code);
  chosen = clean_(chosen, 40);
  mutate_((state, changed) => {
    const req = state[id];
    if (!req) return;
    req.status = 'done';
    req.chosen = chosen;
    req.doneAt = Date.now();
    changed.push(id);
  });
  return true;
}

/* ---------- ntfy 알림 ---------- */

/** 지역별 토픽: 추측하기 어려운 접두어(처음 쓸 때 무작위 생성) + 지역 번호 */
function ntfyTopic_(region) {
  const props = PropertiesService.getScriptProperties();
  let prefix = props.getProperty(NTFY_PREFIX_KEY);
  if (!prefix) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      prefix = props.getProperty(NTFY_PREFIX_KEY);
      if (!prefix) {
        const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
        prefix = 'par-';
        for (let i = 0; i < 16; i++) prefix += chars[Math.floor(Math.random() * chars.length)];
        props.setProperty(NTFY_PREFIX_KEY, prefix);
      }
    } finally {
      lock.releaseLock();
    }
  }
  return prefix + '-' + (CONFIG.REGIONS.indexOf(region) + 1);
}

function ntfyMessage_(req) {
  const url = appUrl_();
  const msg = {
    topic: ntfyTopic_(req.region),
    title: `수용 요청 — ${req.region} · ${req.type}`, // 🚨 는 tags 로 앞에 붙는다
    // ntfy 의 '계속 울리기'는 ntfy 의 토픽 화면이 열릴 때 멈춘다. click 을 넣으면 알림을 눌러도 웹앱만 열리고
    // 계속 울리므로(2026-10-25 확인) click 은 넣지 않고, 웹앱 주소는 본문에 둔다 (ntfy 화면에서 링크로 눌림).
    message: `요청 ${req.id}. 이 알림을 누르면 알람이 멈춥니다.` + (url ? `\n앱 열기: ${url}` : ''),
    priority: 5,
    tags: ['rotating_light'],
    sequence_id: ntfySlot_(req.region),
  };
  return { server: CONFIG.NTFY_SERVER, body: msg };
}

/**
 * 지역별로 'slot-1' → 'slot-2' → 'slot-3' → 'slot-1' … 을 돌려 쓴다.
 * ntfy 앱은 같은 sequence_id 의 새 알림이 오면 이전 알림을 지우므로 최근 NTFY_KEEP 개만 남는다.
 * (새 알림은 그대로 표시되고 알람도 울린다. ntfy-android Repository.addNotification)
 */
function ntfySlot_(region) {
  const key = NTFY_SLOT_KEY + (CONFIG.REGIONS.indexOf(region) + 1);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty(key)) || 0;
    props.setProperty(key, String((n + 1) % CONFIG.NTFY_KEEP));
    return 'slot-' + (n + 1);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 트리거에서 getUrl()은 편집자 전용 /dev 주소를 돌려줄 수 있으므로,
 * 웹앱으로 접속했을 때의 공개 /exec 주소를 저장해 두고 알림 링크에 쓴다.
 */
function rememberAppUrl_() {
  try {
    const url = ScriptApp.getService().getUrl() || '';
    if (!/\/exec$/.test(url)) return;
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(APP_URL_KEY) !== url) props.setProperty(APP_URL_KEY, url);
  } catch (e) {
    console.error('remember url failed: ' + e);
  }
}

function appUrl_() {
  const saved = PropertiesService.getScriptProperties().getProperty(APP_URL_KEY);
  if (saved) return saved;
  const url = ScriptApp.getService().getUrl() || '';
  return /\/exec$/.test(url) ? url : ''; // /dev 주소는 병원이 열 수 없으므로 넣지 않는다.
}

/**
 * view.role === 'police'   → view.ids 에 해당하는 내 요청 + 모든 병원 응답
 * view.role === 'hospital' → 담당 지역의 요청 + 내 병원 응답과 응답 집계만
 */
function listRequests(code, view) {
  checkCode_(code);
  let state = load_();
  if (needsPrune_(state)) state = mutate_((s) => s);

  const items = Object.keys(state).map((id) => state[id]);
  let result;
  if (view.role === 'police') {
    const mine = view.ids || [];
    result = items.filter((r) => mine.indexOf(r.id) >= 0);
  } else {
    const regions = view.regions || [];
    const me = clean_(view.name, 40);
    result = items
      .filter((r) => !regions.length || regions.indexOf(r.region) >= 0)
      .map((r) => {
        const counts = { accept: 0, reject: 0, call: 0 };
        Object.keys(r.responses).forEach((h) => counts[r.responses[h].status]++);
        const copy = Object.assign({}, r, { responses: undefined, counts: counts, mine: r.responses[me] || null });
        // 다른 병원으로 이송이 결정된 경우 병원명은 감춘다.
        if (r.status === 'done') copy.chosenIsMe = !!r.chosen && r.chosen === me;
        delete copy.chosen;
        return copy;
      });
  }
  result.sort((a, b) => b.createdAt - a.createdAt);
  return { now: Date.now(), items: result };
}

/* ---------- 내부 함수 ---------- */

function accessCode_() {
  const cache = CacheService.getScriptCache();
  let code = cache.get(CODE_CACHE_KEY);
  if (code === null) {
    code = PropertiesService.getScriptProperties().getProperty('ACCESS_CODE') || '';
    cache.put(CODE_CACHE_KEY, code, 600);
  }
  return code;
}

function checkCode_(code) {
  const expected = accessCode_();
  if (expected && String(code || '') !== expected) throw new Error('접속 코드가 올바르지 않습니다.');
}

function load_() {
  const json = CacheService.getScriptCache().get(CACHE_KEY);
  if (json) return JSON.parse(json);
  // 캐시가 비었을 때만 보관본에서 다시 읽는다 (읽기 할당량 절약).
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return loadFromProps_();
  } finally {
    lock.releaseLock();
  }
}

function loadFromProps_() {
  const cache = CacheService.getScriptCache();
  const json = cache.get(CACHE_KEY);
  if (json) return JSON.parse(json);
  const props = PropertiesService.getScriptProperties().getProperties();
  const state = {};
  Object.keys(props).forEach((k) => {
    if (k.indexOf(PREFIX) === 0) state[k.slice(PREFIX.length)] = JSON.parse(props[k]);
  });
  putCache_(state);
  return state;
}

function putCache_(state) {
  try {
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(state), CACHE_SEC);
  } catch (e) {
    // 100KB 초과 등으로 실패하면 다음 읽기에서 보관본을 사용한다.
    CacheService.getScriptCache().remove(CACHE_KEY);
  }
}

function mutate_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const state = loadFromProps_();
    const changed = prune_(state);
    const result = fn(state, changed);
    if (changed.length) {
      const props = PropertiesService.getScriptProperties();
      changed.forEach((id) => {
        if (state[id]) props.setProperty(PREFIX + id, JSON.stringify(state[id]));
        else props.deleteProperty(PREFIX + id);
      });
      putCache_(state);
    }
    return result === undefined ? state : result;
  } finally {
    lock.releaseLock();
  }
}

function isExpired_(req, now) {
  if (req.status === 'open') return now - req.createdAt > CONFIG.REQUEST_TTL_MIN * 60000;
  return now - req.doneAt > CONFIG.DONE_KEEP_MIN * 60000;
}

function needsPrune_(state) {
  const now = Date.now();
  return Object.keys(state).some((id) => isExpired_(state[id], now));
}

function prune_(state) {
  const now = Date.now();
  const removed = [];
  Object.keys(state).forEach((id) => {
    if (isExpired_(state[id], now)) {
      delete state[id];
      removed.push(id);
    }
  });
  return removed;
}

function newId_() {
  const t = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HHmm');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 3; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return t + '-' + s;
}

function clean_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function pick_(v, list) {
  return list.indexOf(v) >= 0 ? v : list[list.length - 1];
}

/** 모든 요청을 즉시 삭제 (편집기에서 수동 실행용) */
function clearAll() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    Object.keys(props.getProperties()).forEach((k) => {
      if (k.indexOf(PREFIX) === 0) props.deleteProperty(k);
    });
    CacheService.getScriptCache().remove(CACHE_KEY);
  } finally {
    lock.releaseLock();
  }
}
