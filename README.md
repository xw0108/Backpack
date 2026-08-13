<div align="center">
</div>

# Backpack — user portal

Field-kit control centre, plus **gesture-controlled drone flight** driven
entirely from the web page: camera in the browser, hand-gesture recognition and
real flight commands on the backend.

## Quick start (Linux)

```bash
git clone https://github.com/xw0108/Backpack.git
cd Backpack
./install.sh --live
./start.sh --live
```

Open **http://localhost:8000** → *Simulator* → *Drone Control*.

Drop `--live` from both commands to run without any aircraft: gestures are still
recognised and every command is resolved and logged, just never sent.

`install.sh` is safe to re-run and handles system packages, Node, the Python
environment, and cloning the upstream gesture project together with its
pretrained ONNX models.

## Requirements

- **Linux x86_64.** `parrot-olympe`, which the flight layer wraps, has no Windows
  or macOS build. WSL2 works for development but cannot reach a USB-connected
  SkyController — see [server/README.md](server/README.md).
- A webcam, and a Parrot ANAFI if you want to fly.

## Flying safely

Live mode is gated in three ways, because a web page can now move a real
aircraft:

1. **Test is the default.** `--live` is opt-in on both scripts.
2. **Connected is not armed.** Gesture commands are refused until you press
   *Arm* in the UI and confirm. A stray hand in frame cannot fly anything.
3. **Emergency** cancels the move in flight, lands, and disarms — on a dedicated
   thread so it never waits behind a takeoff. It does not cut the motors.

The gesture → command map comes from the gesture project's `actions.json`, so
this UI and the standalone `main.py` cannot drift apart. Full architecture,
configuration and troubleshooting: **[server/README.md](server/README.md)**.

## Frontend development

```bash
npm install
npm run dev      # :3000 with HMR, proxies /api to :8000
```

Run `./start.sh` alongside it for the backend.
