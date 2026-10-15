# Corta

**Abrí un audio. Marcá el recorte. Escuchá. Guardá.**

Un trimmer de audio minimalista para Windows, hecho en Electron y FFmpeg. Funciona localmente, sin subir tus archivos.

[Descargar para Windows](https://github.com/mehLabs/corta/releases/latest) · [English](README.md) · [Contribuir](CONTRIBUTING.md)

![Selección de audio en Corta](docs/screenshot.png)

## Usar

1. Descargá `Corta-1.0.0-windows-x64.zip` de [Releases](https://github.com/mehLabs/corta/releases).
2. Extraé toda la carpeta y abrí **Corta.exe**. No necesitás instalar Node ni FFmpeg.
3. Abrí o arrastrá un audio, mové los extremos violetas, reproducí la selección y guardá.

Para reemplazar el original, elegí ese archivo al guardar y aceptá la confirmación de Windows. Podés seguir recortando: los tiempos siguen refiriéndose al audio cargado al principio.

El switch **ES / EN** cambia el idioma al instante, recuerda la elección y conserva la selección y la reproducción. También podés escribir tiempos exactos.

- `Ctrl+O`: abrir audio.
- `Espacio`: reproducir o pausar. `Escape`: detener.
- Flechas sobre un extremo: ajustar 0,01 segundos; con `Shift`, 1 segundo.

Windows 10 / 11 de 64 bits. Conservá todos los archivos junto al ejecutable.

Abre MP3, WAV, M4A, AAC, FLAC, OGG, OPUS, WMA, AIFF y otros formatos compatibles con FFmpeg. Guarda MP3, WAV, FLAC, M4A, OGG y OPUS. El recorte se vuelve a codificar para respetar los tiempos; los formatos con pérdida agregan una nueva pasada de compresión.

La vista previa temporal ocupa unos 10 MB por minuto. Al reemplazar el original se crea también una copia de trabajo. Se borran al cerrar normalmente.

## Cambiar los textos

Editá **textos.json**, junto al ejecutable, y reiniciá. Las traducciones están en `locales.es` y `locales.en`. Conservá las claves y los marcadores `{name}`, `{format}`, `{duration}` y `{value}`.

`defaultLanguage` define el idioma inicial; una elección guardada del switch tiene prioridad. Los botones nativos de Windows y mensajes técnicos de FFmpeg pertenecen a esos componentes.

Para contribuir traducciones, editá [`src/textos.json`](src/textos.json) y mantené las mismas claves en ambos idiomas.

## Desarrollar

Necesitás Windows x64, Node.js 22+ y npm. La instalación usa `tar.exe`, incluido en Windows, para extraer FFmpeg.

```powershell
git clone https://github.com/mehLabs/corta.git
cd corta
npm ci
npm run setup:ffmpeg
npm start
```

FFmpeg y las dependencias tienen versiones fijas. El setup verifica SHA-256 del archivo descargado y del ejecutable. Los binarios generados no se suben a Git.

```powershell
npm run check
npm test
npm run dist
npm run test:ui
```

El portable queda en `dist/Corta` y el ZIP en `dist/Corta-1.0.0-windows-x64.zip`. Las pruebas de interfaz usan la app empaquetada: ejecutá `npm run dist` primero.

El [README en inglés](README.md) describe la estructura y las variables para usar ejecutables propios. Leé [CONTRIBUTING.md](CONTRIBUTING.md) para colaborar. Se aceptan reportes y pull requests en español o inglés.

## Licencia

Apache 2.0, como la licencia original del repositorio. Electron y FFmpeg conservan sus licencias; ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
