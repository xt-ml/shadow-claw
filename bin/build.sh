#!/usr/bin/env bash

# change directory to the project root
cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.." || exit 1

npm run -s build:clean \
  && mkdir -p dist/public/assets \
  || exit 1


# production only (only icons and screenshots get copied,
# the rest of the assets are only used for local)
if [[ "${NODE_ENV}" == "production" ]]; then
  cp -R assets/icons dist/public/assets/ \
    && cp -R assets/screenshots dist/public/assets/
else
    cp -R assets dist/public/
fi

npm run -s rollup \
  && npm run -s tsc \
  || exit 1

# production only (only the manifest, index.html, and
# metadata are updated for gh-pages)
if [[ "${NODE_ENV}" == "production" ]]; then
  echo 'https://xt-ml.github.io/shadow-claw/' | node \
    bin/file-search-replace.mjs \
    'http://localhost:8888' \
    'dist/public/manifest.json' \
  || exit 1

  echo 'base href="/shadow-claw/"' | node \
    bin/file-search-replace.mjs \
    'base href="/"' \
    'dist/public/index.html' \
  || exit 1

  node bin/touch-nojekyll.mjs \
    && npm run -s build:pkg:meta "$(npm run -s build:pkg:get:meta)" \
    || exit 1
fi

# build the service worker (all environments)
npm run -s build:service-worker \
  || exit 1
