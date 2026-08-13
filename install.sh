#!/usr/bin/env bash
# ============================================================
#  Backpack gesture → drone control — one-shot installer (Linux)
#
#    git clone https://github.com/xw0108/Backpack.git
#    cd Backpack
#    ./install.sh --live       # everything, including real flight support
#    ./start.sh                # → http://localhost:8000
#
#  Flags
#    --live          also install SoftwarePilot / parrot-olympe (needed to fly)
#    --no-frontend   skip npm install + vite build (API only)
#
#  Safe to re-run; every step is skipped if already done.
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${VENV_DIR:-$HOME/.venvs/backpack-gesture}"
GESTURE_DIR="${GESTURE_ROOT:-$REPO_ROOT/high_school_io_2025}"

# The gesture project and the pretrained models live in two upstream repos.
GESTURE_REPO="https://github.com/ICICLE-ai/high_school_io_2025.git"
MODELS_REPO="https://github.com/ai-forever/dynamic_gestures.git"
# high_school_io_2025 records dynamic_gestures as a gitlink but ships no
# .gitmodules, so `git submodule update --init` cannot resolve it.  Pin the
# commit it points at and clone it ourselves.
MODELS_COMMIT="f073b2541ad53863ea2935498342cec0d3e1ce73"

WITH_LIVE=0
WITH_FRONTEND=1
for arg in "$@"; do
    case "$arg" in
        --live)        WITH_LIVE=1 ;;
        --no-frontend) WITH_FRONTEND=0 ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[0;32m✓\033[0m %s\n' "$*"; }
warn(){ printf '    \033[0;33m!\033[0m %s\n' "$*"; }

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This installer targets Linux. parrot-olympe has no Windows/macOS build."
    exit 1
fi

# ── 1. System packages ───────────────────────────────────────
say "System packages"
sudo apt-get update -qq
sudo apt-get install -y -qq \
    git curl ca-certificates \
    python3 python3-venv python3-dev \
    libglib2.0-0 libgomp1 \
    v4l-utils
ok "apt packages installed"

# python3.10 is what parrot-olympe 7.5.0 is exercised against; use it when the
# distro provides it, otherwise fall back to whatever python3 is.
if command -v python3.10 >/dev/null 2>&1; then
    PYTHON=python3.10
    sudo apt-get install -y -qq python3.10-venv python3.10-dev
else
    PYTHON=python3
    warn "python3.10 not available; using $($PYTHON --version). olympe is only"
    warn "validated on 3.9-3.10 — if live mode misbehaves, install python3.10."
fi
ok "interpreter: $($PYTHON --version)"

# ── 2. Gesture project + pretrained models ───────────────────
say "Gesture project and ONNX models"
if [[ -d "$GESTURE_DIR/.git" ]]; then
    ok "already present at $GESTURE_DIR"
else
    git clone --depth 1 "$GESTURE_REPO" "$GESTURE_DIR"
    ok "cloned high_school_io_2025"
fi

MODELS_DIR="$GESTURE_DIR/dynamic_gestures"
if [[ -f "$MODELS_DIR/models/hand_detector.onnx" ]]; then
    ok "ONNX models already present"
else
    # The directory exists as an empty gitlink after cloning; clear it first.
    rm -rf "$MODELS_DIR"
    git clone "$MODELS_REPO" "$MODELS_DIR"
    git -C "$MODELS_DIR" checkout --quiet "$MODELS_COMMIT"
    ok "cloned dynamic_gestures @ ${MODELS_COMMIT:0:8}"
fi

for f in models/hand_detector.onnx models/crops_classifier.onnx; do
    [[ -f "$MODELS_DIR/$f" ]] || { echo "MISSING: $MODELS_DIR/$f"; exit 1; }
done
[[ -f "$GESTURE_DIR/actions.json" ]] || { echo "MISSING: $GESTURE_DIR/actions.json"; exit 1; }
ok "models + actions.json verified"

# ── 3. Python environment ────────────────────────────────────
say "Python environment"
if [[ ! -x "$VENV/bin/python" ]]; then
    "$PYTHON" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install --upgrade pip wheel setuptools -q
pip install -q -r "$REPO_ROOT/server/requirements.txt"
ok "backend requirements installed"

if [[ $WITH_LIVE -eq 1 ]]; then
    pip install -q -r "$REPO_ROOT/server/requirements-live.txt"
    ok "SoftwarePilot + parrot-olympe installed"
else
    warn "test mode only. Re-run with --live to enable real flight."
fi

# ── 4. Frontend ──────────────────────────────────────────────
if [[ $WITH_FRONTEND -eq 1 ]]; then
    say "Frontend"
    NEED_NODE=1
    if command -v node >/dev/null 2>&1; then
        NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
        [[ "$NODE_MAJOR" -ge 18 ]] && NEED_NODE=0
    fi
    if [[ $NEED_NODE -eq 1 ]]; then
        warn "Node 18+ not found — installing Node 20 from NodeSource"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
    fi
    ok "node $(node --version)"

    cd "$REPO_ROOT"
    npm install --no-audit --no-fund
    npm run build
    ok "frontend built into dist/ — the backend serves it directly"
fi

# ── 5. Report ────────────────────────────────────────────────
say "Checks"
"$VENV/bin/python" - <<'PY'
import cv2, numpy, onnxruntime, scipy, filterpy, fastapi
print(f"    numpy {numpy.__version__} · opencv {cv2.__version__} · "
      f"onnxruntime {onnxruntime.__version__} · fastapi {fastapi.__version__}")
try:
    import olympe
    print("    parrot-olympe: installed (live mode available)")
except ImportError:
    print("    parrot-olympe: not installed (test mode only)")
PY

if ls /dev/video* >/dev/null 2>&1; then
    ok "camera device(s): $(ls /dev/video* | tr '\n' ' ')"
else
    warn "no /dev/video* — the browser can still supply the camera (default)"
fi

cat <<EOF

$(say "Done")
    Test mode (nothing is sent to an aircraft):
        ./start.sh

    Real flight:
        ./start.sh --live

    Then open http://localhost:8000 → Simulator → Drone Control.
EOF
