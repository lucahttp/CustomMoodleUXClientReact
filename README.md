
# Custom Moodle UX Client ReactJS

  


This project is a Chrome extension designed to facilitate the navigation and experience of students using Moodle at the UTN T.U.V.

It provides a user-friendly interface that includes a button to inject the new react client.
  
The extension is available for [Google Chrome](https://chrome.google.com/webstore/detail/mhmmdaloicjopkjdchmbopcfbjfdmjkn/preview?hl=es-419&authuser=0), 

[![](https://img.shields.io/chrome-web-store/v/mhmmdaloicjopkjdchmbopcfbjfdmjkn.svg?logo=google-chrome&style=flat)](https://chrome.google.com/webstore/detail/mhmmdaloicjopkjdchmbopcfbjfdmjkn/preview?hl=es-419&authuser=0) [![](https://img.shields.io/chrome-web-store/rating/mhmmdaloicjopkjdchmbopcfbjfdmjkn.svg?logo=google-chrome&style=flat)](https://chrome.google.com/webstore/detail/mhmmdaloicjopkjdchmbopcfbjfdmjkn/preview?hl=es-419&authuser=0) [![](https://img.shields.io/chrome-web-store/users/mhmmdaloicjopkjdchmbopcfbjfdmjkn.svg?logo=google-chrome&style=flat)](https://chrome.google.com/webstore/detail/mhmmdaloicjopkjdchmbopcfbjfdmjkn/preview?hl=es-419&authuser=0)



## Arquitectura Handoff Nativa: Rust Desktop Daemon

El procesamiento y sincronización profunda de descargas es gestionado por un daemon persistente offline en Rust (`pion-handoff-rust`). La extensión Chrome se conecta al daemon vía **Socket.io** y despacha recursos bajo **dos colas asíncronas separadas**:

1. **Download Queue (I/O Bound):**
   - Descarga videos de YouTube vía `yt-dlp` (Thread Spawns).
   - Recibe contenido enviado por la extensión Chrome (que sí tiene las cookies de sesión Moodle).
   - Almacena archivos en la `Boveda/` local, organizada jerárquicamente por curso y tipo.

2. **Transcription Queue (CPU Bound):**
   Aislada del IO, esta cola invoca motores de IA offline:
   - Ejecuta Whisper nativo (`transcribe-rs`) a nivel CPU/GPU.
   - Actualiza la base SQLite FTS5 (`moodle_boveda.db`) con índices BM25 para búsqueda full-text.

> **Nota:** El daemon Rust **no puede** descargar recursos autenticados de Moodle directamente (cookies HttpOnly). La extensión Chrome — que sí posee la sesión activa — es la responsable de hacer el `fetch()` y enviar los bytes al daemon.

![button to inject the code](https://i.imgur.com/2DDN7rl.png)

Here you can see all your classes
<img width="2878" height="1744" alt="image" src="https://github.com/user-attachments/assets/3ca7ebc9-c6d7-4e8f-a700-46f93c1fb023" />
all the material of a class
<img width="2880" height="1740" alt="image" src="https://github.com/user-attachments/assets/e2da61c7-0a24-4ab8-b74f-02b3fe1eca48" />
and even read the material
<img width="2880" height="1730" alt="image" src="https://github.com/user-attachments/assets/3656bf0e-d2b0-4148-8f3f-fc0aaa5326ab" />




and plus (in argentinian la yapa)
for the ios phone on safari

<img width="auto" height="500" alt="image" src="https://github.com/user-attachments/assets/75769874-47d3-46d7-b7b7-95958aee3d7a" />
<img width="auto" height="500" alt="image" src="https://github.com/user-attachments/assets/f8612094-a00f-4e86-a4dc-1141ac375a63" />



## Features

  

-  **SeesionKey Extraction**: A requirement to interact with the service API from the extension.

-  **HTML React Injection**: Automatically adds the new html code, enabling users to have a nicer experience.

-  **Hapiness**: by avoiding using the original moodle UI people have experimented an incrsement in hapiness

  



## Installation

  

1. Clone the repository:

```bash

git clone CustomMoodleUXClientReact

cd CustomMoodleUXClientReact

```

  

2. Install dependencies:

```bash

npm install

```

  

3. Build the project:

```bash

npm run build

```
for Safari IOS/MacOS you need also to run. src: https://developer.apple.com/news/?id=qiz0arxc

```bash

xcrun safari-web-extension-converter ./dist

```


  

4. Load the extension in Chrome:

- Open Chrome and navigate to `chrome://extensions/`.

- Enable "Developer mode".

- Click "Load unpacked" and select the `dist` folder.

  

## Usage

  

- Click on the "Inject Code" iconn button in the Chrome tab to start the magic.

- Refresh your tab to remove all the injected stuff (if you want to remove everything completely you need to uninstall the extension).

  

## Contributing

  

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

  

## License

  

This project is licensed under the MIT License. See the LICENSE file for details.
