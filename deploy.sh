#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

netlify deploy --prod --dir . \
  --message "$(git log -1 --pretty=%s 2>/dev/null || echo 'manual deploy')"
