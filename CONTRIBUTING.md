# Contributing to Corta

Thanks for helping keep audio trimming simple. Issues and pull requests in **English or Spanish** are welcome.

## Scope

Corta is for opening audio, choosing a range visually, listening, and saving. Favor small fixes and conventional Electron/JavaScript patterns. Discuss larger features in an issue before implementing them.

Useful contributions include reproducible bug reports, audio-format fixes, accessibility, ES/EN translations and interaction improvements that reduce friction.

## Setup and checks

Follow the development steps in [README.md](README.md), then create a branch:

```powershell
git switch -c fix/short-description
npm run check
npm test
```

For changes to rendering, file dialogs, playback or languages:

```powershell
npm run dist
npm run test:ui
```

The tests generate their own audio and use isolated Electron profiles. Generated files live under `work/`; dependencies, temporary files and release binaries stay out of Git.

## Implementation notes

- Keep the renderer sandboxed and context isolation enabled. Expose only specific operations through the preload bridge.
- Put all application-owned copy in `src/textos.json`; keep ES/EN keys in sync and preserve interpolation markers.
- Do not change the selection or restart playback just to change labels.
- Test exports against actual decoded audio when timing or codecs change. Repeated saves over the original must use the loaded audio as the editing reference.
- Use argument arrays when invoking external processes; do not concatenate filenames into shell commands.
- Add tests for meaningful behavior changes. Fast syntax checks are enough for cosmetic changes; packaging is for release and packaged-app integration checks.

## Bug reports

Include the Corta version, Windows version, input format, steps to reproduce, expected result and actual result. A screenshot or a small audio sample you can share is helpful. Avoid uploading private audio.

## Pull requests

Explain the concrete user-visible change and why it is needed. Include relevant verification and a before/after screenshot for UI changes. Keep unrelated cleanup separate.

Contributions are made under the project's [Apache 2.0 license](LICENSE). Third-party code and binaries keep their respective licenses.
