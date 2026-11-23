#!/usr/bin/env bash
# Replaces the placeholders in this project with your real domain, email and name.
# Usage: ./set-domain.sh example.com you@example.com "Your Name"
set -e
if [ $# -lt 3 ]; then
  echo 'Usage: ./set-domain.sh example.com you@example.com "Your Name"'
  exit 1
fi
DOMAIN="$1"; EMAIL="$2"; NAME="$3"
FILES=$(grep -rlE "YOUR-DOMAIN\.com|YOUR-EMAIL@YOUR-DOMAIN\.com|YOUR-NAME" --include=*.html --include=*.xml --include=*.txt --include=*.js . | grep -v node_modules || true)
for f in $FILES; do
  sed -i.bak "s|YOUR-EMAIL@YOUR-DOMAIN\.com|$EMAIL|g; s|YOUR-DOMAIN\.com|$DOMAIN|g; s|YOUR-NAME|$NAME|g" "$f" && rm -f "$f.bak"
done
echo "Updated:"; echo "$FILES"
