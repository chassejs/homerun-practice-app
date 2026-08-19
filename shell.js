/* ===================================================================
   Homerun Practice — shell.js
   Minimal page shell: nav tab switching between the Practice Planner
   and Help & Guide views. No state, no storage — practice.js owns
   everything inside #view-planner.
   =================================================================== */

(function () {
  'use strict';

  function showView(viewName) {
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === viewName);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
      v.classList.toggle('active', v.id === 'view-' + viewName);
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (btn) {
      btn.addEventListener('click', function () { showView(btn.getAttribute('data-view')); });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
}());
