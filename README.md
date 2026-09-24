# ATHLETE Project Page

Project website for ATHLETE, built with the standard GitHub Pages Cayman theme.

Website: https://hazintihoa.github.io/athlete.github.io/

## Editing

- Edit `index.md` to update the project description and links.
- Edit `_config.yml` to change the title, description, and theme settings.
- Add images, videos, and other public project assets as needed.

## Publishing

In the repository settings, select **Pages → Deploy from a branch → main → / (root)**.

GitHub Pages rebuilds the site after changes are committed to `main`.

## Interactive Rally Demo

Both the GitHub Pages homepage (`index.md`) and anonymous static homepage
(`index.html`) link to `./rally/`. This relative link keeps anonymous visitors
on their current host. The demo runs MuJoCo, ONNX policy inference, and rendering
in the visitor's browser; there is no inference server or analytics endpoint.

The demo includes ball dragging, serve controls, auto-serve, robot reset,
real-time ball speed and an 8 m/s physical ball-speed cap. The cap changes
trajectories above that speed. This is an interactive illustration, not a
success-rate benchmark or hardware validation tool.

### Rebuild

```bash
cd rally-src
npm ci
npm run build
```

The build restores the exact meshes/policy from the existing packed deployment.
Development sources live in `rally-src/`; publishable artifacts live in `rally/`.
Python reference observation/action frames are included for numerical checks:
open `rally/?verify=1` to validate all 32 frames in the browser.

### Anonymous hosting compatibility

Anonymous GitHub serves project documents with an opaque-origin CSP sandbox.
The build preserves that sandbox. Classic scripts load losslessly compressed
resources from the same host; a classic Blob worker runs the bundled engines
with in-memory WASM/model assets. No CORS bypass, same-origin permission,
external identity-bearing host, or third-party model CDN is required.
Hex encoding avoids textual identity anonymization altering encoded binary data.
The compressed payload is about 17.1 MB before hex transport encoding; actual
network transfer depends on the host's HTTP compression. The page downloads
these resources only after the visitor opens the demo.

Anonymous GitHub may cache an earlier repository commit. A successful GitHub
Pages update does not itself prove that the anonymous mirror has refreshed.

Third-party licenses are included in `rally/licenses/`.
