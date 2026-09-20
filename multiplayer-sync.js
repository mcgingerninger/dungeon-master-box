// ===================== MULTIPLAYER SYNC (WebSocket) — PHASE 6c =====================
// Self-contained add-on for dungeon_loot_wheel: a launch-time role gate, role-based tab
// restrictions, and realtime sync of a player's full save-state against the local
// dungeon-master-box server (server/websocket.js) over a WebSocket connection. Everything
// multiplayer-related lives in this one file — the main app file only needs two small named
// hook additions (see the comment above its <script type="module" src="multiplayer-sync.js">
// tag): window.onMultiplayerStateChange and window.applyRemoteMultiplayerState. Both are checked
// with `typeof x === 'function'` before being called, so if this file is ever removed, the main
// app keeps working exactly as it does today — nothing in it depends on this file existing.
//
// This is a full rewrite of the Firebase/Firestore version of this file (see git history and
// docs/ARCHITECTURE.md's Phase 5 sections for the original design and the audit that preceded
// this rewrite). What changed and why:
//
// ---- Identity model: room code + display name, no accounts (confirmed with the user) ----
// The original used real Firebase Email/Password accounts (a username/password disguised as a
// synthetic email) so a player could log back into the SAME character from any device. That's
// gone. Instead: a DM creates a campaign and gets a short shareable code (server/database.js's
// createCampaign — Phase 6b); a player types that code plus a display name; nobody types a
// password anywhere. The WebSocket `identify` message already accepted this exact shape
// unmodified since Phase 5a (accountUid/role/username, no credential) — see server/websocket.js's
// own documented "no identity verification" gap, a trust model this file inherits rather than
// changes. A DM's own identity is just an `identify` claiming role:'dm'; nothing server-side
// tracks who "really" owns a campaign, matching the low-stakes, in-person-play trust level the
// user confirmed is acceptable here (same spirit as loot claims trusting a self-reported uid).
//
// A per-BROWSER random id (`getOrCreateDeviceUid`, persisted in localStorage) stands in for the
// old Firebase uid — this is what makes a returning player's character persist across reloads
// (player_states is keyed by (campaignId, accountUid), so reconnecting with the same device uid
// resumes the same character). Deliberate, documented simplification: because this id lives in
// localStorage (shared across every tab of one browser, not sessionStorage), running the DM role
// and a player role SIMULTANEOUSLY in two tabs of the SAME browser is no longer supported — both
// tabs would share one accountUid, and server/websocket.js's `rooms` map is keyed by accountUid
// per campaign, so the second tab's identify would silently displace the first's connection entry
// for that campaign. The original supported this via real, distinct per-account logins in
// sessionStorage. Trade-off accepted deliberately: a returning player's character surviving a
// closed tab/browser restart (the common case) is worth more than same-browser dual-role testing
// (workaround: use a second browser or a private window, which gets its own localStorage).
//
// ---- Sync engine: WebSocket instead of Firestore onSnapshot ----
// The old rev/extRev two-counter scheme existed entirely to filter Firestore's own habit of
// echoing a client's writes back to it. A WebSocket server is stateful and simply never sends a
// state_update back to the connection that caused it (see server/websocket.js's module comment) —
// self-echo isn't a problem here by construction, so startPlayerListener's replacement below
// applies every incoming state_update unconditionally, no counter comparison needed. `rev` is
// still sent with every push_state (guards a narrower problem that doesn't go away: two rapid
// pushes from the SAME client arriving out of order over the network — see the server's own
// staleness check), but this file no longer needs to reason about it beyond incrementing it.
//
// ---- sanitizeNestedArrays/unsanitizeNestedArrays: gone, not needed anymore ----
// That machinery existed solely because Firestore rejects a document field that's an
// array-of-arrays, and rejects `undefined` outright. The new backend stores state as a plain JSON
// text blob (`JSON.stringify` in db/database.js's savePlayerState/saveSubsystemState) — nested
// arrays serialize fine, and JSON.stringify already drops `undefined` object properties on its
// own. Removed entirely rather than carried forward as dead weight.
//
// ---- What's deliberately NOT wired up yet (see docs/ARCHITECTURE.md) ----
// Phases 6e (viewed-player spectator listener), 6f (player removal), and 6d (real-time gambling
// sync) — the three gaps the original Phase 5 audit missed — are all implemented below, each
// against its own scoped server/websocket.js addition, confirmed with the user before being
// built (same discipline as Phase 5's a-d breakdown). window.resolveGamblingActionRemote is the
// one gambling hook deliberately left undefined (guarded with `typeof x === 'function'` at its
// one call site in the monolith, same as every other optional hook here) — see the "Real-time
// gambling sync" section below for why.

// ---------- Config ----------
// The app is served BY the same server it talks to (Phase 6a's static file serving) — so the
// browser's own origin already IS the server's address, no separate config needed.
const API_BASE = window.location.origin;
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

const DEVICE_UID_KEY = 'dmbox_device_uid';
const SESSION_KEY = 'dmbox_session'; // { role, campaignId, code, username }

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
}
function getOrCreateDeviceUid() {
  let uid = localStorage.getItem(DEVICE_UID_KEY);
  if (!uid) { uid = 'p_' + generateId(); localStorage.setItem(DEVICE_UID_KEY, uid); }
  return uid;
}
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// All multiplayer session state lives here, not scattered across module-level variables.
const mp = {
  uid: null,
  username: null,
  role: null, // 'dm' | 'player'
  campaignId: null,
  code: null,
  connected: false,
  // Guards the save->sync->apply->(would-be-save-again) loop: while a remote update is being
  // applied to local state, the save hook skips pushing back up.
  applyingRemote: false,
  ws: null,
  kicked: false, // set true if the connection is forcibly closed by the server (future: Phase 6f kick)
  pushRev: 0,
  roster: new Map(), // uid -> { username, currentHp, maxHp, ac } — DM-only, for the account panel
};

// ---------- Local state cache (unchanged bridge with the main file) ----------
function refreshLocalStateCache() {
  if (typeof window.saveAppState === 'function') window.saveAppState();
}
let _latestLocalState = null;
function collectCurrentAppState() { return _latestLocalState; }

window.onMultiplayerStateChange = function (data) {
  _latestLocalState = data;
  if (!mp.connected || mp.applyingRemote || mp.kicked) return;
  pushOwnState(data);
};

// ---------- WebSocket transport ----------
// Raw WebSocket has no built-in request/response correlation the way a Firestore promise did —
// this is the one genuinely new piece of client-side machinery this rewrite needed. A pending
// waiter is a predicate over incoming messages plus a resolve function; the first message after
// registration that satisfies the predicate resolves it and is removed. Predicates correlate on
// whatever field a given response actually carries (rev for push acks, targetUid for cross-write
// acks, claimId for loot claims) so that two of the same kind of request in flight don't resolve
// each other's waiter — not perfect distributed request tracking, but this is a single DM's local
// console talking to their own server, not a high-concurrency system.
let pendingWaiters = [];
function waitForNext(predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const entry = {
      predicate,
      resolve: (msg) => { clearTimeout(timer); resolve(msg); },
    };
    const timer = setTimeout(() => {
      pendingWaiters = pendingWaiters.filter((w) => w !== entry);
      reject(new Error('Timed out waiting for a server response.'));
    }, timeoutMs);
    pendingWaiters.push(entry);
  });
}
function dispatchToWaiters(msg) {
  const idx = pendingWaiters.findIndex((w) => w.predicate(msg));
  if (idx === -1) return;
  const [entry] = pendingWaiters.splice(idx, 1);
  entry.resolve(msg);
}
function send(msg) {
  if (mp.ws && mp.ws.readyState === WebSocket.OPEN) mp.ws.send(JSON.stringify(msg));
}

let _reconnectTimer = null;
let _reconnectDelayMs = 1000;
function connectWebSocket() {
  const ws = new WebSocket(WS_URL);
  mp.ws = ws;
  ws.addEventListener('open', () => {
    _reconnectDelayMs = 1000;
    send({ type: 'identify', campaignId: mp.campaignId, accountUid: mp.uid, role: mp.role, username: mp.username });
  });
  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleServerMessage(msg);
    dispatchToWaiters(msg);
  });
  ws.addEventListener('close', () => {
    mp.connected = false;
    if (mp.kicked) return; // an explicit logout/kick — don't reconnect
    // Belt-and-suspenders reconnect for a dropped LAN connection (wifi hiccup, server restart) —
    // the WebSocket protocol itself has no opinion on this; a real usable app needs it regardless.
    // Capped backoff, not exponential-forever: this is a DM's own LAN, outages are short.
    //
    // Found during real testing: setGateStatus alone is invisible whenever the gate overlay
    // itself is closed — which is exactly the normal case once someone's actually playing. A
    // dropped connection mid-session (or a failed initial reconnect on page load) was silently
    // retrying in the background with zero on-screen indication either way. showConnBanner is a
    // small persistent element outside the gate, visible regardless of what tab/screen is active.
    showConnBanner('Connection lost — reconnecting…', true);
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(() => {
      _reconnectDelayMs = Math.min(_reconnectDelayMs * 1.5, 10000);
      connectWebSocket();
    }, _reconnectDelayMs);
  });
  ws.addEventListener('error', () => { /* the close handler above does the real work */ });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'identified': return handleIdentified(msg);
    case 'state_update':
      mp.applyingRemote = true;
      try { if (typeof window.applyRemoteMultiplayerState === 'function') window.applyRemoteMultiplayerState(msg.state); }
      finally { mp.applyingRemote = false; }
      return;
    case 'battlefield_update':
      if (typeof window.applyRemoteBattlefieldState === 'function') window.applyRemoteBattlefieldState(msg.battleRoster || [], msg.battleLog || []);
      return;
    case 'puzzle_log_update':
      if (typeof window.applyRemotePuzzleLog === 'function') window.applyRemotePuzzleLog(msg.puzzleLog || []);
      return;
    case 'roster_update':
      mp.roster.clear();
      (msg.roster || []).forEach((p) => mp.roster.set(p.uid, p));
      renderAccountPanel();
      if (typeof window.onConnectedPlayersChanged === 'function') {
        window.onConnectedPlayersChanged([...mp.roster.entries()].map(([uid, p]) => ({ uid, ...p })));
      }
      return;
    case 'attack_request_list':
      if (typeof window.applyIncomingAttackRequests === 'function') window.applyIncomingAttackRequests(msg.requests || []);
      return;
    case 'loot_claim_update':
      // Sent to the DM's own connection when a PLAYER wins a claim (the DM claiming on someone's
      // behalf is acked via loot_claim_result to the DM directly instead — see dmGiveLootItem).
      if (typeof window.markLootClaimOnRoster === 'function') window.markLootClaimOnRoster(msg.claimId, { claimedByUid: msg.claimedByUid, claimedByUsername: msg.claimedByUsername });
      return;
    case 'player_state_update':
      if (typeof window.applyViewedPlayerState === 'function') window.applyViewedPlayerState(msg.targetUid, msg.state || null);
      return;
    case 'gambling_state_update':
      if (typeof window.applyRemoteGamblingState === 'function') window.applyRemoteGamblingState(msg.state);
      return;
    case 'gambling_action_list':
      if (typeof window.applyIncomingGamblingActions === 'function') window.applyIncomingGamblingActions(msg.actions || []);
      return;
    case 'merchant_stock_update':
      if (typeof window.applyMerchantStockSync === 'function') window.applyMerchantStockSync(msg.merchantKey, msg.remaining || []);
      return;
    case 'merchant_stock_full':
      if (typeof window.applyMerchantStockSync === 'function') {
        Object.entries(msg.stock || {}).forEach(([merchantKey, remaining]) => window.applyMerchantStockSync(merchantKey, remaining));
      }
      return;
    // Sent to every PLAYER (never echoed back to the DM who triggered it — see simulateADay's
    // own comment for why) once the DM's simulate_day lands server-side. Each player's own
    // character long-rest arrives separately via the ordinary state_update path below (the
    // server already mutated their persisted state directly); this is only the signal for the
    // one piece with no shared catalog to push — daily wares reroll locally per account.
    case 'day_advanced':
      if (typeof window.onDayAdvanced === 'function') window.onDayAdvanced();
      return;
    case 'kicked':
      resetLocalSessionState();
      clearSession();
      showGate();
      setGateStatus('You were removed from this campaign by the DM.', true);
      return;
    case 'error':
      // A real bug found in testing: a saved session pointing at a campaign that no longer
      // exists (e.g. the database was reset) gets a fatal 'error' back from `identify` — and
      // nothing else will ever arrive on this dead connection. Only handled here if we never
      // actually got through identify (mp.connected still false); an 'error' arriving on an
      // otherwise-healthy connection (a failed cross-write, a rejected claim, etc.) is already
      // handled by whichever specific action is awaiting it via waitForNext, not here. Without
      // this, the gate stays hidden forever with no way back in short of manually clearing
      // localStorage — exactly what looked like "the login screen is just gone."
      if (!mp.connected) {
        mp.kicked = true; // suppress the close handler's auto-reconnect for this dead session
        if (mp.ws) { try { mp.ws.close(); } catch { /* already closing */ } }
        clearSession();
        showGate();
        setGateStatus(msg.message || 'Could not reconnect to your saved campaign — please rejoin.', true);
      }
      return;
    default:
      return; // push_ack/push_rejected/cross_write_ack/loot_claim_result etc. are consumed by waitForNext, not here
  }
}

// A brand-new player's very first identify gets `state: null` back — this browser's current
// local state could be anything (leftover solo play, a different campaign's data) and must not
// leak into a fresh character, same reasoning connectAsRole's blank-state seeding used to apply.
// A DM never gets this treatment: nothing about their combat/roster work depends on a character
// sheet, and prompting them for one would just be noise on first login.
async function handleIdentified(msg) {
  mp.connected = true;
  mp.pushRev = typeof msg.rev === 'number' ? msg.rev : 0;
  hideConnBanner();
  hideGate();
  enforceRoleRestrictions(mp.role);
  renderAccountPanel();
  updatePlayerNameDisplay();
  if (msg.state) {
    mp.applyingRemote = true;
    try { if (typeof window.applyRemoteMultiplayerState === 'function') window.applyRemoteMultiplayerState(msg.state); }
    finally { mp.applyingRemote = false; }
    return;
  }
  if (mp.role !== 'player') return;
  const blankState = {
    ...collectCurrentAppState(),
    inventoryGrid: typeof window.buildBlankInventoryGrid === 'function' ? window.buildBlankInventoryGrid() : [],
    inventoryPlacements: {}, inventoryPlacementCounter: 0,
    savedGeneratedItems: [], playerSlots: {}, recentlyLooted: [],
    characterAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    characterLevel: 1, skillProficiencies: [], saveProficiencies: [],
    characterCurrentHp: 10, characterMaxHp: 10, characterMaxHpEffective: 10, characterHitDice: '', characterAc: 10, characterClass: '',
  };
  await pushOwnState(blankState);
  if (typeof window.promptFirstTimeCharacterSetup === 'function') window.promptFirstTimeCharacterSetup();
}

// ---------- Core state push ----------
// Returns true/false so callers that need to know whether this specific write landed (the
// brand-new-player seed push above) can react to a failure instead of assuming success.
async function pushOwnState(stateOverride) {
  if (!mp.connected || mp.kicked) return false;
  const data = stateOverride || collectCurrentAppState();
  if (!data) return false;
  const rev = ++mp.pushRev;
  send({ type: 'push_state', rev, state: data });
  try {
    const ack = await waitForNext((m) => (m.type === 'push_ack' || m.type === 'push_rejected') && m.rev === rev);
    return ack.type === 'push_ack';
  } catch {
    return false;
  }
}

// ---------- Cross-player writes (DM -> any player in their room) ----------
function applyHpDelta(targetUid, delta) {
  send({ type: 'hp_delta', targetUid, delta }); // fire-and-forget, matching the original's own bridge
}
function applyInitiativeDelta(targetUid, delta) {
  send({ type: 'initiative_delta', targetUid, delta }); // fire-and-forget, same as applyHpDelta
}
function applySpeedDelta(targetUid, delta) {
  send({ type: 'speed_delta', targetUid, delta }); // fire-and-forget, same as applyHpDelta
}
function crossWrite(type, targetUid, extra) {
  send({ type, targetUid, ...extra });
  return waitForNext((m) => (m.type === 'cross_write_ack' && m.targetUid === targetUid) || m.type === 'error')
    .then((m) => { if (m.type === 'error') throw new Error(m.message); return m; });
}
function giftItemToPlayer(targetUid, item) {
  return crossWrite('gift_item', targetUid, { item }).catch((err) => {
    console.error('[multiplayer-sync] giftItemToPlayer failed:', err);
    throw err;
  });
}
function setPlayerInventoryFields(targetUid, fields) {
  return crossWrite('set_inventory_fields', targetUid, { fields }).catch((err) => {
    console.error('[multiplayer-sync] setPlayerInventoryFields failed:', err);
    throw err;
  });
}
function applyItemEffectToPlayer(targetUid, item) {
  return crossWrite('apply_item_effect', targetUid, { item }).catch((err) => {
    console.error('[multiplayer-sync] applyItemEffectToPlayer failed:', err);
    throw err;
  });
}
function applyTrapEffectToPlayer(targetUid, trap, saved) {
  return crossWrite('apply_trap_effect', targetUid, { trap, saved }).catch((err) => {
    console.error('[multiplayer-sync] applyTrapEffectToPlayer failed:', err);
    throw err;
  });
}
function toggleUnlockAchieved(targetUid, itemKey, tierIndex) {
  return crossWrite('toggle_unlock_achieved', targetUid, { itemKey, tierIndex }).catch((err) => {
    console.error('[multiplayer-sync] toggleUnlockAchieved failed:', err);
    throw err;
  });
}
window.applyHpDeltaToPlayer = function (targetUid, delta) {
  if (!mp.connected) return;
  applyHpDelta(targetUid, delta);
};
window.applyInitiativeDeltaToPlayer = function (targetUid, delta) {
  if (!mp.connected) return;
  applyInitiativeDelta(targetUid, delta);
};
window.applySpeedDeltaToPlayer = function (targetUid, delta) {
  if (!mp.connected) return;
  applySpeedDelta(targetUid, delta);
};
window.giftArbitraryItemToPlayer = function (targetUid, item) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return giftItemToPlayer(targetUid, item);
};
window.applyItemEffectToPlayerUid = function (targetUid, item) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return applyItemEffectToPlayer(targetUid, item);
};
window.applyTrapEffectToPlayerUid = function (targetUid, trap, saved) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return applyTrapEffectToPlayer(targetUid, trap, saved);
};
window.dmSetPlayerInventoryFields = function (targetUid, fields) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return setPlayerInventoryFields(targetUid, fields);
};
window.toggleUnlockAchievedForPlayer = function (targetUid, itemKey, tierIndex) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return toggleUnlockAchieved(targetUid, itemKey, tierIndex);
};

// ---------- Real-time looting: loot claims (first-write-wins, arbitrated server-side) ----------
function createLootClaim(claimId, claimedByUid, claimedByUsername) {
  send({ type: 'create_loot_claim', claimId, claimedByUid, claimedByUsername });
  return waitForNext((m) => (m.type === 'loot_claim_result' && m.claimId === claimId) || m.type === 'error');
}
// Player's own self-loot button (also reused for the DM taking an item for themselves — see the
// main file's claimThenConsumeLootItem): resolves if this account won the race, REJECTS if
// someone else already claimed it — callers rely on exactly this .then()/.catch() split (see
// playerLootItem/claimThenConsumeLootItem in the monolith).
window.createSelfLootClaim = function (monsterUid, itemId) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  return createLootClaim(`${monsterUid}_${itemId}`, mp.uid, mp.username).then((msg) => {
    if (msg.type === 'error') throw new Error(msg.message);
    if (!msg.won) throw new Error('Someone already claimed this item.');
    return msg;
  });
};
window.getMultiplayerSelf = function () {
  return mp.connected ? { uid: mp.uid, username: mp.username, role: mp.role } : null;
};
// DM's "give to..." action: claims on the chosen player's behalf, then delivers the actual item.
// err.giftStage distinguishes which half failed ("claim" — someone already has it, a real
// conflict; "deliver" — the claim succeeded but the item write itself failed, meaning the claim
// now permanently exists but nobody actually has the item) — the DM's UI needs these to read very
// differently, same as the original.
window.dmGiveLootItem = async function (monsterUid, itemId, targetUid, targetUsername, itemData) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  if (mp.role !== 'dm') return Promise.reject(new Error('Only the DM can give items.'));
  const msg = await createLootClaim(`${monsterUid}_${itemId}`, targetUid, targetUsername);
  if (msg.type === 'error') { const err = new Error(msg.message); err.giftStage = 'claim'; throw err; }
  if (!msg.won) { const err = new Error('Someone already claimed this item.'); err.giftStage = 'claim'; throw err; }
  try {
    return await giftItemToPlayer(targetUid, itemData);
  } catch (err) {
    if (!err.giftStage) err.giftStage = 'deliver';
    throw err;
  }
};

// ---------- Battlefield attacks (player -> DM review) ----------
window.submitBattlefieldAttack = function (attack) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  send({ type: 'submit_attack_request', attack });
  return waitForNext((m) => m.type === 'attack_request_submitted' || m.type === 'error').then((m) => {
    if (m.type === 'error') throw new Error(m.message);
  });
};
window.resolveAttackRequest = function (reqId) {
  if (!mp.connected) return Promise.reject(new Error('Not connected'));
  send({ type: 'resolve_attack_request', requestId: reqId });
  return waitForNext((m) => (m.type === 'attack_request_resolved' && m.requestId === reqId) || m.type === 'error').then((m) => {
    if (m.type === 'error') throw new Error(m.message);
  });
};

// ---------- Battlefield / Puzzle Log (DM-only push, shared read) ----------
// Client-side debounce kept even though the server-side write-frequency reasoning (Firestore
// billing per write) no longer applies — rollAllBattleAttacks and similar bursts can still call
// this many times in a row, and there's no reason to flood the WebSocket connection with
// redundant sends just because the per-write cost happens to be zero now.
let _battlefieldPushTimer = null;
window.pushBattlefieldState = function (battleRoster, battleLog) {
  if (!mp.connected || mp.role !== 'dm') return;
  clearTimeout(_battlefieldPushTimer);
  _battlefieldPushTimer = setTimeout(() => {
    send({ type: 'push_battlefield', battleRoster, battleLog });
  }, 400);
};
let _puzzleLogPushTimer = null;
window.pushPuzzleLogState = function (puzzleLog) {
  if (!mp.connected || mp.role !== 'dm') return;
  clearTimeout(_puzzleLogPushTimer);
  _puzzleLogPushTimer = setTimeout(() => {
    send({ type: 'push_puzzle_log', puzzleLog });
  }, 400);
};

// ---------- Real-time gambling sync (Phase 6d) ----------
// Mirrors the Battlefield/Puzzle Log push pattern above (DM-owned state, broadcast to players),
// plus one extra path battlefield/puzzle-log don't need: a PLAYER's own action has to reach the
// DM's client to actually be applied, since the DM's browser is the one running the dealer logic
// (see the monolith's own GAMBLING comment — "the DM is always the dealer/host"). No debounce
// here, unlike battlefield/puzzle-log: those get called in tight loops (rollAllBattleAttacks);
// gambling pushes happen once per hosted table change or per resolved action, not bursty enough
// to need one.
window.pushGamblingState = function (state) {
  if (!mp.connected || mp.role !== 'dm') return; // no-op for anyone but the connected DM, matching the monolith's own comment on this bridge
  send({ type: 'push_gambling_state', state });
};
window.submitGamblingActionRemote = function (action) {
  if (!mp.connected) return;
  send({ type: 'submit_gambling_action', action });
};
// window.resolveGamblingActionRemote is deliberately NOT defined — see server/websocket.js's
// module comment on submit_gambling_action for why there's nothing server-side to resolve
// (actions aren't persisted in a queue the way attack requests are). The monolith's own call
// site already guards this with `typeof window.resolveGamblingActionRemote === 'function'`, so
// leaving it undefined is a real, working no-op, not a bug.

// ---------- Store purchase sync ----------
// Unlike gambling (DM-authored table, players only ever submit actions for the DM to apply),
// buying a staple is a genuine shared race — two players could go for the last unit at once — so
// this needs real server-side arbitration, the same shape loot claims already use, not a
// DM-relay. window.buyStapleRemote resolves to { bought } once the server has actually decided;
// the caller (buyStapleItem in the monolith) only proceeds with spending gold/placing the item
// if bought is true. Daily wares are deliberately NOT synced here at all — see
// server/websocket.js's own module comment on buy_staple for why syncing them would be
// meaningless (each account rolls its own random daily items, no shared catalog to arbitrate).
function buyStaple(merchantKey, index, maxStock) {
  send({ type: 'buy_staple', merchantKey, index, maxStock });
  return waitForNext((m) => (m.type === 'buy_staple_result' && m.merchantKey === merchantKey && m.index === index) || m.type === 'error');
}
window.buyStapleRemote = function (merchantKey, index, maxStock) {
  if (!mp.connected) return Promise.resolve({ bought: null }); // null = "not connected", distinct from a real false
  return buyStaple(merchantKey, index, maxStock).then((m) => {
    if (m.type === 'error') throw new Error(m.message);
    return { bought: m.bought };
  });
};
window.restockMerchantRemote = function (merchantKey, maxStock) {
  if (!mp.connected || mp.role !== 'dm') return; // fire-and-forget, matching pushGamblingState's own no-op-unless-DM shape
  send({ type: 'restock_merchant', merchantKey, maxStock });
};
// Fire-and-forget, same shape as restockMerchantRemote — the DM's own client already applied the
// long rest + restock locally (simulateADay), this just asks the server to do the same long-rest
// transform to every OTHER player's persisted state and tell them to reroll their own daily wares.
window.simulateDayRemote = function () {
  if (!mp.connected || mp.role !== 'dm') return;
  send({ type: 'simulate_day' });
};

// ---------- Viewed-player spectator listener (Phase 6e, DM-only) ----------
// A live, read-only view of ONE specific player's full state, for the Players tab — separate
// from the roster (which only ever extracts a thin HP/AC summary for every player at once).
// Only ever one of these active at a time: selecting a different player re-subscribes rather
// than stacking (see selectViewedPlayer in the monolith), matching the original exactly.
let viewingUid = null;
window.startViewedPlayerListener = function (targetUid) {
  if (!mp.connected || mp.role !== 'dm') return;
  viewingUid = targetUid;
  send({ type: 'subscribe_player', targetUid });
};
window.stopViewedPlayerListener = function () {
  if (mp.connected && viewingUid) send({ type: 'unsubscribe_player' });
  viewingUid = null;
};

// ---------- Player removal (Phase 6f, DM-only) ----------
function kickPlayer(targetUid) {
  send({ type: 'kick_player', targetUid });
  return waitForNext((m) => (m.type === 'kick_ack' && m.targetUid === targetUid) || m.type === 'error').then((m) => {
    if (m.type === 'error') throw new Error(m.message);
  });
}
// Bulk version for the Players tab's "Remove All Players" action. Returns the count ACTUALLY
// removed (Promise.allSettled, not Promise.all) so one failed removal doesn't hide whether the
// others succeeded — matching the original removeAllPlayers's own "count actually removed, not
// count attempted" guarantee.
window.removeAllPlayers = async function () {
  if (!mp.connected || mp.role !== 'dm') return 0;
  const uids = [...mp.roster.keys()];
  const results = await Promise.allSettled(uids.map((uid) => kickPlayer(uid)));
  return results.filter((r) => r.status === 'fulfilled').length;
};

// ===================== ROLE-BASED TAB RESTRICTIONS (unchanged from the original) =====================
function updatePlayerNameDisplay() {
  const wrap = document.getElementById('invPlayerNameWrap');
  const val = document.getElementById('invPlayerName');
  if (!wrap || !val) return;
  if (mp.connected && mp.username) { val.textContent = mp.username; wrap.style.display = ''; }
  else { wrap.style.display = 'none'; }
}
function enforceRoleRestrictions(role) {
  document.body.classList.toggle('role-player', role === 'player');
  const battlefieldBtn = document.getElementById('battlefieldTabBtn');
  if (battlefieldBtn) battlefieldBtn.style.display = role === 'player' ? '' : 'none';
  // A player's own identify never triggers a roster_update (the server only ever sends that to
  // the DM connection), so nothing else would re-evaluate the DM roster strip's visibility if a
  // player ever connects on a tab that was previously showing it as the DM — re-checking here,
  // on every identify regardless of role, keeps it from getting stuck stale.
  if (typeof window.renderDmPlayerRosterBar === 'function') window.renderDmPlayerRosterBar();
  if (role !== 'player') return;
  const activeBtn = document.querySelector('.tab-btn.active');
  const restricted = ['spin', 'combat', 'players', 'compendium', 'journey', 'puzzles', 'dmcontrols'];
  const onRestricted = activeBtn && restricted.some((t) => activeBtn.getAttribute('onclick') === `showTab('${t}',this)`);
  if (onRestricted && typeof window.showTab === 'function') {
    const invBtn = document.querySelector(`[onclick="showTab('inventory',this)"]`);
    if (invBtn) window.showTab('inventory', invBtn);
  }
}

// Tears down this tab's own session state — closing the socket, clearing mp, hiding the
// role-restricted CSS and the player-name display.
function resetLocalSessionState() {
  mp.kicked = true; // suppress the close handler's auto-reconnect
  if (mp.ws) { try { mp.ws.close(); } catch { /* already closing */ } }
  mp.ws = null;
  mp.uid = null; mp.username = null; mp.role = null; mp.campaignId = null; mp.code = null;
  mp.connected = false; mp.roster.clear();
  document.body.classList.remove('role-player');
  updatePlayerNameDisplay();
  if (typeof window.resetMainAppStateToBlank === 'function') window.resetMainAppStateToBlank();
}
function logOut() {
  resetLocalSessionState();
  clearSession();
  showGate();
}

// ===================== UI (injected at runtime — nothing added to the main HTML file) =====================
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    body.role-player [onclick="showTab('spin',this)"],
    body.role-player [onclick="showTab('combat',this)"],
    body.role-player [onclick="showTab('players',this)"],
    body.role-player [onclick="showTab('compendium',this)"],
    body.role-player [onclick="showTab('journey',this)"],
    body.role-player [onclick="showTab('puzzles',this)"],
    body.role-player [onclick="showTab('dmcontrols',this)"] { display: none !important; }
    body.role-player #tab-spin, body.role-player #tab-combat,
    body.role-player #tab-players, body.role-player #tab-compendium,
    body.role-player #tab-journey, body.role-player #tab-puzzles,
    body.role-player #tab-dmcontrols { display: none !important; }

    #mpGateOverlay { position: fixed; inset: 0; background: rgba(10,8,6,0.85); z-index: 9999;
      display: flex; align-items: center; justify-content: center; }
    #mpGateOverlay.hide { display: none; }
    #mpGateBox { background: var(--panel-bg,#1c1712); border: 1px solid var(--border-color,#4a3f2f);
      border-radius: 10px; padding: 1.5rem; width: 320px; max-width: 90vw; color: var(--text,#e8dfc8); }
    #mpGateBox h2 { margin: 0 0 1rem; font-size: 1.2rem; }
    #mpGateBox label { display: block; margin: 0.6rem 0 0.2rem; font-size: 0.85rem; color: var(--text-dim,#a89f8a); }
    #mpGateBox input { width: 100%; box-sizing: border-box; padding: 0.5rem; border-radius: 6px;
      border: 1px solid var(--border-color,#4a3f2f); background: var(--input-bg,#141110); color: inherit; }
    .mp-btn { width: 100%; margin-top: 1rem; padding: 0.6rem; border-radius: 6px; border: none;
      background: var(--accent,#8a6d3b); color: #fff; font-weight: 600; cursor: pointer; }
    .mp-btn.mp-secondary { background: transparent; border: 1px solid var(--border-color,#4a3f2f); color: inherit; }
    .mp-btn.mp-danger { background: #7a2e2e; }
    .mp-role-row { display: flex; flex-direction: column; gap: 0.5rem; }
    .mp-status { margin-top: 0.6rem; font-size: 0.85rem; min-height: 1.1em; }
    .mp-status.err { color: #e08a8a; }
    .mp-close { float: right; cursor: pointer; color: var(--text-dim,#a89f8a); }

    #mpAccountBtn { display: none; position: fixed; top: 8px; right: 8px; z-index: 500;
      padding: 0.4rem 0.7rem; border-radius: 6px; border: 1px solid var(--border-color,#4a3f2f);
      background: var(--panel-bg,#1c1712); color: inherit; cursor: pointer; }
    #mpAccountBtn.show { display: block; }
    #mpAccountOverlay { position: fixed; inset: 0; background: rgba(10,8,6,0.6); z-index: 9998; display: none; }
    #mpAccountOverlay.show { display: block; }
    #mpAccountModal { position: fixed; top: 50px; right: 8px; width: 280px; max-width: 90vw;
      background: var(--panel-bg,#1c1712); border: 1px solid var(--border-color,#4a3f2f);
      border-radius: 10px; padding: 1rem; color: var(--text,#e8dfc8); }
    .mp-room-code-row { display: flex; gap: 0.4rem; align-items: center; }
    .mp-room-code { font-family: monospace; font-size: 1.1rem; letter-spacing: 0.1em; padding: 0.3rem 0.5rem;
      border: 1px dashed var(--border-color,#4a3f2f); border-radius: 6px; cursor: pointer; user-select: all; flex: 1; }
    .mp-copy-btn { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color,#4a3f2f);
      background: transparent; color: inherit; cursor: pointer; }
    .mp-copy-msg { font-size: 0.8rem; color: #9fd39f; min-height: 1.1em; margin-top: 0.2rem; }
    .mp-roster-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0;
      border-bottom: 1px solid var(--border-color,#4a3f2f); font-size: 0.85rem; gap: 0.5rem; }
    .mp-remove-btn { padding: 0.2rem 0.5rem; border-radius: 6px; border: 1px solid #7a2e2e;
      background: transparent; color: #e08a8a; cursor: pointer; font-size: 0.78rem; flex-shrink: 0; }
    #mpGuestBadge { display: none; position: fixed; top: 8px; right: 8px; z-index: 500;
      padding: 0.4rem 0.7rem; border-radius: 6px; background: var(--panel-bg,#1c1712);
      border: 1px solid var(--border-color,#4a3f2f); color: var(--text-dim,#a89f8a); font-size: 0.85rem; }
    #mpGuestBadge.show { display: block; }

    /* Connection status banner — deliberately OUTSIDE the gate overlay (see connectWebSocket's
       close handler) so a dropped connection is visible no matter what screen/tab is active,
       not just while the gate happens to be open. */
    #mpConnBanner { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
      padding: 0.5rem; text-align: center; font-size: 0.85rem; font-weight: 600; }
    #mpConnBanner.show { display: block; }
    #mpConnBanner.err { background: #7a2e2e; color: #fff; }
    #mpConnBanner.ok { background: #2e6b3e; color: #fff; }
  `;
  document.head.appendChild(style);
}

function injectDom() {
  const gateOverlay = document.createElement('div');
  gateOverlay.id = 'mpGateOverlay';
  gateOverlay.className = 'hide';
  gateOverlay.innerHTML = `<div id="mpGateBox"></div>`;
  document.body.appendChild(gateOverlay);

  const accountBtn = document.createElement('button');
  accountBtn.id = 'mpAccountBtn';
  accountBtn.onclick = () => document.getElementById('mpAccountOverlay').classList.toggle('show');
  document.body.appendChild(accountBtn);

  const accountOverlay = document.createElement('div');
  accountOverlay.id = 'mpAccountOverlay';
  accountOverlay.onclick = (e) => { if (e.target === accountOverlay) accountOverlay.classList.remove('show'); };
  accountOverlay.innerHTML = `<div id="mpAccountModal"></div>`;
  document.body.appendChild(accountOverlay);

  const guestBadge = document.createElement('div');
  guestBadge.id = 'mpGuestBadge';
  guestBadge.innerHTML = `🎲 Guest (solo, not synced) &nbsp; <a href="#" id="mpExitGuestLink" style="color:inherit;">switch</a>`;
  document.body.appendChild(guestBadge);
  document.getElementById('mpExitGuestLink').onclick = (e) => { e.preventDefault(); exitGuestMode(); };

  const connBanner = document.createElement('div');
  connBanner.id = 'mpConnBanner';
  document.body.appendChild(connBanner);
}

let _connBannerOkTimer = null;
function showConnBanner(msg, isError) {
  clearTimeout(_connBannerOkTimer);
  const el = document.getElementById('mpConnBanner');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  el.classList.toggle('err', !!isError);
  el.classList.toggle('ok', !isError);
}
function hideConnBanner() {
  const el = document.getElementById('mpConnBanner');
  if (!el || !el.classList.contains('show')) return;
  // Flash a brief "back online" confirmation rather than just vanishing — someone who watched
  // "Connection lost — reconnecting…" sit there deserves to know it actually recovered.
  el.textContent = 'Reconnected.';
  el.classList.remove('err');
  el.classList.add('ok');
  clearTimeout(_connBannerOkTimer);
  _connBannerOkTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function showGate() { document.getElementById('mpGateOverlay').classList.remove('hide'); renderGateRoleSelect(); }
function hideGate() { document.getElementById('mpGateOverlay').classList.add('hide'); }
function setGateStatus(msg, isError) {
  const el = document.getElementById('mpGateStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('err', !!isError);
}

function enterGuestMode() {
  hideGate();
  document.body.classList.remove('role-player');
  const battlefieldBtn = document.getElementById('battlefieldTabBtn');
  if (battlefieldBtn) battlefieldBtn.style.display = '';
  document.getElementById('mpGuestBadge').classList.add('show');
}
function exitGuestMode() {
  document.getElementById('mpGuestBadge').classList.remove('show');
  showGate();
}

// ---- Gate: role select ----
function renderGateRoleSelect() {
  const box = document.getElementById('mpGateBox');
  box.innerHTML = `
    <h2>🎲 Dungeon Master Box</h2>
    <div class="mp-role-row">
      <button class="mp-btn" id="mpRoleDmBtn">👑 Dungeon Master</button>
      <button class="mp-btn" id="mpRolePlayerBtn">🧙 Player</button>
      <button class="mp-btn mp-secondary" id="mpRoleGuestBtn">🎲 Solo / Guest (no sync)</button>
    </div>
    <div class="mp-status" id="mpGateStatus"></div>
  `;
  document.getElementById('mpRoleDmBtn').onclick = renderDmGateForm;
  document.getElementById('mpRolePlayerBtn').onclick = renderPlayerGateForm;
  document.getElementById('mpRoleGuestBtn').onclick = enterGuestMode;
}

// ---- Gate: DM — start a new campaign, or resume an existing one by its code ----
function renderDmGateForm() {
  const box = document.getElementById('mpGateBox');
  box.innerHTML = `
    <span class="mp-close" id="mpBackBtn">← back</span>
    <h2>👑 Dungeon Master</h2>
    <label>New campaign name</label>
    <input type="text" id="mpCampaignName" placeholder="e.g. Curse of the Crimson Throne">
    <button class="mp-btn" id="mpStartCampaignBtn">Start New Campaign</button>
    <label style="margin-top:1rem;">— or resume one you already started —</label>
    <input type="text" id="mpResumeCode" placeholder="campaign code" style="text-transform:uppercase;" autocomplete="off" spellcheck="false">
    <button class="mp-btn mp-secondary" id="mpResumeCampaignBtn">Resume as DM</button>
    <div class="mp-status" id="mpGateStatus"></div>
  `;
  document.getElementById('mpBackBtn').onclick = renderGateRoleSelect;
  document.getElementById('mpStartCampaignBtn').onclick = async () => {
    const name = document.getElementById('mpCampaignName').value.trim();
    if (!name) return setGateStatus('Enter a campaign name.', true);
    setGateStatus('Working…');
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const campaign = await res.json();
      if (!res.ok) throw new Error(campaign.error || 'Could not create the campaign.');
      beginSession('dm', campaign.id, campaign.code, 'DM');
    } catch (err) { setGateStatus(err.message, true); }
  };
  document.getElementById('mpResumeCampaignBtn').onclick = async () => {
    const code = document.getElementById('mpResumeCode').value.trim();
    if (!code) return setGateStatus('Enter the campaign code.', true);
    if (!looksLikeCampaignCode(code)) return setGateStatus("That doesn't look like a campaign code — it should be a short string of letters/numbers.", true);
    setGateStatus('Working…');
    try {
      const campaign = await fetchCampaignByCode(code);
      beginSession('dm', campaign.id, campaign.code, 'DM');
    } catch (err) { setGateStatus(err.message, true); }
  };
}

// ---- Gate: Player — join with the DM's code and a display name ----
function renderPlayerGateForm() {
  const box = document.getElementById('mpGateBox');
  box.innerHTML = `
    <span class="mp-close" id="mpBackBtn">← back</span>
    <h2>🧙 Player</h2>
    <label>Campaign code</label>
    <input type="text" id="mpJoinCode" placeholder="e.g. K7M2P" style="text-transform:uppercase;" autocomplete="off" spellcheck="false">
    <label>Your display name</label>
    <input type="text" id="mpJoinName" placeholder="what your DM sees">
    <button class="mp-btn" id="mpJoinBtn">Join Campaign</button>
    <div class="mp-status" id="mpGateStatus"></div>
  `;
  document.getElementById('mpBackBtn').onclick = renderGateRoleSelect;
  document.getElementById('mpJoinBtn').onclick = async () => {
    const code = document.getElementById('mpJoinCode').value.trim();
    const name = document.getElementById('mpJoinName').value.trim();
    if (!code) return setGateStatus('Enter your campaign code.', true);
    if (!looksLikeCampaignCode(code)) return setGateStatus("That doesn't look like a campaign code — it should be a short string of letters/numbers.", true);
    if (!name) return setGateStatus('Enter a display name.', true);
    setGateStatus('Working…');
    try {
      const campaign = await fetchCampaignByCode(code);
      beginSession('player', campaign.id, campaign.code, name);
    } catch (err) { setGateStatus(err.message, true); }
  };
}

// Real campaign codes are 5 characters from a fixed alphabet (see db/database.js's
// generateCampaignCode), but this checks a looser 4-8 alphanumeric shape rather than hardcoding
// the exact length/alphabet here too — the point isn't to duplicate the server's exact format,
// just to reject anything that obviously isn't a short code (a pasted URL, an empty autofill
// artifact) before it ever reaches the network. Found worth having during real testing: a full
// page URL ended up in this field (almost certainly a stray browser-autofill suggestion, since
// nothing in this form would type it there deliberately) and round-tripped all the way to a
// server 404 with no on-screen feedback at all.
function looksLikeCampaignCode(raw) {
  return /^[A-Z0-9]{4,8}$/.test((raw || '').trim().toUpperCase());
}

async function fetchCampaignByCode(code) {
  const res = await fetch(`${API_BASE}/campaigns/by-code/${encodeURIComponent(code.toUpperCase())}`);
  const body = await res.json();
  if (!res.ok) throw new Error(res.status === 404 ? `No campaign found for code "${code}".` : (body.error || 'Could not reach the campaign.'));
  return body;
}

function beginSession(role, campaignId, code, username) {
  mp.uid = getOrCreateDeviceUid();
  mp.role = role;
  mp.campaignId = campaignId;
  mp.code = code;
  mp.username = username;
  mp.kicked = false;
  refreshLocalStateCache();
  saveSession({ role, campaignId, code, username });
  connectWebSocket();
}

// ---- Post-connect account panel ----
function renderAccountPanel() {
  const btn = document.getElementById('mpAccountBtn');
  const modal = document.getElementById('mpAccountModal');
  if (!btn || !modal) return;
  btn.classList.toggle('show', mp.connected);
  if (!mp.connected) return;
  btn.textContent = (mp.role === 'dm' ? '👑 ' : '🧙 ') + mp.username;

  if (modal.dataset.builtFor !== mp.uid + mp.campaignId) {
    modal.dataset.builtFor = mp.uid + mp.campaignId;
    modal.innerHTML = `
      <span class="mp-close" onclick="document.getElementById('mpAccountOverlay').classList.remove('show')">×</span>
      <h3>${mp.role === 'dm' ? '👑 Dungeon Master' : '🧙 Player'}: ${escapeHtmlLocal(mp.username)}</h3>
      <label>Campaign code</label>
      <div class="mp-room-code-row">
        <div class="mp-room-code" id="mpRoomCodeVal" title="Click to copy">${escapeHtmlLocal(mp.code)}</div>
        <button class="mp-copy-btn" id="mpCopyRoomCodeBtn" title="Copy campaign code">📋 Copy</button>
      </div>
      <div class="mp-copy-msg" id="mpRoomCodeCopyMsg"></div>
      <button class="mp-btn mp-danger" id="mpLogoutBtn">Log Out</button>
      <div id="mpRosterContainer"></div>
    `;
    document.getElementById('mpLogoutBtn').onclick = logOut;
    document.getElementById('mpCopyRoomCodeBtn').onclick = copyRoomCode;
    document.getElementById('mpRoomCodeVal').onclick = copyRoomCode;
  }

  const rosterContainer = document.getElementById('mpRosterContainer');
  if (!rosterContainer) return;
  rosterContainer.innerHTML = mp.role === 'dm' ? `
    <div class="mp-roster">
      <label style="margin-top:0;">Connected players</label>
      ${[...mp.roster.entries()].map(([uid, p]) => `
        <div class="mp-roster-row">
          <span>${escapeHtmlLocal(p.username)}${p.currentHp != null ? ` <span style="color:var(--text-dim,#a89f8a);">(HP ${escapeHtmlLocal(String(p.currentHp))}/${escapeHtmlLocal(String(p.maxHp))}, AC ${escapeHtmlLocal(String(p.ac))})</span>` : ''}</span>
          <button class="mp-remove-btn" data-uid="${uid}">Remove</button>
        </div>
      `).join('') || '<div style="color:var(--text-dim,#a89f8a);font-size:0.85rem;">No players have joined yet.</div>'}
    </div>
  ` : '';
  rosterContainer.querySelectorAll('.mp-remove-btn').forEach((el) => {
    el.onclick = () => {
      const uid = el.getAttribute('data-uid');
      const username = (mp.roster.get(uid) || {}).username || 'this player';
      if (!confirm(`Remove ${username} from your campaign? Their character data will be deleted.`)) return;
      kickPlayer(uid).catch(() => alert("Couldn't remove that player — check your connection and try again."));
    };
  });
}

async function copyRoomCode() {
  const code = mp.code;
  if (!code) return;
  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try { await navigator.clipboard.writeText(code); copied = true; } catch { /* fall through */ }
  }
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { /* both methods failed — code is still visible and selectable by hand */ }
  }
  if (copied) flashRoomCodeCopied();
}
let _roomCodeCopyMsgTimer = null;
function flashRoomCodeCopied() {
  const el = document.getElementById('mpRoomCodeCopyMsg');
  if (!el) return;
  el.textContent = '✓ Copied!';
  clearTimeout(_roomCodeCopyMsgTimer);
  _roomCodeCopyMsgTimer = setTimeout(() => { el.textContent = ''; }, 1500);
}

function escapeHtmlLocal(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===================== INIT =====================
function init() {
  injectStyles();
  injectDom();
  const session = loadSession();
  if (session && session.campaignId) {
    mp.uid = getOrCreateDeviceUid();
    mp.role = session.role;
    mp.campaignId = session.campaignId;
    mp.code = session.code;
    mp.username = session.username;
    refreshLocalStateCache();
    connectWebSocket();
  } else {
    showGate();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
