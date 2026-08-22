/* ===================================================================
   Homerun Practice — feedback.js
   In-app feedback form that drafts a mailto: message. No network.
   =================================================================== */

window.HRP_FEEDBACK = (function () {
  'use strict';

  var FEEDBACK_EMAIL = 'feedback-practice@homerunbaseballottawa.ca';
  var DETAILS_MAX = 2000;
  var MAIL_BODY_LIMIT = 1800;
  var TRUNCATE_NOTE = '[report truncated — use "Copy report" for the full text]';

  var CATEGORIES = [
    { value: '', label: 'Choose one…' },
    { value: 'bug', label: 'Bug — something is broken' },
    { value: 'drills', label: 'Drill library' },
    { value: 'planbuilder', label: 'Plan builder or stations' },
    { value: 'backup', label: 'Save/Load or Export/Import' },
    { value: 'printing', label: 'Printing' },
    { value: 'design', label: 'Design & layout' },
    { value: 'feature', label: 'Feature request' },
    { value: 'suggest-drill', label: 'Suggest a drill to add' },
    { value: 'question', label: 'Question / need help' },
    { value: 'other', label: 'Other' }
  ];

  function trim(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  function appVersion() {
    return (window.HRP_VERSION && window.HRP_VERSION.APP_VERSION) || 'unknown';
  }

  function categoryLabel(value) {
    var i;
    for (i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].value === value) return CATEGORIES[i].label;
    }
    return value;
  }

  function ratingStars(rating) {
    var out = '';
    var i;
    for (i = 1; i <= 5; i++) {
      out += i <= rating ? '★' : '☆';
    }
    return out;
  }

  function starAriaLabel(n) {
    return n === 1 ? '1 star' : n + ' stars';
  }

  function pageLine() {
    if (typeof location === 'undefined') return 'unknown';
    if (location.protocol === 'file:') return 'offline file';
    return location.href;
  }

  function deviceLine() {
    return (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'unknown';
  }

  function screenLine() {
    if (typeof window === 'undefined' || !window.screen) return 'unknown';
    return window.screen.width + 'x' + window.screen.height;
  }

  function buildBody(rating, catLabel, details) {
    var ratingLine;
    if (!rating) {
      ratingLine = 'Rating: not rated';
    } else {
      ratingLine = 'Rating: ' + ratingStars(rating) + ' (' + rating + ' out of 5)';
    }
    return (
      ratingLine + '\n' +
      'Category: ' + catLabel + '\n' +
      '\n' +
      'What happened:\n' +
      details + '\n' +
      '\n' +
      '---\n' +
      'App version: ' + appVersion() + '\n' +
      'Page: ' + pageLine() + '\n' +
      'Device: ' + deviceLine() + '\n' +
      'Screen: ' + screenLine() + '\n' +
      'Sent: ' + new Date().toISOString()
    );
  }

  function buildSubject(catLabel, rating) {
    var subject = 'Homerun Practice feedback — ' + catLabel;
    if (rating > 0) subject += ' — ' + rating + '/5';
    return subject;
  }

  function copyText(text, button, host) {
    function markCopied() {
      var prev = button.textContent;
      button.textContent = 'Copied ✓';
      setTimeout(function () {
        button.textContent = prev;
      }, 2000);
    }

    function fallbackExec() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      return ok;
    }

    function showManual() {
      var existing = host.querySelector('.feedback-fallback-text');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var ta = document.createElement('textarea');
      ta.className = 'feedback-fallback-text';
      ta.readOnly = true;
      ta.value = text;
      host.appendChild(ta);
      ta.focus();
      ta.select();
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(markCopied).catch(function () {
        if (fallbackExec()) markCopied();
        else showManual();
      });
      return;
    }
    if (fallbackExec()) markCopied();
    else showManual();
  }

  function clearKeepTitle(box) {
    var heading = box.querySelector('.modal-title');
    while (box.lastChild && box.lastChild !== heading) {
      box.removeChild(box.lastChild);
    }
  }

  function showConfirmation(box, api, subject, fullBody, truncated) {
    api.setTitle('Feedback ready to send');
    clearKeepTitle(box);

    box.appendChild(api.el('p', {
      class: 'feedback-confirm',
      text: 'Your email app should have opened with the message ready. You still need to press Send there.'
    }));
    box.appendChild(api.el('p', {
      class: 'feedback-confirm-note',
      text: 'If nothing opened, copy the report and email it to this address:'
    }));
    box.appendChild(api.el('p', { class: 'feedback-address-line' }, [
      api.el('code', { class: 'feedback-email', text: FEEDBACK_EMAIL })
    ]));
    if (truncated) {
      box.appendChild(api.el('p', {
        class: 'feedback-truncated-note',
        text: 'The emailed copy was shortened. The copied version is complete.'
      }));
    }

    var copyBtn = api.el('button', { type: 'button', class: 'btn-secondary', text: 'Copy report' });
    var closeBtn = api.el('button', { type: 'button', text: 'Close' });
    var actions = api.el('div', { class: 'modal-actions' }, [copyBtn, closeBtn]);
    var reportText = subject + '\n\n' + fullBody;

    copyBtn.addEventListener('click', function () {
      copyText(reportText, copyBtn, box);
    });
    closeBtn.addEventListener('click', function () {
      api.close();
    });

    box.appendChild(actions);
  }

  function open() {
    if (!window.HRP_MODAL || typeof window.HRP_MODAL.open !== 'function') return;

    window.HRP_MODAL.open({
      title: 'Send feedback',
      titleId: 'feedback-modal-title',
      build: function (box, api) {
        var rating = 0;
        var lastErrorOn = null;
        var starButtons = [];
        var i;

        box.appendChild(api.el('p', {
          class: 'feedback-intro',
          text: 'Feedback goes to the Homerun Baseball Ottawa team. Pressing Send opens your email app with the message already written, ready to send.'
        }));

        var group = api.el('div', {
          class: 'star-rating',
          role: 'radiogroup',
          'aria-label': 'Overall rating'
        });
        for (i = 1; i <= 5; i++) {
          (function (value) {
            var btn = api.el('button', {
              type: 'button',
              class: 'star-btn',
              role: 'radio',
              'aria-checked': 'false',
              'aria-label': starAriaLabel(value),
              'data-value': String(value),
              text: '★'
            });
            btn.tabIndex = value === 1 ? 0 : -1;
            btn.addEventListener('click', function () {
              setRating(value);
            });
            starButtons.push(btn);
            group.appendChild(btn);
          }(i));
        }

        var ratingLabel = api.el('span', { class: 'star-rating-label', text: 'Not rated' });

        function setRating(next) {
          var n;
          rating = next;
          for (n = 0; n < starButtons.length; n++) {
            var val = n + 1;
            var selected = rating === val;
            if (rating > 0 && val <= rating) {
              starButtons[n].classList.add('star-on');
            } else {
              starButtons[n].classList.remove('star-on');
            }
            starButtons[n].setAttribute('aria-checked', selected ? 'true' : 'false');
            starButtons[n].tabIndex = (rating > 0 ? selected : val === 1) ? 0 : -1;
          }
          if (rating === 0) {
            ratingLabel.textContent = 'Not rated';
          } else {
            ratingLabel.textContent = rating + ' out of 5';
          }
        }

        group.addEventListener('keydown', function (e) {
          var key = e.key;
          var next = rating;
          if (key === 'ArrowRight' || key === 'ArrowUp') {
            next = rating < 1 ? 1 : Math.min(5, rating + 1);
          } else if (key === 'ArrowLeft' || key === 'ArrowDown') {
            next = rating < 1 ? 1 : Math.max(1, rating - 1);
          } else if (key === 'Home') {
            next = 1;
          } else if (key === 'End') {
            next = 5;
          } else if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
            var focused = document.activeElement;
            var raw = focused && focused.getAttribute('data-value');
            if (raw) next = parseInt(raw, 10);
          } else {
            return;
          }
          e.preventDefault();
          if (!next || isNaN(next)) next = 1;
          setRating(next);
          if (starButtons[next - 1]) starButtons[next - 1].focus();
        });

        box.appendChild(api.el('div', { class: 'feedback-rating' }, [group, ratingLabel]));

        var catLabelEl = api.el('label', { for: 'feedback-category', text: 'What is this about?' });
        var categoryEl = api.el('select', { id: 'feedback-category' });
        for (i = 0; i < CATEGORIES.length; i++) {
          var optAttrs = {
            value: CATEGORIES[i].value,
            text: CATEGORIES[i].label
          };
          if (i === 0) {
            optAttrs.disabled = true;
            optAttrs.selected = true;
          }
          categoryEl.appendChild(api.el('option', optAttrs));
        }

        var drillNameLabel = api.el('label', { for: 'feedback-drill-name', text: 'Drill name' });
        var drillNameEl = api.el('input', { type: 'text', id: 'feedback-drill-name' });

        var drillVideoLabel = api.el('label', { for: 'feedback-drill-video', text: 'Link to a YouTube demo (optional)' });
        var drillVideoEl = api.el('input', {
          type: 'text',
          id: 'feedback-drill-video',
          placeholder: 'https://www.youtube.com/watch?v=…'
        });

        var drillFieldsWrap = api.el('div', { class: 'feedback-drill-fields hidden' }, [
          api.el('div', { class: 'feedback-field' }, [drillNameLabel, drillNameEl]),
          api.el('div', { class: 'feedback-field' }, [drillVideoLabel, drillVideoEl])
        ]);
        drillFieldsWrap.classList.toggle('hidden', categoryEl.value !== 'suggest-drill');

        var detailsLabel = api.el('label', { for: 'feedback-details', text: 'Describe the issue or idea' });
        var detailsEl = api.el('textarea', {
          id: 'feedback-details',
          rows: 6,
          maxLength: DETAILS_MAX,
          placeholder: 'What you were doing, what you expected, and what happened instead.'
        });
        var counterEl = api.el('span', { class: 'feedback-counter', text: '0 / ' + DETAILS_MAX });
        detailsEl.addEventListener('input', function () {
          var len = detailsEl.value.length;
          counterEl.textContent = len + ' / ' + DETAILS_MAX;
          maybeClearError();
        });
        drillNameEl.addEventListener('input', maybeClearError);
        drillVideoEl.addEventListener('input', maybeClearError);

        var errorEl = api.el('p', { class: 'feedback-error hidden', role: 'alert' });

        function showError(msg, field) {
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
          lastErrorOn = field;
          if (field === 'category') categoryEl.focus();
          else if (field === 'drillName') drillNameEl.focus();
          else if (field === 'drillVideo') drillVideoEl.focus();
          else detailsEl.focus();
        }

        function maybeClearError() {
          if (lastErrorOn === 'category' && categoryEl.value) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
            lastErrorOn = null;
          } else if (lastErrorOn === 'details' && trim(detailsEl.value)) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
            lastErrorOn = null;
          } else if (lastErrorOn === 'drillName' && trim(drillNameEl.value)) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
            lastErrorOn = null;
          } else if (lastErrorOn === 'drillVideo') {
            var videoVal = trim(drillVideoEl.value);
            if (!videoVal || videoVal.indexOf('http://') === 0 || videoVal.indexOf('https://') === 0) {
              errorEl.textContent = '';
              errorEl.classList.add('hidden');
              lastErrorOn = null;
            }
          }
        }

        categoryEl.addEventListener('change', function () {
          drillFieldsWrap.classList.toggle('hidden', categoryEl.value !== 'suggest-drill');
          maybeClearError();
        });

        var cancelBtn = api.el('button', { type: 'button', class: 'btn-secondary', text: 'Cancel' });
        var sendBtn = api.el('button', { type: 'submit', text: 'Send feedback' });
        cancelBtn.addEventListener('click', function () {
          api.close();
        });

        var form = api.el('form', { class: 'feedback-form' }, [
          api.el('div', { class: 'feedback-field' }, [catLabelEl, categoryEl]),
          drillFieldsWrap,
          api.el('div', { class: 'feedback-field' }, [detailsLabel, detailsEl, counterEl]),
          errorEl,
          api.el('div', { class: 'modal-actions' }, [cancelBtn, sendBtn])
        ]);

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!categoryEl.value) {
            showError('Please choose what your feedback is about.', 'category');
            return;
          }
          if (categoryEl.value === 'suggest-drill') {
            if (!trim(drillNameEl.value)) {
              showError('Please enter the name of the drill you\'d like added.', 'drillName');
              return;
            }
            var drillVideoCheck = trim(drillVideoEl.value);
            if (drillVideoCheck && drillVideoCheck.indexOf('http://') !== 0 && drillVideoCheck.indexOf('https://') !== 0) {
              showError('Please enter a valid video link starting with http:// or https://, or leave it blank.', 'drillVideo');
              return;
            }
          } else {
            var detailsRequired = trim(detailsEl.value);
            if (!detailsRequired) {
              showError('Please describe the issue or idea so we can act on it.', 'details');
              return;
            }
          }

          var details = trim(detailsEl.value);
          if (categoryEl.value === 'suggest-drill') {
            var drillName = trim(drillNameEl.value);
            var drillVideo = trim(drillVideoEl.value);
            var suggestion = 'Suggested drill: ' + drillName + '\n' +
              'Demo video: ' + (drillVideo || 'not provided');
            details = details ? (suggestion + '\n\n' + details) : suggestion;
          }

          var catLabel = categoryLabel(categoryEl.value);
          var subject = buildSubject(catLabel, rating);
          var fullBody = buildBody(rating, catLabel, details);
          var mailBody = fullBody;
          var truncated = false;
          if (fullBody.length > MAIL_BODY_LIMIT) {
            truncated = true;
            mailBody = fullBody.substring(0, MAIL_BODY_LIMIT) + '\n' + TRUNCATE_NOTE;
          }
          var mailtoUrl = 'mailto:' + FEEDBACK_EMAIL +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(mailBody);
          try {
            window.location.href = mailtoUrl;
          } catch (err) {}

          showConfirmation(box, api, subject, fullBody, truncated);
        });

        box.appendChild(form);
      }
    });
  }

  return {
    open: open
  };
}());
