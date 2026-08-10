N7-Code — Build 30

Hosted full-project runtime.

TESTING
- Double-clicking index.html still uses LOCAL MODE / the existing compatibility preview.
- For the new FULL PROJECT runtime, upload the entire build folder to GitHub Pages, including sw.js and vendor/.
- Open N7-Code over HTTPS, then open a real project folder.

The hosted runtime keeps project files local in the browser. It uses a service worker + Cache Storage to give folder projects stable virtual URLs under the editor's GitHub Pages scope. No backend or project upload is used.


Project backup format: .n7-code (legacy .mfcode files remain openable).
Automatic project switching no longer downloads backups; previous work is protected in browser storage unless it can be saved directly to its folder.
