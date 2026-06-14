(function () {
  "use strict";

  var owner = Object.assign(
    {
      name: "Your Name",
      role: "ArctOS desktop",
      avatarInitials: "YN",
      github: "#",
      email: "",
      repo: "#"
    },
    window.ARCTOS_OWNER || {}
  );

  var projects = normalizeProjects(window.ARCTOS_PROJECTS || []);
  var windows = new Map();
  var zIndex = 40;
  var activeWindowId = null;
  var desktopMetrics = { nextOffset: 0 };
  var startMenuState = {
    programsButton: null,
    programsSubmenu: null,
    programsOpen: false
  };
  var THEME_STORAGE_KEY = "arctos.theme";
  var THEMES = {
    win98: {
      id: "win98",
      label: "Win98",
      summary: "Classic gray dialogs and teal desktop"
    },
    xp: {
      id: "xp",
      label: "WinXP",
      summary: "Blue taskbar desktop"
    }
  };
  var currentTheme = readStoredTheme();

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
    ownerRole: document.getElementById("owner-role")
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyTheme(currentTheme);
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
    var configuredManifests = window.ARCTOS_MANIFESTS;
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
    bindPressAction(els.startButton, function (event) {
      event.stopPropagation();
      toggleStartMenu();
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
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", keepWindowsInBounds);
      window.visualViewport.addEventListener("scroll", keepWindowsInBounds);
    }
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

        bindPressAction(button, function () {
          openApp(project);
        });

        els.desktopIcons.appendChild(button);
      });
  }

  function renderStartMenu() {
    els.startPrograms.replaceChildren();
    if (startMenuState.programsSubmenu) {
      startMenuState.programsSubmenu.remove();
    }
    startMenuState.programsButton = null;
    startMenuState.programsSubmenu = null;
    startMenuState.programsOpen = false;

    var appProjects = projects.filter(function (project) {
      return project.type === "project" && !project.hidden;
    });
    appendProgramsFolder(appProjects);
    appendStartEntry(findProject("project-index"));
    appendStartEntry(createSettingsProject());
  }

  function appendStartEntry(project) {
    if (!project) {
      return;
    }

    els.startPrograms.appendChild(makeStartProgramButton(project, function () {
      closeStartMenu();
      openApp(project);
    }));
  }

  function appendProgramsFolder(appProjects) {
    var folder = {
      id: "programs",
      title: "Programs",
      icon: "apps",
      accent: "#2c9b54",
      summary: appProjects.length === 1 ? "1 application" : appProjects.length + " applications"
    };
    var button = makeStartProgramButton(folder, function () {
      setProgramsSubmenuOpen(!startMenuState.programsOpen);
    });
    button.classList.add("program-folder");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");

    var caret = document.createElement("span");
    caret.className = "program-caret";
    caret.textContent = ">";
    caret.setAttribute("aria-hidden", "true");
    button.appendChild(caret);

    button.addEventListener("mouseenter", function () {
      if (!isSmallViewport()) {
        setProgramsSubmenuOpen(true);
      }
    });

    button.addEventListener("focus", function () {
      if (!isSmallViewport()) {
        setProgramsSubmenuOpen(true);
      }
    });

    button.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setProgramsSubmenuOpen(true);
      }
    });

    var submenu = document.createElement("aside");
    submenu.id = "programs-submenu";
    submenu.className = "programs-submenu";
    submenu.setAttribute("role", "menu");
    submenu.setAttribute("aria-label", "Programs");
    submenu.hidden = true;

    var title = document.createElement("p");
    title.className = "programs-submenu-title";
    title.textContent = "Programs";
    submenu.appendChild(title);

    if (!appProjects.length) {
      var empty = document.createElement("p");
      empty.className = "programs-empty";
      empty.textContent = "No applications";
      submenu.appendChild(empty);
    } else {
      appProjects.forEach(function (project) {
        submenu.appendChild(makeStartProgramButton(project, function () {
          closeStartMenu();
          openApp(project);
        }, "menuitem"));
      });
    }

    startMenuState.programsButton = button;
    startMenuState.programsSubmenu = submenu;
    els.startPrograms.appendChild(button);
    els.startMenu.appendChild(submenu);
  }

  function makeStartProgramButton(project, callback, role) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "program-button";
    button.style.setProperty("--accent", project.accent);
    if (role) {
      button.setAttribute("role", role);
    }

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

    bindPressAction(button, callback);
    return button;
  }

  function setProgramsSubmenuOpen(isOpen) {
    startMenuState.programsOpen = Boolean(isOpen);

    if (startMenuState.programsSubmenu) {
      startMenuState.programsSubmenu.hidden = !startMenuState.programsOpen;
      if (startMenuState.programsOpen && startMenuState.programsButton && !isSmallViewport()) {
        var buttonRect = startMenuState.programsButton.getBoundingClientRect();
        var menuRect = els.startMenu.getBoundingClientRect();
        startMenuState.programsSubmenu.style.top = Math.max(0, buttonRect.top - menuRect.top) + "px";
      } else {
        startMenuState.programsSubmenu.style.top = "";
      }
    }

    if (startMenuState.programsButton) {
      startMenuState.programsButton.classList.toggle("is-open", startMenuState.programsOpen);
      startMenuState.programsButton.setAttribute("aria-expanded", String(startMenuState.programsOpen));
    }
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
      bindPressAction(button, function () {
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
    setProgramsSubmenuOpen(false);
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
    scheduleFixedViewportScale(project.id);
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

    bindWindowControl(controls.querySelector(".minimize"), function () {
      minimizeWindow(project.id);
    });
    bindWindowControl(controls.querySelector(".maximize"), function () {
      toggleMaximize(project.id);
    });
    bindWindowControl(controls.querySelector(".close"), function () {
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

    if (project.type === "settings") {
      return renderSettingsPage(project);
    }

    return renderProjectPage(project);
  }

  function createSettingsProject() {
    return {
      id: "settings",
      title: "Settings",
      category: "System",
      type: "settings",
      icon: "settings",
      accent: "#61788f",
      summary: "Change ArctOS preferences.",
      window: {
        width: 520,
        height: 430
      }
    };
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
        bindPressAction(openButton, function () {
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

  function renderSettingsPage(project) {
    var page = renderNativePage(
      Object.assign({}, project, {
        body: []
      })
    );

    var settingsPanel = document.createElement("section");
    settingsPanel.className = "settings-panel";

    var sectionHeader = document.createElement("div");
    sectionHeader.className = "settings-section-header";

    var h2 = document.createElement("h2");
    h2.textContent = "Theme";
    var p = document.createElement("p");
    p.textContent = "Choose the desktop style.";
    sectionHeader.append(h2, p);

    var options = document.createElement("div");
    options.className = "theme-options";

    Object.keys(THEMES).forEach(function (themeId) {
      var theme = THEMES[themeId];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "theme-option";
      button.dataset.themeOption = theme.id;
      button.setAttribute("aria-pressed", String(currentTheme === theme.id));

      var swatch = document.createElement("span");
      swatch.className = "theme-swatch theme-swatch-" + theme.id;
      swatch.setAttribute("aria-hidden", "true");

      var copy = document.createElement("span");
      copy.className = "theme-option-copy";

      var label = document.createElement("strong");
      label.textContent = theme.label;
      var summary = document.createElement("span");
      summary.textContent = theme.summary;

      copy.append(label, summary);
      button.append(swatch, copy);

      bindPressAction(button, function () {
        setTheme(theme.id);
      });

      options.appendChild(button);
    });

    settingsPanel.append(sectionHeader, options);
    page.appendChild(settingsPanel);
    return page;
  }

  function renderProjectPage(project) {
    var page = document.createElement("div");
    page.className = "project-page";

    var frameWrap = document.createElement("div");
    frameWrap.className = "project-frame-wrap";
    var viewport = getConfiguredViewport(project);
    var frameParent = frameWrap;

    if (viewport) {
      frameWrap.classList.add("has-fixed-viewport");
      frameWrap.style.setProperty("--app-viewport-width", viewport.width + "px");
      frameWrap.style.setProperty("--app-viewport-height", viewport.height + "px");

      var frameStage = document.createElement("div");
      frameStage.className = "project-frame-stage";
      frameStage.dataset.frameStage = project.id;
      frameStage.style.setProperty("--app-viewport-width", viewport.width + "px");
      frameStage.style.setProperty("--app-viewport-height", viewport.height + "px");
      frameWrap.appendChild(frameStage);
      frameParent = frameStage;
    }

    if (project.url && !isPlaceholderUrl(project.url)) {
      var frame = document.createElement("iframe");
      frame.className = "project-frame";
      frame.dataset.frameWindowId = project.id;
      frame.title = project.title;
      frame.src = project.url;
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer";
      frame.addEventListener("load", function () {
        scheduleFrameAutoFit(project.id, frame);
      });
      frameParent.appendChild(frame);
    } else {
      frameParent.appendChild(renderProjectPlaceholder(project));
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
    bindPressAction(link, function () {
      openActionUrl(url);
    }, { preventDefault: true });
    return link;
  }

  function makeWindowControl(className, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "window-control " + className;
    button.setAttribute("aria-label", label);
    return button;
  }

  function bindWindowControl(button, callback) {
    bindPressAction(button, callback, { preventDefault: true });
  }

  function bindPressAction(element, callback, options) {
    var ignoreClickUntil = 0;
    var config = Object.assign({ preventDefault: false }, options || {});

    element.addEventListener("pointerup", function (event) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      if (config.preventDefault) {
        event.preventDefault();
      }
      event.stopPropagation();
      ignoreClickUntil = Date.now() + 500;
      callback(event);
    });

    element.addEventListener("click", function (event) {
      event.stopPropagation();
      if (Date.now() < ignoreClickUntil) {
        if (config.preventDefault) {
          event.preventDefault();
        }
        return;
      }
      if (config.preventDefault) {
        event.preventDefault();
      }
      callback(event);
    });
  }

  function openActionUrl(url) {
    if (!url || url === "#") {
      return;
    }

    if (url.startsWith("mailto:")) {
      window.location.href = url;
      return;
    }

    window.open(url, "_blank", "noreferrer");
  }

  function readStoredTheme() {
    try {
      var storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return THEMES[storedTheme] ? storedTheme : "win98";
    } catch (error) {
      return "win98";
    }
  }

  function setTheme(themeId) {
    currentTheme = THEMES[themeId] ? themeId : "win98";
    applyTheme(currentTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch (error) {
      // Ignore storage failures; the active page can still switch themes.
    }

    syncThemeButtons();
  }

  function applyTheme(themeId) {
    document.documentElement.dataset.theme = themeId === "xp" ? "xp" : "win98";
  }

  function syncThemeButtons() {
    document.querySelectorAll("[data-theme-option]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.themeOption === currentTheme));
    });
  }

  function makeIcon(project, className) {
    var icon = document.createElement("span");
    icon.className = className;
    icon.style.setProperty("--accent", project.accent || "#2d89ef");
    icon.setAttribute("aria-hidden", "true");

    if (project.iconUrl) {
      var image = document.createElement("img");
      image.className = "app-icon-image";
      image.src = project.iconUrl;
      image.alt = "";
      image.loading = "lazy";
      icon.appendChild(image);
      return icon;
    }

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
      var desktopRect = els.desktop.getBoundingClientRect();
      var maxWidth = Math.max(320, desktopRect.width - rect.left - 8);
      var maxHeight = Math.max(250, desktopRect.height - rect.top - 8);
      var width = clamp(origin.width + moveEvent.clientX - origin.x, 320, maxWidth);
      var height = clamp(origin.height + moveEvent.clientY - origin.y, 260, maxHeight);
      entry.node.style.width = width + "px";
      entry.node.style.height = height + "px";
      updateFixedViewportScale(id);
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
    var isSmall = isSmallViewport();
    var preferred = getPreferredWindowSize(project, desktopRect);
    var width = isSmall ? desktopRect.width - 12 : preferred.width;
    var height = isSmall ? desktopRect.height - 12 : preferred.height;
    var offset = desktopMetrics.nextOffset % 7;
    desktopMetrics.nextOffset += 1;

    if (isSmall) {
      return {
        left: 6,
        top: 6,
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
      width: isSmallViewport() ? 6 : 8,
      height: isSmallViewport() ? 48 : 37
    };
  }

  function scheduleFrameAutoFit(id, frame) {
    scheduleFixedViewportScale(id);
    window.setTimeout(function () {
      autoFitFrameWindow(id, frame);
      scheduleFixedViewportScale(id);
    }, 80);
    window.setTimeout(function () {
      autoFitFrameWindow(id, frame);
      scheduleFixedViewportScale(id);
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
    scheduleFixedViewportScale(id);
  }

  function getConfiguredViewport(project) {
    var viewport = project && project.window && project.window.viewport;
    var width = viewport && Number(viewport.width);
    var height = viewport && Number(viewport.height);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return {
      width: width,
      height: height
    };
  }

  function scheduleFixedViewportScale(id) {
    window.requestAnimationFrame(function () {
      updateFixedViewportScale(id);
    });
  }

  function updateFixedViewportScale(id) {
    var entry = windows.get(id);
    if (!entry) {
      return;
    }

    var viewport = getConfiguredViewport(entry.project);
    if (!viewport) {
      return;
    }

    var stage = entry.node.querySelector("[data-frame-stage='" + cssEscape(id) + "']");
    var wrap = stage && stage.closest(".project-frame-wrap");
    if (!stage || !wrap) {
      return;
    }

    var wrapRect = wrap.getBoundingClientRect();
    var availableWidth = Math.max(1, wrapRect.width - 16);
    var availableHeight = Math.max(1, wrapRect.height - 16);
    var scale = Math.min(1, availableWidth / viewport.width, availableHeight / viewport.height);
    var scaledWidth = Math.floor(viewport.width * scale);
    var scaledHeight = Math.floor(viewport.height * scale);

    stage.style.setProperty("--app-scale", String(scale));
    stage.style.setProperty("--scaled-viewport-width", scaledWidth + "px");
    stage.style.setProperty("--scaled-viewport-height", scaledHeight + "px");
    stage.style.width = scaledWidth + "px";
    stage.style.height = scaledHeight + "px";
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
    scheduleFixedViewportScale(id);
  }

  function keepWindowsInBounds() {
    windows.forEach(function (entry) {
      if (entry.maximized) {
        return;
      }
      var rect = entry.node.getBoundingClientRect();
      var desktopRect = els.desktop.getBoundingClientRect();
      var bounds = clampBounds(rect.left, rect.top, rect.width, rect.height);
      entry.node.style.left = bounds.left + "px";
      entry.node.style.top = bounds.top + "px";
      entry.node.style.width = Math.min(rect.width, desktopRect.width - 12) + "px";
      entry.node.style.height = Math.min(rect.height, desktopRect.height - 12) + "px";
      scheduleFixedViewportScale(entry.project.id);
    });
  }

  function clampBounds(left, top, width, height) {
    var desktopRect = els.desktop.getBoundingClientRect();
    var maxLeft = Math.max(6, desktopRect.width - Math.min(width, desktopRect.width - 12) - 6);
    var maxTop = Math.max(6, desktopRect.height - Math.min(height, desktopRect.height - 12) - 6);
    return {
      left: clamp(left, 6, maxLeft),
      top: clamp(top, 6, maxTop)
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

  function isSmallViewport() {
    var width = window.visualViewport && window.visualViewport.width
      ? window.visualViewport.width
      : window.innerWidth;
    return width < 720;
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

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
})();
