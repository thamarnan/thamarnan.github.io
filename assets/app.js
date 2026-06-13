(function () {
  "use strict";

  var owner = Object.assign(
    {
      name: "Your Name",
      role: "EinsumOS desktop",
      avatarInitials: "YN",
      github: "#",
      email: "",
      repo: "#"
    },
    window.EINSUMOS_OWNER || {}
  );

  var projects = normalizeProjects(window.EINSUMOS_PROJECTS || []);
  var windows = new Map();
  var zIndex = 40;
  var activeWindowId = null;
  var desktopMetrics = { nextOffset: 0 };

  var els = {
    boot: document.getElementById("boot-screen"),
    desktop: document.getElementById("desktop"),
    desktopIcons: document.getElementById("desktop-icons"),
    windowLayer: document.getElementById("window-layer"),
    startMenu: document.getElementById("start-menu"),
    startButton: document.getElementById("start-button"),
    startPrograms: document.getElementById("start-programs"),
    taskList: document.getElementById("task-list"),
    clock: document.getElementById("clock"),
    ownerAvatar: document.getElementById("owner-avatar"),
    ownerName: document.getElementById("owner-name"),
    ownerRole: document.getElementById("owner-role"),
    allProjectsButton: document.getElementById("all-projects-button"),
    contactButton: document.getElementById("contact-button"),
    githubLink: document.getElementById("github-link")
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    hydrateOwner();
    renderDesktopIcons();
    renderStartMenu();
    renderTasks();
    bindGlobalEvents();
    updateClock();
    setInterval(updateClock, 15000);
    loadRemoteManifests();

    window.setTimeout(function () {
      els.boot.classList.add("is-hidden");
    }, 900);
  }

  function hydrateOwner() {
    els.ownerAvatar.textContent = owner.avatarInitials || initials(owner.name);
    els.ownerName.textContent = owner.name;
    els.ownerRole.textContent = owner.role;
    els.githubLink.href = owner.github || "#";
  }

  function normalizeProjects(rawProjects) {
    var seen = new Set();
    return rawProjects
      .filter(Boolean)
      .map(function (project) {
        var normalized = Object.assign(
          {
            category: "Applications",
            type: "project",
            icon: "apps",
            accent: "#2d89ef",
            showOnDesktop: true,
            launchMode: "window",
            summary: ""
          },
          project
        );
        normalized.id = normalized.id || slugify(normalized.title || "app");
        return normalized;
      })
      .filter(function (project) {
        if (seen.has(project.id)) {
          return false;
        }
        seen.add(project.id);
        return true;
      });
  }

  function mergeProjects(baseProjects, incomingProjects) {
    var byId = new Map();
    baseProjects.forEach(function (project) {
      byId.set(project.id, project);
    });
    normalizeProjects(incomingProjects).forEach(function (project) {
      byId.set(project.id, Object.assign({}, byId.get(project.id) || {}, project));
    });
    return Array.from(byId.values());
  }

  async function loadRemoteManifests() {
    var configuredManifests = window.EINSUMOS_MANIFESTS;
    var manifestUrls = Array.isArray(configuredManifests)
      ? configuredManifests.filter(Boolean)
      : [];

    if (!manifestUrls.length || !window.fetch) {
      return;
    }

    var settled = await Promise.allSettled(
      manifestUrls.map(function (url) {
        return fetch(url, { cache: "no-store" }).then(function (response) {
          if (!response.ok) {
            throw new Error("Failed to load " + url);
          }
          return response.json();
        });
      })
    );

    var remoteProjects = [];
    settled.forEach(function (result) {
      if (result.status !== "fulfilled") {
        return;
      }
      if (Array.isArray(result.value)) {
        remoteProjects = remoteProjects.concat(result.value);
      } else {
        remoteProjects.push(result.value);
      }
    });

    if (!remoteProjects.length) {
      return;
    }

    projects = mergeProjects(projects, remoteProjects);
    renderDesktopIcons();
    renderStartMenu();
    renderTasks();
  }

  function bindGlobalEvents() {
    els.startButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleStartMenu();
    });

    els.allProjectsButton.addEventListener("click", function () {
      closeStartMenu();
      openApp(findProject("project-index"));
    });

    els.contactButton.addEventListener("click", function () {
      closeStartMenu();
      var contact = {
        id: "contact",
        title: "Contact",
        category: "System",
        type: "native",
        icon: "id",
        accent: "#2a9d46",
        summary: "Direct links for source, mail, and profile.",
        body: [
          "Use this small system window for the links visitors need after they review the projects."
        ],
        actions: [
          { label: "Email", url: owner.email ? "mailto:" + owner.email : "" },
          { label: "GitHub", url: owner.github },
          { label: "EinsumOS Repo", url: owner.repo }
        ].filter(function (action) {
          return action.url && action.url !== "#";
        })
      };
      openApp(contact);
    });

    document.addEventListener("pointerdown", function (event) {
      if (!els.startMenu.hidden && !event.target.closest(".start-menu, .start-button")) {
        closeStartMenu();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeStartMenu();
      }
    });

    window.addEventListener("resize", keepWindowsInBounds);
  }

  function renderDesktopIcons() {
    els.desktopIcons.replaceChildren();
    projects
      .filter(function (project) {
        return project.showOnDesktop !== false;
      })
      .forEach(function (project) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "shortcut";
        button.style.setProperty("--accent", project.accent);
        button.setAttribute("aria-label", "Open " + project.title);

        button.appendChild(makeIcon(project, "shortcut-icon"));

        var label = document.createElement("span");
        label.className = "shortcut-label";
        label.textContent = project.title;
        button.appendChild(label);

        button.addEventListener("click", function () {
          openApp(project);
        });

        els.desktopIcons.appendChild(button);
      });
  }

  function renderStartMenu() {
    els.startPrograms.replaceChildren();
    var categories = new Map();

    projects.forEach(function (project) {
      if (project.hidden) {
        return;
      }
      var category = project.category || "Applications";
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(project);
    });

    categories.forEach(function (categoryProjects, category) {
      var heading = document.createElement("p");
      heading.className = "start-category";
      heading.textContent = category;
      els.startPrograms.appendChild(heading);

      categoryProjects.forEach(function (project) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "program-button";
        button.style.setProperty("--accent", project.accent);

        button.appendChild(makeIcon(project, "app-icon"));

        var copy = document.createElement("span");
        copy.className = "program-copy";

        var title = document.createElement("span");
        title.className = "program-title";
        title.textContent = project.title;

        var summary = document.createElement("span");
        summary.className = "program-summary";
        summary.textContent = project.summary || project.url || "";

        copy.append(title, summary);
        button.appendChild(copy);

        button.addEventListener("click", function () {
          closeStartMenu();
          openApp(project);
        });

        els.startPrograms.appendChild(button);
      });
    });
  }

  function renderTasks() {
    els.taskList.replaceChildren();
    windows.forEach(function (entry, id) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "task-button";
      button.classList.toggle("is-active", id === activeWindowId && !entry.minimized);
      button.style.setProperty("--accent", entry.project.accent);
      button.setAttribute("aria-label", "Show " + entry.project.title);

      var dot = document.createElement("i");
      dot.className = "task-dot";
      dot.setAttribute("aria-hidden", "true");

      var label = document.createElement("span");
      label.textContent = entry.project.title;

      button.append(dot, label);
      button.addEventListener("click", function () {
        if (entry.minimized || id !== activeWindowId) {
          restoreWindow(id);
        } else {
          minimizeWindow(id);
        }
      });

      els.taskList.appendChild(button);
    });
  }

  function toggleStartMenu() {
    var willOpen = els.startMenu.hidden;
    els.startMenu.hidden = !willOpen;
    els.startButton.setAttribute("aria-expanded", String(willOpen));
  }

  function closeStartMenu() {
    els.startMenu.hidden = true;
    els.startButton.setAttribute("aria-expanded", "false");
  }

  function findProject(id) {
    return projects.find(function (project) {
      return project.id === id;
    });
  }

  function openApp(project) {
    if (!project) {
      return;
    }

    if (project.launchMode === "tab" && project.url && !isPlaceholderUrl(project.url)) {
      window.open(project.url, "_blank", "noreferrer");
      return;
    }

    if (windows.has(project.id)) {
      restoreWindow(project.id);
      return;
    }

    var appWindow = createWindow(project);
    var bounds = getInitialBounds(project);
    appWindow.style.left = bounds.left + "px";
    appWindow.style.top = bounds.top + "px";
    appWindow.style.width = bounds.width + "px";
    appWindow.style.height = bounds.height + "px";

    windows.set(project.id, {
      project: project,
      node: appWindow,
      minimized: false,
      maximized: false,
      previousBounds: null
    });

    els.windowLayer.appendChild(appWindow);
    focusWindow(project.id);
    renderTasks();
  }

  function createWindow(project) {
    var appWindow = document.createElement("article");
    appWindow.className = "app-window";
    appWindow.dataset.windowId = project.id;
    appWindow.setAttribute("role", "dialog");
    appWindow.setAttribute("aria-label", project.title);
    appWindow.style.setProperty("--accent", project.accent);

    var titlebar = document.createElement("header");
    titlebar.className = "window-titlebar";

    var title = document.createElement("div");
    title.className = "window-title";

    var miniIcon = document.createElement("span");
    miniIcon.className = "mini-icon";
    miniIcon.setAttribute("aria-hidden", "true");

    var titleText = document.createElement("span");
    titleText.className = "window-title-text";
    titleText.textContent = project.title;

    title.append(miniIcon, titleText);

    var controls = document.createElement("div");
    controls.className = "window-controls";
    controls.append(
      makeWindowControl("minimize", "Minimize"),
      makeWindowControl("maximize", "Maximize"),
      makeWindowControl("close", "Close")
    );

    titlebar.append(title, controls);

    var content = document.createElement("div");
    content.className = "window-content";
    content.appendChild(renderWindowContent(project));

    var resize = document.createElement("div");
    resize.className = "resize-handle";
    resize.setAttribute("aria-hidden", "true");

    appWindow.append(titlebar, content, resize);

    appWindow.addEventListener("pointerdown", function () {
      focusWindow(project.id);
    });

    titlebar.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button")) {
        return;
      }
      startDrag(event, project.id);
    });

    titlebar.addEventListener("dblclick", function (event) {
      if (!event.target.closest("button")) {
        toggleMaximize(project.id);
      }
    });

    resize.addEventListener("pointerdown", function (event) {
      startResize(event, project.id);
    });

    controls.querySelector(".minimize").addEventListener("click", function () {
      minimizeWindow(project.id);
    });
    controls.querySelector(".maximize").addEventListener("click", function () {
      toggleMaximize(project.id);
    });
    controls.querySelector(".close").addEventListener("click", function () {
      closeWindow(project.id);
    });

    return appWindow;
  }

  function renderWindowContent(project) {
    if (project.type === "index") {
      return renderProjectIndex(project);
    }

    if (project.type === "native") {
      return renderNativePage(project);
    }

    return renderProjectPage(project);
  }

  function renderNativePage(project) {
    var page = document.createElement("div");
    page.className = "window-page native-page";

    var header = document.createElement("header");
    header.className = "native-header";
    header.appendChild(makeIcon(project, "app-icon"));

    var headerCopy = document.createElement("div");
    var title = document.createElement("h1");
    title.className = "native-title";
    title.textContent = project.title;

    var summary = document.createElement("p");
    summary.className = "native-summary";
    summary.textContent = project.summary || "";

    headerCopy.append(title, summary);
    header.appendChild(headerCopy);

    var body = document.createElement("div");
    body.className = "native-body";
    (project.body || []).forEach(function (paragraph) {
      var p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });

    page.append(header, body);

    if (Array.isArray(project.actions) && project.actions.length) {
      page.appendChild(renderActions(project.actions, "native-actions"));
    }

    return page;
  }

  function renderProjectIndex(project) {
    var page = renderNativePage(
      Object.assign({}, project, {
        body: [
          "Each tile can open a live GitHub Pages app in a desktop window or a new tab."
        ]
      })
    );

    var grid = document.createElement("div");
    grid.className = "project-grid";

    projects
      .filter(function (item) {
        return item.type === "project";
      })
      .forEach(function (item) {
        var tile = document.createElement("article");
        tile.className = "project-tile";
        tile.style.setProperty("--accent", item.accent);

        var head = document.createElement("div");
        head.className = "project-tile-head";
        head.appendChild(makeIcon(item, "app-icon"));

        var h3 = document.createElement("h3");
        h3.textContent = item.title;
        head.appendChild(h3);

        var p = document.createElement("p");
        p.textContent = item.summary || item.url || "";

        var actions = document.createElement("div");
        actions.className = "project-tile-actions";

        var openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "action-button";
        openButton.textContent = "Open";
        openButton.addEventListener("click", function () {
          openApp(item);
        });

        actions.appendChild(openButton);

        if (item.url && !isPlaceholderUrl(item.url)) {
          actions.appendChild(makeActionLink("Live", item.url));
        }

        if (item.repo && !isPlaceholderUrl(item.repo)) {
          actions.appendChild(makeActionLink("Source", item.repo));
        }

        tile.append(head, p, actions);
        grid.appendChild(tile);
      });

    page.appendChild(grid);
    return page;
  }

  function renderProjectPage(project) {
    var page = document.createElement("div");
    page.className = "project-page";

    var frameWrap = document.createElement("div");
    frameWrap.className = "project-frame-wrap";

    if (project.url && !isPlaceholderUrl(project.url)) {
      var frame = document.createElement("iframe");
      frame.className = "project-frame";
      frame.title = project.title;
      frame.src = project.url;
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      frame.addEventListener("load", function () {
        scheduleFrameAutoFit(project.id, frame);
      });
      frameWrap.appendChild(frame);
    } else {
      frameWrap.appendChild(renderProjectPlaceholder(project));
    }

    page.appendChild(frameWrap);
    return page;
  }

  function renderProjectPlaceholder(project) {
    var wrap = document.createElement("div");
    wrap.className = "project-placeholder";

    var card = document.createElement("div");
    card.className = "project-card";

    var h2 = document.createElement("h2");
    h2.textContent = project.title;

    var p = document.createElement("p");
    p.textContent = project.summary || "Project details are ready for a live GitHub Pages URL.";

    var meta = document.createElement("div");
    meta.className = "project-meta";
    appendCodeMeta(meta, "Live URL", project.url || "");
    appendCodeMeta(meta, "Source repo", project.repo || "");

    card.append(h2, p, meta);
    wrap.appendChild(card);
    return wrap;
  }

  function appendCodeMeta(parent, label, value) {
    if (!value) {
      return;
    }
    var row = document.createElement("div");
    var strong = document.createElement("strong");
    strong.textContent = label;
    var code = document.createElement("code");
    code.textContent = value;
    row.append(strong, code);
    parent.appendChild(row);
  }

  function renderActions(actions, className) {
    var wrap = document.createElement("div");
    wrap.className = className;
    actions.forEach(function (action) {
      if (!action.url) {
        return;
      }
      wrap.appendChild(makeActionLink(action.label, action.url));
    });
    return wrap;
  }

  function makeActionLink(label, url) {
    var link = document.createElement("a");
    link.className = "action-link";
    link.href = url;
    link.textContent = label;
    if (!url.startsWith("mailto:") && !url.startsWith("#")) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    return link;
  }

  function makeWindowControl(className, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "window-control " + className;
    button.setAttribute("aria-label", label);
    return button;
  }

  function makeIcon(project, className) {
    var icon = document.createElement("span");
    icon.className = className;
    icon.style.setProperty("--accent", project.accent || "#2d89ef");
    icon.setAttribute("aria-hidden", "true");

    var glyph = document.createElement("span");
    glyph.className = "glyph glyph-" + (project.icon || "apps");

    if (project.icon === "apps" || project.icon === "board") {
      glyph.appendChild(document.createElement("span"));
    }

    icon.appendChild(glyph);
    return icon;
  }

  function focusWindow(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }
    zIndex += 1;
    activeWindowId = id;
    entry.node.style.zIndex = zIndex;
    entry.node.classList.remove("is-minimized");
    entry.minimized = false;
    renderTasks();
  }

  function minimizeWindow(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }
    entry.minimized = true;
    entry.node.classList.add("is-minimized");
    if (activeWindowId === id) {
      activeWindowId = null;
    }
    renderTasks();
  }

  function restoreWindow(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }
    entry.minimized = false;
    entry.node.classList.remove("is-minimized");
    focusWindow(id);
  }

  function closeWindow(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }
    entry.node.remove();
    windows.delete(id);
    if (activeWindowId === id) {
      activeWindowId = null;
    }
    renderTasks();
  }

  function toggleMaximize(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }

    if (entry.maximized) {
      entry.node.classList.remove("is-maximized");
      if (entry.previousBounds) {
        entry.node.style.left = entry.previousBounds.left;
        entry.node.style.top = entry.previousBounds.top;
        entry.node.style.width = entry.previousBounds.width;
        entry.node.style.height = entry.previousBounds.height;
      }
      entry.maximized = false;
      return;
    }

    entry.previousBounds = {
      left: entry.node.style.left,
      top: entry.node.style.top,
      width: entry.node.style.width,
      height: entry.node.style.height
    };
    entry.node.classList.add("is-maximized");
    entry.maximized = true;
    focusWindow(id);
  }

  function startDrag(event, id) {
    var entry = windows.get(id);
    if (!entry || entry.maximized || event.button !== 0) {
      return;
    }

    event.preventDefault();
    focusWindow(id);

    var rect = entry.node.getBoundingClientRect();
    var origin = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top
    };

    entry.node.setPointerCapture(event.pointerId);

    function move(moveEvent) {
      var nextLeft = origin.left + moveEvent.clientX - origin.x;
      var nextTop = origin.top + moveEvent.clientY - origin.y;
      var bounds = clampBounds(nextLeft, nextTop, rect.width, rect.height);
      entry.node.style.left = bounds.left + "px";
      entry.node.style.top = bounds.top + "px";
    }

    function stop() {
      entry.node.removeEventListener("pointermove", move);
      entry.node.removeEventListener("pointerup", stop);
      entry.node.removeEventListener("pointercancel", stop);
    }

    entry.node.addEventListener("pointermove", move);
    entry.node.addEventListener("pointerup", stop);
    entry.node.addEventListener("pointercancel", stop);
  }

  function startResize(event, id) {
    var entry = windows.get(id);
    if (!entry || entry.maximized || event.button !== 0) {
      return;
    }

    event.preventDefault();
    focusWindow(id);

    var rect = entry.node.getBoundingClientRect();
    var origin = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height
    };

    entry.node.setPointerCapture(event.pointerId);

    function move(moveEvent) {
      var maxWidth = Math.max(320, window.innerWidth - rect.left - 8);
      var maxHeight = Math.max(250, window.innerHeight - rect.top - 56);
      var width = clamp(origin.width + moveEvent.clientX - origin.x, 320, maxWidth);
      var height = clamp(origin.height + moveEvent.clientY - origin.y, 260, maxHeight);
      entry.node.style.width = width + "px";
      entry.node.style.height = height + "px";
    }

    function stop() {
      entry.node.removeEventListener("pointermove", move);
      entry.node.removeEventListener("pointerup", stop);
      entry.node.removeEventListener("pointercancel", stop);
    }

    entry.node.addEventListener("pointermove", move);
    entry.node.addEventListener("pointerup", stop);
    entry.node.addEventListener("pointercancel", stop);
  }

  function getInitialBounds(project) {
    var desktopRect = els.desktop.getBoundingClientRect();
    var isSmall = window.innerWidth < 720;
    var preferred = getPreferredWindowSize(project, desktopRect);
    var width = isSmall ? desktopRect.width - 18 : preferred.width;
    var height = isSmall ? desktopRect.height - 24 : preferred.height;
    var offset = desktopMetrics.nextOffset % 7;
    desktopMetrics.nextOffset += 1;

    if (isSmall) {
      return {
        left: 9,
        top: 10 + offset * 8,
        width: width,
        height: height
      };
    }

    return {
      left: Math.max(122, Math.round(desktopRect.width * 0.18) + offset * 24),
      top: 42 + offset * 22,
      width: width,
      height: height
    };
  }

  function getPreferredWindowSize(project, desktopRect) {
    var config = project.window || {};
    var viewport = config.viewport || {};
    var chrome = getWindowChromeSize();
    var defaultWidth = project.type === "project" ? 820 : 720;
    var defaultHeight = project.type === "project" ? 560 : 480;
    var width = numberOr(config.width, defaultWidth);
    var height = numberOr(config.height, defaultHeight);

    if (viewport.width && viewport.height) {
      width = Number(viewport.width) + chrome.width;
      height = Number(viewport.height) + chrome.height;
    }

    var minWidth = numberOr(config.minWidth, 320);
    var minHeight = numberOr(config.minHeight, 260);
    var maxWidth = Math.max(minWidth, desktopRect.width - 16);
    var maxHeight = Math.max(minHeight, desktopRect.height - 18);

    return {
      width: clamp(width, minWidth, maxWidth),
      height: clamp(height, minHeight, maxHeight)
    };
  }

  function getWindowChromeSize() {
    return {
      width: 8,
      height: window.innerWidth < 720 ? 41 : 37
    };
  }

  function scheduleFrameAutoFit(id, frame) {
    window.setTimeout(function () {
      autoFitFrameWindow(id, frame);
    }, 80);
    window.setTimeout(function () {
      autoFitFrameWindow(id, frame);
    }, 600);
  }

  function autoFitFrameWindow(id, frame) {
    var entry = windows.get(id);
    if (!entry || entry.maximized || entry.project.type !== "project") {
      return;
    }

    var config = entry.project.window || {};
    if (config.autoFit !== true) {
      return;
    }

    var measured = measureFrameContent(frame, config.fitSelector);
    if (!measured) {
      return;
    }

    resizeWindowToViewport(id, measured.width, measured.height);
  }

  function measureFrameContent(frame, fitSelector) {
    var doc;
    try {
      doc = frame.contentDocument || frame.contentWindow.document;
    } catch (error) {
      return null;
    }

    if (!doc || !doc.body || !doc.documentElement) {
      return null;
    }

    var body = doc.body;
    var html = doc.documentElement;
    var target = fitSelector ? doc.querySelector(fitSelector) : null;
    var width = Math.max(body.scrollWidth, html.scrollWidth, body.offsetWidth, html.offsetWidth);
    var height = Math.max(body.scrollHeight, html.scrollHeight, body.offsetHeight, html.offsetHeight);

    if (target) {
      var rect = target.getBoundingClientRect();
      width = Math.max(width, Math.ceil(rect.left + rect.width));
      height = Math.max(height, Math.ceil(rect.top + rect.height));
    }

    if (!width || !height) {
      return null;
    }

    return {
      width: width,
      height: height
    };
  }

  function resizeWindowToViewport(id, viewportWidth, viewportHeight) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }

    var config = entry.project.window || {};
    var chrome = getWindowChromeSize();
    var desktopRect = els.desktop.getBoundingClientRect();
    var minWidth = numberOr(config.minWidth, 320);
    var minHeight = numberOr(config.minHeight, 260);
    var maxWidth = Math.max(minWidth, numberOr(config.maxWidth, desktopRect.width - 16));
    var maxHeight = Math.max(minHeight, numberOr(config.maxHeight, desktopRect.height - 18));
    var width = clamp(viewportWidth + chrome.width, minWidth, maxWidth);
    var height = clamp(viewportHeight + chrome.height, minHeight, maxHeight);
    var rect = entry.node.getBoundingClientRect();
    var bounds = clampBounds(rect.left, rect.top, width, height);

    entry.node.style.width = width + "px";
    entry.node.style.height = height + "px";
    entry.node.style.left = bounds.left + "px";
    entry.node.style.top = bounds.top + "px";
  }

  function keepWindowsInBounds() {
    windows.forEach(function (entry) {
      if (entry.maximized) {
        return;
      }
      var rect = entry.node.getBoundingClientRect();
      var bounds = clampBounds(rect.left, rect.top, rect.width, rect.height);
      entry.node.style.left = bounds.left + "px";
      entry.node.style.top = bounds.top + "px";
      entry.node.style.width = Math.min(rect.width, window.innerWidth - 18) + "px";
      entry.node.style.height = Math.min(rect.height, window.innerHeight - 64) + "px";
    });
  }

  function clampBounds(left, top, width, height) {
    var maxLeft = Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8);
    var maxTop = Math.max(8, window.innerHeight - 54 - Math.min(height, window.innerHeight - 64));
    return {
      left: clamp(left, 8, maxLeft),
      top: clamp(top, 8, maxTop)
    };
  }

  function updateClock() {
    var now = new Date();
    els.clock.textContent = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    els.clock.setAttribute("datetime", now.toISOString());
  }

  function isPlaceholderUrl(url) {
    return !url || /YOUR_GITHUB_USERNAME|example\.com/.test(url);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function initials(value) {
    return String(value || "YN")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function numberOr(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }
})();
