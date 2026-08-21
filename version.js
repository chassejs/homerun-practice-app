/* ===================================================================
   Homerun Practice — version.js
   Single source of truth for all version constants.

   HOW TO UPDATE:
   - Bump APP_VERSION for any user-visible release (including cosmetic changes).
   - Bump DATA_VERSION only when the shape of the exported JSON changes
     in a way that could break a restore. See docs/VERSIONING.md.
   - Keep package.json "version" in sync with APP_VERSION (major.minor.0).
   =================================================================== */

// Expose on window so practice.js and versionCompat.js can read without ES modules.
window.HRP_VERSION = (function () {
  'use strict';

  // Human-facing release label shown in the UI and embedded in every backup.
  var APP_VERSION = '1.1';

  // Governs backup/restore compatibility. Incremented independently of
  // APP_VERSION when the exported JSON payload shape changes.
  var DATA_VERSION = '1.0';

  // The oldest DATA_VERSION this build can import (after migration chain).
  // Raise this when a breaking schema change makes older files unrestorable.
  var MIN_COMPATIBLE_DATA_VERSION = '1.0';

  return {
    APP_VERSION: APP_VERSION,
    DATA_VERSION: DATA_VERSION,
    MIN_COMPATIBLE_DATA_VERSION: MIN_COMPATIBLE_DATA_VERSION
  };
}());
