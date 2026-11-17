#!/usr/bin/env sh
# Builds the demo site and publishes it to the gh-pages branch (GitHub Pages serves that branch).
# Run from the repo root: sh web/deploy-demo.sh
set -e
cd "$(dirname "$0")"
npm run build:pages
touch dist-pages/.nojekyll
REMOTE=$(git -C .. remote get-url origin)
cd dist-pages
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C ../.. config user.name)" -c user.email="$(git -C ../.. config user.email)" \
  commit -q -m "Demo site build"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Published. Live in about a minute."
