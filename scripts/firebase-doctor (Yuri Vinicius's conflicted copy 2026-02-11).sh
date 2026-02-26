#!/usr/bin/env bash
set -euo pipefail

SELFHEAL="false"
OFFLINE="false"
if [[ "${1:-}" == "--selfheal" ]]; then
  SELFHEAL="true"
fi
if [[ "${1:-}" == "--offline" ]] || [[ "${2:-}" == "--offline" ]]; then
  OFFLINE="true"
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PROJECT_ID="miamialliance3pl"
if [[ -f .firebaserc ]]; then
  parsed="$(sed -n 's/.*"default"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .firebaserc | head -n1 || true)"
  if [[ -n "$parsed" ]]; then
    PROJECT_ID="$parsed"
  fi
fi

FAILS=0
WARNS=0

ok() { printf "[OK] %s\n" "$*"; }
warn() { printf "[WARN] %s\n" "$*"; WARNS=$((WARNS+1)); }
fail() { printf "[FAIL] %s\n" "$*"; FAILS=$((FAILS+1)); }

run_or_fail() {
  local desc="$1"
  shift
  if "$@"; then
    ok "$desc"
  else
    fail "$desc"
  fi
}

printf "Firebase Doctor\n"
printf "Project root: %s\n" "$PROJECT_ROOT"
printf "Project id: %s\n\n" "$PROJECT_ID"

# Repo layout compatibility:
# - Some checkouts place the MCP server in ./mcp/
# - This repo places it at the parent directory (../server.js)
MCP_SERVER_PATH="mcp/server.js"
MCP_PKG_PATH="mcp/package.json"
if [[ ! -f "$MCP_SERVER_PATH" && -f "../server.js" ]]; then
  MCP_SERVER_PATH="../server.js"
  MCP_PKG_PATH="../package.json"
fi
MCP_DIR="$(dirname "$MCP_PKG_PATH")"
MCP_LOCK_PATH="$MCP_DIR/package-lock.json"

# Required files
for f in firebase.json firestore.rules functions/index.js functions/package.json "$MCP_SERVER_PATH" "$MCP_PKG_PATH"; do
  if [[ -f "$f" ]]; then
    ok "file present: $f"
  else
    fail "file missing: $f"
  fi
done

# Firebase CLI installation
if command -v firebase >/dev/null 2>&1; then
  # firebase-tools uses configstore (XDG_CONFIG_HOME). In sandboxed environments,
  # $HOME/.config may be unwritable, causing firebase to exit non-zero even for --version.
  export NO_UPDATE_NOTIFIER="${NO_UPDATE_NOTIFIER:-1}"
  firebase_version=""
  if firebase_version_raw="$(firebase --version 2>&1)"; then
    firebase_version="$(printf "%s" "$firebase_version_raw" | head -n1)"
    ok "firebase CLI present (${firebase_version})"
  else
    warn "firebase CLI present but returned non-zero; retrying with local XDG_CONFIG_HOME"
    export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$PROJECT_ROOT/.tmp/xdg_config}"
    mkdir -p "$XDG_CONFIG_HOME"
    if firebase_version_raw="$(firebase --version 2>&1)"; then
      firebase_version="$(printf "%s" "$firebase_version_raw" | head -n1)"
      warn "using local XDG_CONFIG_HOME for firebase-tools ($XDG_CONFIG_HOME; global login may not be detected)"
      ok "firebase CLI present (${firebase_version})"
    else
      fail "firebase CLI present but unusable (try setting XDG_CONFIG_HOME to a writable path)"
    fi
  fi
else
  if [[ "$SELFHEAL" == "true" ]]; then
    warn "firebase CLI missing; installing firebase-tools@15.3.1"
    npm install -g firebase-tools@15.3.1 >/dev/null
    hash -r
    if command -v firebase >/dev/null 2>&1; then
      ok "firebase CLI installed ($(firebase --version 2>/dev/null || echo unknown))"
    else
      fail "firebase CLI install failed"
    fi
  else
    fail "firebase CLI missing (run with --selfheal)"
  fi
fi

# Ensure .firebaserc exists
if [[ ! -f .firebaserc ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    warn ".firebaserc missing; creating default mapping"
    cat > .firebaserc <<EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF
    ok ".firebaserc created"
  else
    fail ".firebaserc missing"
  fi
else
  ok ".firebaserc present"
fi

# Dependencies
if [[ -f functions/package-lock.json ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    (cd functions && npm ci >/dev/null)
    ok "functions dependencies installed"
  else
    [[ -d functions/node_modules ]] && ok "functions/node_modules present" || warn "functions/node_modules missing"
  fi
fi

if [[ -f "$MCP_LOCK_PATH" ]]; then
  if [[ "$SELFHEAL" == "true" ]]; then
    (cd "$MCP_DIR" && npm ci >/dev/null)
    ok "mcp dependencies installed"
  else
    [[ -d "$MCP_DIR/node_modules" ]] && ok "mcp node_modules present ($MCP_DIR/node_modules)" || warn "mcp node_modules missing ($MCP_DIR/node_modules)"
  fi
fi

# Syntax checks
if node --check functions/index.js >/dev/null 2>&1; then
  ok "functions/index.js syntax valid"
else
  fail "functions/index.js syntax invalid"
fi

if node --check "$MCP_SERVER_PATH" >/dev/null 2>&1; then
  ok "${MCP_SERVER_PATH} syntax valid"
else
  fail "${MCP_SERVER_PATH} syntax invalid"
fi

# Offline mode skips any checks that require outbound network / Firebase API.
if [[ "$OFFLINE" == "true" ]]; then
  warn "offline mode enabled; skipping firebase API auth + public endpoint checks"
  printf "\nSummary: fails=%d warns=%d\n" "$FAILS" "$WARNS"
  if (( FAILS > 0 )); then
    exit 1
  fi
  exit 0
fi

# Auth check
AUTH_OK="false"
if command -v firebase >/dev/null 2>&1; then
  login_output="$(firebase login:list 2>&1 || true)"
  if printf "%s" "$login_output" | grep -qi "No authorized accounts"; then
    warn "firebase has no authorized accounts"
  else
    ok "firebase login session present"
    # True auth check requires an API call
    if firebase functions:list --project "$PROJECT_ID" >/tmp/firebase_doctor_functions.$$ 2>&1; then
      ok "firebase API auth works (functions:list)"
      AUTH_OK="true"
    else
      warn "firebase logged-in state exists, but API auth failed (reauth may be required)"
    fi
  fi
fi

# Endpoint checks (public availability)
get_http_code() {
  local name="$1"
  local url="https://us-central1-${PROJECT_ID}.cloudfunctions.net/${name}"
  local code
  code="$(curl -s -o /tmp/firebase_doctor_endpoint.$$ -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  rm -f /tmp/firebase_doctor_endpoint.$$ || true
  printf "%s" "$code"
}

check_endpoint_any_http() {
  local name="$1"
  local code
  code="$(get_http_code "$name")"
  if [[ "$code" =~ ^[0-9]+$ ]] && (( code >= 200 && code <= 499 )); then
    ok "endpoint ${name} reachable (HTTP ${code})"
  else
    fail "endpoint ${name} unreachable (HTTP ${code})"
  fi
}

check_endpoint_not_404() {
  local name="$1"
  local code
  code="$(get_http_code "$name")"
  if [[ "$code" == "404" ]]; then
    fail "endpoint ${name} is NOT deployed (HTTP 404)"
    return
  fi
  if [[ "$code" =~ ^[0-9]+$ ]] && (( code >= 200 && code <= 499 )); then
    ok "endpoint ${name} reachable (HTTP ${code})"
  else
    fail "endpoint ${name} unreachable (HTTP ${code})"
  fi
}

# stripeWebhook typically returns 400 without signature when deployed
check_endpoint_any_http "stripeWebhook"
# These should be deployed and not return 404
check_endpoint_not_404 "portalChatWebhook"
check_endpoint_not_404 "whatsappWebhookEnhanced"

rm -f /tmp/firebase_doctor_login.$$ /tmp/firebase_doctor_functions.$$ 2>/dev/null || true

printf "\nSummary: fails=%d warns=%d\n" "$FAILS" "$WARNS"
if (( FAILS > 0 )); then
  exit 1
fi
exit 0
