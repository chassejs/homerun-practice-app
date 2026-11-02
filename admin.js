/* ===================================================================
   Homerun Practice — admin.js
   Local admin portal. Its job is to review feedback comments saved
   on this browser, and to manage who can sign in here.

   The first account is username "admin" / password "admin" until an
   admin changes it or adds someone else. Passwords are stored only
   as SHA-256 hashes in this browser.
   =================================================================== */

window.HRP_ADMIN = (function () {
  'use strict';

  var DEFAULT_ADMIN_USERNAME = 'admin';
  var DEFAULT_ADMIN_PASSWORD = 'admin';
  var USERS_KEY = 'homerun-practice/admin/users';
  var LEGACY_HASH_KEY = 'homerun-practice/admin/password-hash';
  var SESSION_KEY = 'homerun-practice/admin/session';
  var MIN_PASSWORD_LENGTH = 4;
  var USERNAME_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // SHA-256 round constants.
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(n, x) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  }

  function utf8Bytes(str) {
    var out = [];
    var i, c, c2, u;
    str = String(str);
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        c2 = str.charCodeAt(++i);
        u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(
          0xf0 | (u >> 18),
          0x80 | ((u >> 12) & 0x3f),
          0x80 | ((u >> 6) & 0x3f),
          0x80 | (u & 0x3f)
        );
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  function sha256(message) {
    var bytes = utf8Bytes(message);
    var bitLen = bytes.length * 8;
    var hi = Math.floor(bitLen / 0x100000000);
    var lo = bitLen >>> 0;
    var i, j, w, a, b, c, d, e, f, g, h, s0, s1, S0, S1, ch, maj, t1, t2;
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

    for (i = 0; i < bytes.length; i += 64) {
      w = new Array(64);
      for (j = 0; j < 16; j++) {
        w[j] = (
          (bytes[i + j * 4] << 24) |
          (bytes[i + j * 4 + 1] << 16) |
          (bytes[i + j * 4 + 2] << 8) |
          bytes[i + j * 4 + 3]
        ) >>> 0;
      }
      for (j = 16; j < 64; j++) {
        s0 = (rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3)) >>> 0;
        s1 = (rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10)) >>> 0;
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3];
      e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (j = 0; j < 64; j++) {
        S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0;
        ch = ((e & f) ^ ((~e) & g)) >>> 0;
        t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0;
        maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    var hex = '';
    for (i = 0; i < H.length; i++) {
      hex += ('00000000' + H[i].toString(16)).slice(-8);
    }
    return hex;
  }

  function hashesEqual(a, b) {
    var diff, i;
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    diff = 0;
    for (i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function formatReleaseDate(iso) {
    var parts = String(iso || '').split('-');
    var month, day;
    if (parts.length < 3) return iso || '';
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
    if (!month || !day || month < 1 || month > 12) return iso || '';
    return day + ' ' + MONTHS[month - 1] + ' ' + parts[0];
  }

  function latestReleaseDate() {
    var list = window.HRP_CHANGELOG;
    if (list && list[0] && list[0].date) return list[0].date;
    return '';
  }

  function normalizeUsername(value) {
    return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '').toLowerCase();
  }

  function defaultUsers() {
    var users = {};
    users[DEFAULT_ADMIN_USERNAME] = sha256(DEFAULT_ADMIN_PASSWORD);
    return users;
  }

  function copyUsers(users) {
    var out = {};
    var names = Object.keys(users);
    var i;
    for (i = 0; i < names.length; i++) out[names[i]] = users[names[i]];
    return out;
  }

  function isDefaultMap(users) {
    var names = Object.keys(users);
    return names.length === 1 &&
      names[0] === DEFAULT_ADMIN_USERNAME &&
      users[DEFAULT_ADMIN_USERNAME] === sha256(DEFAULT_ADMIN_PASSWORD);
  }

  function createGate(local, session) {
    function readStored() {
      var raw, parsed, names, i, name, hash, clean, legacy;
      raw = local.getItem(USERS_KEY);
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          parsed = null;
        }
        if (parsed && typeof parsed === 'object') {
          names = Object.keys(parsed);
          clean = {};
          for (i = 0; i < names.length; i++) {
            name = normalizeUsername(names[i]);
            hash = parsed[names[i]];
            if (USERNAME_RE.test(name) && typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash)) {
              clean[name] = hash;
            }
          }
          if (Object.keys(clean).length) return { users: clean, persisted: true };
        }
      }
      legacy = local.getItem(LEGACY_HASH_KEY);
      if (legacy && /^[0-9a-f]{64}$/.test(String(legacy))) {
        clean = {};
        clean[DEFAULT_ADMIN_USERNAME] = String(legacy);
        return { users: clean, persisted: true };
      }
      return { users: defaultUsers(), persisted: false };
    }

    function persist(users) {
      var wrote;
      if (isDefaultMap(users)) {
        if (typeof local.removeItem === 'function') {
          local.removeItem(USERS_KEY);
          local.removeItem(LEGACY_HASH_KEY);
        }
        return true;
      }
      wrote = local.setItem(USERS_KEY, JSON.stringify(users));
      if (wrote === false) return false;
      if (typeof local.removeItem === 'function') local.removeItem(LEGACY_HASH_KEY);
      return true;
    }

    function usersNow() {
      return readStored().users;
    }

    function hashOf(username) {
      return usersNow()[normalizeUsername(username)] || '';
    }

    function checkPassword(username, password) {
      var expected = hashOf(username);
      if (!expected) return false;
      return hashesEqual(sha256(String(password == null ? '' : password)), expected);
    }

    function sessionUser() {
      var name = normalizeUsername(session.getItem(SESSION_KEY));
      if (!name || !hashOf(name)) return '';
      return name;
    }

    function validatePassword(next, confirm) {
      var nextValue = String(next == null ? '' : next);
      if (nextValue.length < MIN_PASSWORD_LENGTH) return { ok: false, error: 'short' };
      if (nextValue !== String(confirm == null ? '' : confirm)) return { ok: false, error: 'mismatch' };
      return { ok: true, password: nextValue };
    }

    return {
      checkPassword: checkPassword,
      usingDefaultPassword: function () {
        return !readStored().persisted;
      },
      listUsers: function () {
        return Object.keys(usersNow()).sort();
      },
      currentUser: sessionUser,
      isUnlocked: function () {
        return sessionUser() !== '';
      },
      unlock: function (username, password) {
        var name = normalizeUsername(username);
        var wrote;
        if (!checkPassword(name, password)) return false;
        wrote = session.setItem(SESSION_KEY, name);
        return wrote !== false;
      },
      lock: function () {
        if (typeof session.removeItem === 'function') session.removeItem(SESSION_KEY);
        else session.setItem(SESSION_KEY, '');
      },
      changeUserPassword: function (username, next, confirm) {
        var name, check, users;
        if (!sessionUser()) return { ok: false, error: 'locked' };
        name = normalizeUsername(username);
        if (!hashOf(name)) return { ok: false, error: 'unknown' };
        check = validatePassword(next, confirm);
        if (!check.ok) return check;
        users = copyUsers(usersNow());
        users[name] = sha256(check.password);
        if (!persist(users)) return { ok: false, error: 'storage' };
        return { ok: true, username: name };
      },
      createUser: function (username, password, confirm) {
        var name, check, users;
        if (!sessionUser()) return { ok: false, error: 'locked' };
        name = normalizeUsername(username);
        if (!USERNAME_RE.test(name)) return { ok: false, error: 'username' };
        if (hashOf(name)) return { ok: false, error: 'taken' };
        check = validatePassword(password, confirm);
        if (!check.ok) return check;
        users = copyUsers(usersNow());
        users[name] = sha256(check.password);
        if (!persist(users)) return { ok: false, error: 'storage' };
        return { ok: true, username: name };
      }
    };
  }

  function safeStorage(native) {
    var memory = {};
    function hasNative() {
      return native && typeof native.getItem === 'function';
    }
    return {
      getItem: function (key) {
        try {
          if (hasNative()) return native.getItem(key);
        } catch (e) { /* fall through */ }
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      },
      setItem: function (key, value) {
        try {
          if (hasNative()) {
            native.setItem(key, value);
            return true;
          }
        } catch (e) {
          return false;
        }
        memory[key] = String(value);
        return true;
      },
      removeItem: function (key) {
        try {
          if (hasNative() && typeof native.removeItem === 'function') native.removeItem(key);
        } catch (e) { /* ignore */ }
        delete memory[key];
      }
    };
  }

  function showMessage(node, text) {
    if (!node) return;
    if (!text) {
      node.textContent = '';
      node.hidden = true;
      return;
    }
    node.textContent = text;
    node.hidden = false;
  }

  function passwordErrorText(code) {
    if (code === 'short') return 'Use at least 4 characters.';
    if (code === 'mismatch') return 'Those new passwords do not match.';
    if (code === 'storage') return 'This browser could not save that change.';
    if (code === 'unknown') return 'That admin was not found.';
    if (code === 'username') return 'Use letters and numbers (dots and hyphens are ok), up to 32 characters.';
    if (code === 'taken') return 'That username is already an admin.';
    if (code === 'locked') return 'Sign in before changing admins.';
    return 'That change could not be saved.';
  }

  function init() {
    var gate = createGate(safeStorage(window.localStorage), safeStorage(window.sessionStorage));
    var gatePanel = document.getElementById('admin-gate');
    var portalPanel = document.getElementById('admin-portal');
    var loginForm = document.getElementById('admin-login-form');
    var loginError = document.getElementById('admin-login-error');
    var usernameInput = document.getElementById('admin-username');
    var passwordInput = document.getElementById('admin-password');
    var stats = document.getElementById('admin-stats');
    var feedbackList = document.getElementById('admin-feedback-list');
    var feedbackFilters = document.getElementById('admin-feedback-filters');
    var userList = document.getElementById('admin-user-list');
    var passwordUser = document.getElementById('admin-password-user');
    var changeForm = document.getElementById('admin-password-form');
    var changeError = document.getElementById('admin-password-error');
    var changeOk = document.getElementById('admin-password-ok');
    var createForm = document.getElementById('admin-create-form');
    var createError = document.getElementById('admin-create-error');
    var createOk = document.getElementById('admin-create-ok');
    var signedIn = document.getElementById('admin-signed-in');
    var feedbackFilter = 'all';

    function openView() {
      if (window.HRP_SHELL && typeof window.HRP_SHELL.showView === 'function') {
        window.HRP_SHELL.showView('admin');
      }
      render();
      if (gate.isUnlocked()) {
        if (signedIn && typeof signedIn.focus === 'function') signedIn.focus();
      } else if (usernameInput && typeof usernameInput.focus === 'function') {
        usernameInput.focus();
      }
    }

    function bindOpen(id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('click', function (e) {
        e.preventDefault();
        openView();
      });
    }

    function renderStats() {
      var version, iso, rows, i, dt, dd;
      if (!stats) return;
      while (stats.firstChild) stats.removeChild(stats.firstChild);
      version = (window.HRP_VERSION && window.HRP_VERSION.APP_VERSION) || '';
      iso = latestReleaseDate();
      rows = [
        ['Version', version ? 'v' + version : ''],
        ['Last updated', iso ? formatReleaseDate(iso) : ''],
        ['Signed in as', gate.currentUser()]
      ];
      for (i = 0; i < rows.length; i++) {
        dt = document.createElement('dt');
        dt.textContent = rows[i][0];
        dd = document.createElement('dd');
        dd.textContent = rows[i][1];
        stats.appendChild(dt);
        stats.appendChild(dd);
      }
    }

    function feedbackApi() {
      return window.HRP_FEEDBACK || null;
    }

    function commentWhen(iso) {
      var when = new Date(iso);
      if (isNaN(when.getTime())) return iso || '';
      return when.toLocaleString();
    }

    function renderFeedback() {
      var api, comments, counts, buttons, i, comment, card, meta, body, actions, status;
      if (!feedbackList) return;
      while (feedbackList.firstChild) feedbackList.removeChild(feedbackList.firstChild);
      api = feedbackApi();
      if (!api || typeof api.listComments !== 'function') {
        feedbackList.textContent = 'Feedback comments are unavailable.';
        return;
      }
      comments = api.listComments();
      counts = { all: comments.length, new: 0, reviewed: 0, resolved: 0 };
      for (i = 0; i < comments.length; i++) {
        status = comments[i].status;
        if (counts[status] != null) counts[status] += 1;
      }
      if (feedbackFilters) {
        buttons = feedbackFilters.querySelectorAll('[data-feedback-filter]');
        for (i = 0; i < buttons.length; i++) {
          status = buttons[i].getAttribute('data-feedback-filter');
          buttons[i].textContent =
            (status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)) +
            ' (' + (counts[status] || 0) + ')';
          buttons[i].classList.toggle('active', status === feedbackFilter);
        }
      }
      comments = comments.filter(function (item) {
        return feedbackFilter === 'all' || item.status === feedbackFilter;
      });
      if (!comments.length) {
        feedbackList.textContent = feedbackFilter === 'all'
          ? 'No feedback comments on this browser yet. They appear here when someone uses Send feedback.'
          : 'No ' + feedbackFilter + ' comments.';
        return;
      }
      for (i = 0; i < comments.length; i++) {
        comment = comments[i];
        card = document.createElement('article');
        card.className = 'admin-comment';
        meta = document.createElement('p');
        meta.className = 'admin-comment-meta';
        status = document.createElement('span');
        status.className = 'admin-status admin-status-' + comment.status;
        status.textContent = comment.status;
        meta.appendChild(status);
        meta.appendChild(document.createTextNode(
          ' ' + (comment.categoryLabel || 'Feedback') +
          (comment.rating ? ' · ' + comment.rating + '/5' : '') +
          (comment.createdAt ? ' · ' + commentWhen(comment.createdAt) : '')
        ));
        body = document.createElement('p');
        body.className = 'admin-comment-body';
        body.textContent = comment.details;
        actions = document.createElement('div');
        actions.className = 'admin-comment-actions';
        actions.appendChild(statusButton(comment, 'new', 'Mark new'));
        actions.appendChild(statusButton(comment, 'reviewed', 'Mark reviewed'));
        actions.appendChild(statusButton(comment, 'resolved', 'Mark resolved'));
        card.appendChild(meta);
        card.appendChild(body);
        card.appendChild(actions);
        feedbackList.appendChild(card);
      }
    }

    function statusButton(comment, status, label) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-secondary';
      button.textContent = label;
      button.disabled = comment.status === status;
      button.addEventListener('click', function () {
        var api = feedbackApi();
        if (!api || typeof api.setCommentStatus !== 'function') return;
        api.setCommentStatus(comment.id, status);
        renderFeedback();
      });
      return button;
    }

    function renderUsers() {
      var names, i, li, previous, option;
      names = gate.listUsers();
      if (userList) {
        while (userList.firstChild) userList.removeChild(userList.firstChild);
        for (i = 0; i < names.length; i++) {
          li = document.createElement('li');
          li.textContent = names[i] === gate.currentUser() ? names[i] + ' (signed in)' : names[i];
          userList.appendChild(li);
        }
      }
      if (!passwordUser) return;
      previous = passwordUser.value;
      while (passwordUser.firstChild) passwordUser.removeChild(passwordUser.firstChild);
      for (i = 0; i < names.length; i++) {
        option = document.createElement('option');
        option.value = names[i];
        option.textContent = names[i];
        passwordUser.appendChild(option);
      }
      if (previous && names.indexOf(previous) !== -1) passwordUser.value = previous;
      else passwordUser.value = gate.currentUser() || names[0] || '';
    }

    function render() {
      var unlocked = gate.isUnlocked();
      if (gatePanel) gatePanel.hidden = unlocked;
      if (portalPanel) portalPanel.hidden = !unlocked;
      if (signedIn) {
        signedIn.textContent = unlocked
          ? 'Signed in as ' + gate.currentUser() + '.'
          : 'You are signed in on this browser.';
      }
      if (!unlocked) return;
      renderStats();
      renderFeedback();
      renderUsers();
    }

    bindOpen('footer-admin');
    bindOpen('readme-admin-btn');

    if (feedbackFilters) {
      feedbackFilters.addEventListener('click', function (e) {
        var filter = e.target && e.target.getAttribute && e.target.getAttribute('data-feedback-filter');
        if (!filter) return;
        feedbackFilter = filter;
        renderFeedback();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        var username, password;
        e.preventDefault();
        username = usernameInput ? usernameInput.value : '';
        password = passwordInput ? passwordInput.value : '';
        if (!gate.unlock(username, password)) {
          showMessage(loginError, 'That username or password is not right.');
          if (passwordInput) passwordInput.select();
          return;
        }
        showMessage(loginError, '');
        if (passwordInput) passwordInput.value = '';
        render();
        if (signedIn && typeof signedIn.focus === 'function') signedIn.focus();
      });
    }

    if (changeForm) {
      changeForm.addEventListener('submit', function (e) {
        var nextEl = document.getElementById('admin-new-password');
        var confirmEl = document.getElementById('admin-confirm-password');
        var result;
        e.preventDefault();
        result = gate.changeUserPassword(
          passwordUser ? passwordUser.value : '',
          nextEl ? nextEl.value : '',
          confirmEl ? confirmEl.value : ''
        );
        if (!result.ok) {
          showMessage(changeOk, '');
          showMessage(changeError, passwordErrorText(result.error));
          return;
        }
        if (nextEl) nextEl.value = '';
        if (confirmEl) confirmEl.value = '';
        showMessage(changeError, '');
        showMessage(changeOk, 'Password updated for ' + result.username + '.');
        renderStats();
      });
    }

    if (createForm) {
      createForm.addEventListener('submit', function (e) {
        var nameEl = document.getElementById('admin-new-username');
        var nextEl = document.getElementById('admin-create-password');
        var confirmEl = document.getElementById('admin-create-confirm');
        var result;
        e.preventDefault();
        result = gate.createUser(
          nameEl ? nameEl.value : '',
          nextEl ? nextEl.value : '',
          confirmEl ? confirmEl.value : ''
        );
        if (!result.ok) {
          showMessage(createOk, '');
          showMessage(createError, passwordErrorText(result.error));
          return;
        }
        if (nameEl) nameEl.value = '';
        if (nextEl) nextEl.value = '';
        if (confirmEl) confirmEl.value = '';
        showMessage(createError, '');
        showMessage(createOk, result.username + ' can sign in with that username.');
        renderUsers();
      });
    }

    var signOut = document.getElementById('admin-sign-out');
    if (signOut) {
      signOut.addEventListener('click', function () {
        gate.lock();
        showMessage(changeError, '');
        showMessage(changeOk, '');
        showMessage(createError, '');
        showMessage(createOk, '');
        showMessage(loginError, '');
        render();
        if (usernameInput && typeof usernameInput.focus === 'function') usernameInput.focus();
      });
    }

    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    DEFAULT_ADMIN_USERNAME: DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD,
    sha256: sha256,
    createGate: createGate,
    formatReleaseDate: formatReleaseDate
  };
}());
