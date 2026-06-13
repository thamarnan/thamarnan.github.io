# EinsumOS

EinsumOS is a static GitHub Pages desktop shell that opens project sites through a retro desktop interface. It has desktop shortcuts, a Start menu, draggable windows, taskbar buttons, themes, and iframe-based project launchers.

The visual style is nostalgic but uses original assets and CSS, not Microsoft-owned wallpapers, logos, or icons.

## Recommended GitHub Layout

Use one repo for the desktop shell and one repo per serious project:

```txt
YOUR_GITHUB_USERNAME.github.io/   # this EinsumOS site
weather-app/                     # project site at /weather-app/
kanban-app/                      # project site at /kanban-app/
shader-lab/                      # project site at /shader-lab/
```

If your GitHub username is `alice`, this repo should normally be named:

```txt
alice.github.io
```

Then the EinsumOS URL becomes:

```txt
https://alice.github.io
```

Each project repo can publish its own GitHub Pages site:

```txt
https://alice.github.io/weather-app/
https://alice.github.io/kanban-app/
```

## Editing Projects

Edit [data/projects.js](data/projects.js). Replace `YOUR_GITHUB_USERNAME`, update the owner block, then add one entry per app:

```js
{
  id: "weather-app",
  title: "Weather App",
  category: "Applications",
  type: "project",
  icon: "sun",
  accent: "#f2b636",
  showOnDesktop: true,
  summary: "A forecast dashboard with saved locations and responsive charts.",
  url: "https://YOUR_GITHUB_USERNAME.github.io/weather-app/",
  repo: "https://github.com/YOUR_GITHUB_USERNAME/weather-app",
  launchMode: "window",
  window: {
    viewport: {
      width: 480,
      height: 800
    },
    autoFit: true
  }
}
```

Use `launchMode: "window"` for iframe windows. Use `launchMode: "tab"` for apps that need the full browser window or refuse iframe embedding.

The `window.viewport` size is the app viewport size. EinsumOS adds the titlebar and border around it. `autoFit: true` lets the shell try to resize after the iframe loads, but this only works when browser same-origin rules allow the shell to inspect the app page. The manifest/config size is the reliable path.

If the app HTML has default body margin, include that in the viewport size or remove the margin in the app. For example, an app with a `480 x 800` root element and the browser's default `8px` body margin needs a `496 x 816` iframe viewport unless the app sets `body { margin: 0; }`.

## Adding The Next Project

1. Create a separate public repo, for example `notes-app`.
2. Make sure the repo has an `index.html` at the publish root, or configure its build to output one.
3. Enable GitHub Pages for that repo from `Settings` -> `Pages`.
4. Confirm the project URL works, for example `https://YOUR_GITHUB_USERNAME.github.io/notes-app/`.
5. Add a new object to `window.EINSUMOS_PROJECTS` in [data/projects.js](data/projects.js):

```js
{
  id: "notes-app",
  title: "Notes",
  category: "Applications",
  type: "project",
  icon: "doc",
  accent: "#2c9b54",
  showOnDesktop: true,
  summary: "Short project description.",
  url: "https://YOUR_GITHUB_USERNAME.github.io/notes-app/",
  repo: "https://github.com/YOUR_GITHUB_USERNAME/notes-app",
  launchMode: "window",
  window: {
    viewport: {
      width: 900,
      height: 620
    },
    autoFit: true
  }
}
```

Use the app's natural viewport size. For small portrait apps, use something like `480 x 800`. For dashboard-style apps, use something like `1000 x 700`.

## Custom App Icons

The simplest reliable icon path is a square transparent PNG or WebP stored in this repo:

```txt
assets/icons/notes.png
```

Then reference it from the project entry:

```js
{
  id: "notes-app",
  title: "Notes",
  iconUrl: "assets/icons/notes.png",
  url: "https://YOUR_GITHUB_USERNAME.github.io/notes-app/",
  repo: "https://github.com/YOUR_GITHUB_USERNAME/notes-app"
}
```

Use `64 x 64` or `96 x 96` for pixel-art icons. Use `128 x 128` or larger for smoother modern icons. Keep the background transparent and avoid tiny text inside the icon.

## Optional Dynamic Manifests

For later automation, each project repo can publish a manifest at the project site's published root:

```txt
https://YOUR_GITHUB_USERNAME.github.io/weather-app/einsumos.manifest.json
```

For Vite/React projects, place that file in `public/einsumos.manifest.json`. For a plain static repo, place it next to `index.html`.

Example:

```json
{
  "id": "weather-app",
  "title": "Weather App",
  "category": "Applications",
  "type": "project",
  "icon": "sun",
  "accent": "#f2b636",
  "showOnDesktop": true,
  "summary": "A forecast dashboard with saved locations and responsive charts.",
  "url": "/weather-app/",
  "repo": "https://github.com/YOUR_GITHUB_USERNAME/weather-app",
  "launchMode": "window",
  "window": {
    "viewport": {
      "width": 480,
      "height": 800
    },
    "autoFit": true,
    "fitSelector": "#app"
  }
}
```

Then add the manifest URL in [data/projects.js](data/projects.js):

```js
window.EINSUMOS_MANIFESTS = [
  "/weather-app/einsumos.manifest.json"
];
```

The shell loads those manifests in the browser and merges them into the Start menu and desktop.

## GitHub Pages Deployment

This project is static HTML, CSS, and JavaScript. There is no build step.

Recommended setup:

1. Push this repo to GitHub as `YOUR_GITHUB_USERNAME.github.io`.
2. Go to repo `Settings` -> `Pages`.
3. Set the source to `Deploy from a branch`.
4. Select branch `main` and folder `/ root`.
5. Push to `main`.

GitHub Pages will publish the static files from the repository root.

## Local Preview

You can open [index.html](index.html) directly in a browser, or serve the folder:

```sh
python3 -m http.server 8080
```

Then visit:

```txt
http://localhost:8080
```
