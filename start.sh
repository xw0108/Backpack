#!/usr/bin/env bash
# ============================================================
#  Backpack gesture → drone control — single start command.
#
#    ./start.sh              test mode: gestures recognised, nothing flown
#    ./start.sh --live       real flight (needs ./install.sh --live)
#
#  One process serves both the web UI and the API on :8000.
#  Open http://localhost:8000 → Simulator → Drone Control.
#
#  Extra knobs (see server/config.py):
#    CAMERA_SOURCE=server ./start.sh     backend opens /dev/videoN instead
#    GESTURE_ROOT=/path/to/high_school_io_2025 ./start.sh
#    PORT=9000 ./start.sh
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${VENV_DIR:-$HOME/.venvs/backpack-gesture}"

for arg in "$@"; do
    case "$arg" in
        --live) export RUN_MODE=live ;;
        --test) export RUN_MODE=test ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

if [[ ! -x "$VENV/bin/python" ]]; then
    echo "No virtualenv at $VENV — run ./install.sh first."
    exit 1
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"

export RUN_MODE="${RUN_MODE:-test}"
export CAMERA_SOURCE="${CAMERA_SOURCE:-browser}"
PORT="${PORT:-8000}"

# Preflight: the gesture project is gitignored, so it is absent from a fresh
# clone or a downloaded ZIP.  Catch that here rather than letting the detector
# die on an unexplained "No module named 'utils'".
GESTURE_DIR="${GESTURE_ROOT:-$REPO_ROOT/high_school_io_2025}"
MISSING=()
[[ -d "$GESTURE_DIR/dynamic_gestures/utils" ]] || MISSING+=("dynamic_gestures/utils")
[[ -f "$GESTURE_DIR/dynamic_gestures/models/hand_detector.onnx" ]] || MISSING+=("models/hand_detector.onnx")
[[ -f "$GESTURE_DIR/dynamic_gestures/models/crops_classifier.onnx" ]] || MISSING+=("models/crops_classifier.onnx")
[[ -f "$GESTURE_DIR/actions.json" ]] || MISSING+=("actions.json")

if [[ ${#MISSING[@]} -gt 0 ]]; then
    cat >&2 <<EOF
The gesture project is missing, so the detector cannot start.

  Looked in : $GESTURE_DIR
  Not found : ${MISSING[*]}

That directory is gitignored — it is NOT in a clone or a downloaded ZIP.
install.sh clones it together with the pretrained ONNX models.

  Fix:  ./install.sh --live        (safe to re-run; finished steps are skipped)

  Or point at an existing copy:
        GESTURE_ROOT=/path/to/high_school_io_2025 ./start.sh
EOF
    exit 1
fi

if [[ ! -f "$REPO_ROOT/dist/index.html" ]]; then
    echo "! dist/ is missing — the API will run but there is no web UI."
    echo "  Build it with:  npm install && npm run build"
    echo
fi

if [[ "$RUN_MODE" == "live" ]]; then
    if ! python -c "import olympe" >/dev/null 2>&1; then
        echo "RUN_MODE=live needs parrot-olympe. Run: ./install.sh --live"
        exit 1
    fi
    cat <<'EOF'

  ┌──────────────────────────────────────────────────────────┐
  │  LIVE MODE — this can move a real aircraft.              │
  │                                                          │
  │  Gestures are still refused until you press Arm in the   │
  │  web UI and confirm. Clear the area before arming.       │
  └──────────────────────────────────────────────────────────┘

EOF
fi

echo "  → http://localhost:${PORT}   (Simulator → Drone Control)"
echo

cd "$REPO_ROOT/server"
exec python -m uvicorn main:app --host "${HOST:-0.0.0.0}" --port "$PORT"
