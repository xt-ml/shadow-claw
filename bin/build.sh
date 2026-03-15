#!/usr/bin/env bash

# change directory to the project root
cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.." || exit 1

npm run test || exit 1

echo 'https://xt-ml.github.io/shadow-claw/' | node \
  bin/file-search-replace.mjs \
  'http://localhost:8888' \
  'manifest.json' || exit 1

echo 'base href="/shadow-claw/"' | node \
  bin/file-search-replace.mjs \
  'base href="/"' \
  'index.html' || exit 1

echo '#service-' | node \
  bin/file-search-replace.mjs \
  'service-' \
  '.gitignore' || exit 1

echo '#workbox-' | node \
  bin/file-search-replace.mjs \
  'workbox-' \
  '.gitignore' || exit 1

echo '// importScripts: [' | node \
  bin/file-search-replace.mjs \
  'importScripts: \[' \
  './service-worker/workbox-config.cjs' || exit 1

node bin/touch-nojekyll.mjs \
  && npm run build:pkg:meta "$(npm run -s build:pkg:get:meta)" \
  && npm run -s clean:service-worker \
  && npm run -s build:service-worker || exit 1
