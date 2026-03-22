#!/bin/sh
set -eu

normalize_base_path() {
  base_path="${1:-/}"

  if [ -z "$base_path" ] || [ "$base_path" = "/" ]; then
    printf '/'
    return
  fi

  case "$base_path" in
    /*) ;;
    *) base_path="/$base_path" ;;
  esac

  case "$base_path" in
    */) ;;
    *) base_path="$base_path/" ;;
  esac

  printf '%s' "$base_path"
}

escape_regex() {
  printf '%s' "$1" | sed 's/[][(){}.^$*+?|\\-]/\\&/g'
}

BASE_PATH="$(normalize_base_path "${APP_BASE_PATH:-${VITE_BASE_PATH:-/}}")"
CONFIG_PATH="/etc/nginx/conf.d/default.conf"

if [ "$BASE_PATH" = "/" ]; then
  cat > "$CONFIG_PATH" <<'EOF'
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF
else
  BASE_PATH_NO_SLASH="${BASE_PATH%/}"
  BASE_PATH_REGEX="$(escape_regex "$BASE_PATH")"

  cat > "$CONFIG_PATH" <<EOF
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location = / {
    return 308 ${BASE_PATH};
  }

  location = ${BASE_PATH_NO_SLASH} {
    return 308 ${BASE_PATH};
  }

  location ^~ ${BASE_PATH} {
    rewrite ^${BASE_PATH_REGEX}(.*)$ /\$1 break;
    try_files \$uri \$uri/ /index.html;
  }

  location / {
    return 404;
  }
}
EOF
fi
