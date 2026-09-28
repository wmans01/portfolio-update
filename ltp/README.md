# ltplayer

A small, dependency-free music player at `/ltp` on the portfolio website. It plays files shipped in `music/` and lets each visitor add their own files in the browser. The page is intentionally absent from site navigation. Its `noindex` directive discourages search indexing, but anyone with the URL can access it.

## Run locally

From the portfolio root, install dependencies and start Vite:

```sh
npm ci
npm run dev
```

Open <http://localhost:5173/ltp>. The command updates `library.json` before starting Vite. For the player's dependency-free standalone server, run `npm start` in this directory and open <http://localhost:4173/ltp/>.

## Add music and deploy

Put `.mp3` or `.mp4` files in `music/`; subfolders are allowed. The player reads MP3 title, artist, and album tags when available. Otherwise it uses a filename such as `Artist - Title.mp3` and the parent folder as the album. For MP4 files it uses the filename. Playback of MP4 audio depends on the browser supporting the file's codec.

After adding or changing files during development, run this from the portfolio root to refresh the library index:

```sh
npm run index:music
```

The root `npm run build` command also refreshes the index, builds `ltp/index.html` as a separate page, and copies `library.json` and `music/` into `dist/ltp/`. Deploy the root `dist/` directory. The static host should support byte-range requests for smooth seeking. Files placed in `music/` are accessible to visitors who can access the page.

Open **Uploads** to add MP3 and MP4 files from a visitor's device. Drag-and-drop also works. These files are stored in that browser's IndexedDB when space is available. They are never sent to the server and do not appear for other visitors. Playlists and settings also belong to that browser. If browser storage is full or unavailable, a new upload can still play until the page is closed.

## Controls

The central player has play/pause, skip, shuffle, repeat, seek, volume, and speed controls. Open **Library**, **Uploads**, or **Queue** from the top bar. The queue can be reordered with its move buttons. Song menus let you add tracks to playlists or the queue, move playlist tracks, and remove uploads. Press Space to play or pause, left/right arrows to seek five seconds, `M` to mute, and `/` to search in an open Library or Uploads menu. Media keys work where supported.

Open **Settings** for the theme and Visuals toggle. The record and audio spectrum appear only when Visuals are enabled. Animation runs only while music plays and the page is visible, and respects reduced-motion settings. The Jeremp0 theme uses `rgb(242, 239, 224)` as its page background and `rgb(36, 128, 115)` as its accent.
