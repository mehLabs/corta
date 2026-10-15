# Third-party components

## Corta

Corta's application source is licensed under Apache-2.0; see [LICENSE](LICENSE).
The existing repository license is preserved.

## Electron 44.7.2

Electron is distributed under MIT and includes Chromium, Node.js and other
components with their own notices. The portable distribution retains Electron's
`LICENSE` and `LICENSES.chromium.html` files.

- Source and release: https://github.com/electron/electron/tree/v44.7.2
- License: https://github.com/electron/electron/blob/v44.7.2/LICENSE

## FFmpeg

Corta runs FFmpeg as a separate, unmodified executable. The bundled Windows
binary is Gyan Doshi's full build `2025-11-02-git-f5eb11a71d`, licensed under
GPL v3 or later. This license applies to that binary and its incorporated
components; it does not replace Corta's application source license.

- Exact binary release: https://github.com/GyanD/codexffmpeg/releases/tag/2025-11-02-git-f5eb11a71d
- FFmpeg source: https://github.com/FFmpeg/FFmpeg/tree/f5eb11a71d64660543809cbe2aa6c4d6f4aff96c
- Binary and archive checksums: [third_party/ffmpeg.json](third_party/ffmpeg.json)
- Build configuration and exact external library revisions: [third_party/FFmpeg-build-and-source.txt](third_party/FFmpeg-build-and-source.txt)
- Binary license: [third_party/FFmpeg-GPL-v3.txt](third_party/FFmpeg-GPL-v3.txt)
- Upstream build information and library links: https://www.gyan.dev/ffmpeg/builds/

The portable includes the full binary license and upstream build readme under
`licenses/`. Releases also provide the FFmpeg source archive for the exact
upstream revision. External library revisions are listed in the build readme;
those libraries retain their own licenses and upstream source locations.
