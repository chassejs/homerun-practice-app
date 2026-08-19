/* ===================================================================
   Homerun Practice — uiModal.js
   Shared utility modal on a dedicated overlay (not #modal-overlay).
   =================================================================== */

window.HRP_MODAL = (function () {
  'use strict';

  var overlay = null;
  var box = null;
  var returnFocus = null;
  var dismissBound = false;

  var FOCUSABLE = 'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    var k, val, i;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        val = attrs[k];
        if (k === 'class') {
          node.className = val;
        } else if (k === 'text') {
          node.textContent = val;
        } else if (k === 'html') {
          node.innerHTML = val;
        } else if (
          k.indexOf('data-') === 0 ||
          k === 'for' ||
          k === 'list' ||
          k === 'role' ||
          k.indexOf('aria-') === 0
        ) {
          node.setAttribute(k, val);
        } else if (k in node) {
          node[k] = val;
        } else {
          node.setAttribute(k, val);
        }
      }
    }
    if (children) {
      for (i = 0; i < children.length; i++) {
        if (children[i]) node.appendChild(children[i]);
      }
    }
    return node;
  }

  function bindDismissOnce() {
    if (dismissBound || !overlay || typeof document === 'undefined') return;
    dismissBound = true;
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      if ((key === 'Escape' || key === 'Esc' || key === 27) && isOpen()) {
        close();
      }
    });
  }

  function ensureOverlay() {
    if (overlay) return;
    if (typeof document === 'undefined' || !document.body) return;
    box = el('div', {
      id: 'util-modal-box',
      class: 'modal-box',
      role: 'dialog',
      'aria-modal': 'true'
    });
    overlay = el('div', {
      id: 'util-modal-overlay',
      class: 'modal-overlay hidden no-print'
    }, [box]);
    document.body.appendChild(overlay);
    bindDismissOnce();
  }

  function getFocusable() {
    if (!box) return [];
    return Array.prototype.slice.call(box.querySelectorAll(FOCUSABLE));
  }

  function open(options) {
    if (typeof document === 'undefined') return;
    options = options || {};
    var title = options.title || '';
    var titleId = options.titleId || 'util-modal-title';
    var build = options.build;

    ensureOverlay();
    if (!overlay || !box) return;

    box.innerHTML = '';
    box.setAttribute('aria-labelledby', titleId);
    box.appendChild(el('h3', { class: 'modal-title', id: titleId, text: title }));

    var api = {
      close: close,
      setTitle: function (text) {
        var heading = document.getElementById(titleId);
        if (heading) heading.textContent = text;
      },
      el: el
    };

    if (typeof build === 'function') {
      build(box, api);
    }

    returnFocus = document.activeElement;
    overlay.classList.remove('hidden');
    if (document.body) document.body.classList.add('modal-open');

    var focusables = getFocusable();
    if (focusables.length) {
      focusables[0].focus();
    } else {
      box.setAttribute('tabindex', '-1');
      box.focus();
    }
  }

  function close() {
    if (!overlay || !box) return;
    overlay.classList.add('hidden');
    box.innerHTML = '';
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('modal-open');
    }
    if (
      returnFocus &&
      typeof returnFocus.focus === 'function' &&
      typeof document !== 'undefined' &&
      document.body &&
      document.body.contains(returnFocus)
    ) {
      returnFocus.focus();
    }
    returnFocus = null;
  }

  function isOpen() {
    return !!(overlay && overlay.classList && !overlay.classList.contains('hidden'));
  }

  return {
    el: el,
    open: open,
    close: close,
    isOpen: isOpen
  };
}());
