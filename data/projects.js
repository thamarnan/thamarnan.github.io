window.ARCTOS_OWNER = {
  name: "thamarnan",
  role: "Developer desktop",
  avatarInitials: "TN",
  github: "https://github.com/thamarnan",
  email: "",
  repo: "https://github.com/thamarnan/thamarnan.github.io"
};

window.ARCTOS_PROJECTS = [
  {
    id: "about",
    title: "About Me",
    category: "System",
    type: "native",
    icon: "id",
    accent: "#1b75bc",
    showOnDesktop: true,
    summary: "A compact profile, focus areas, and links.",
    body: [
      "ArctOS opens individual project apps as windows.",
      "Use the Start menu or desktop icons to launch live GitHub Pages projects."
    ],
    actions: [
      {
        label: "GitHub",
        url: "https://github.com/thamarnan"
      }
    ]
  },
  {
    id: "project-index",
    title: "Projects",
    category: "System",
    type: "index",
    icon: "apps",
    accent: "#2c9b54",
    showOnDesktop: true,
    summary: "All ArctOS applications in one window."
  },
  {
    id: "compactcalendar",
    title: "Compact Calendar",
    category: "Applications",
    type: "project",
    icon: "calendar",
    accent: "#1f6feb",
    showOnDesktop: true,
    summary: "Compact year calendar with event labels, import/export, and profiles.",
    url: "https://mee-pooh.com/compactcalendar/",
    repo: "https://github.com/thamarnan/compactcalendar",
    launchMode: "window",
    window: {
      width: 1120,
      height: 740,
      minWidth: 720,
      minHeight: 520
    }
  },
  {
    id: "today-almanac",
    title: "Today Almanac",
    category: "Applications",
    type: "project",
    icon: "calendar",
    accent: "#8b5cf6",
    showOnDesktop: true,
    summary: "Today-focused almanac from the today-almanac repository.",
    url: "https://mee-pooh.com/today-almanac/",
    repo: "https://github.com/thamarnan/today-almanac",
    launchMode: "window",
    window: {
      width: 1040,
      height: 720,
      minWidth: 720,
      minHeight: 520
    }
  },
  {
    id: "today-traditional-almanac",
    title: "Today Traditional Almanac",
    category: "Applications",
    type: "project",
    icon: "calendar",
    accent: "#c2410c",
    showOnDesktop: true,
    summary: "Traditional view for the Today Almanac app.",
    url: "https://mee-pooh.com/today-almanac/traditional/",
    repo: "https://github.com/thamarnan/today-almanac/tree/main/traditional",
    launchMode: "window",
    window: {
      width: 920,
      height: 680,
      minWidth: 640,
      minHeight: 500
    }
  },
  {
    id: "resume",
    title: "Resume",
    category: "System",
    type: "native",
    icon: "doc",
    accent: "#61788f",
    showOnDesktop: false,
    summary: "A focused resume window with links to the source and PDF.",
    body: [
      "Add a short role summary here, then link to a PDF or hosted resume page.",
      "For GitHub Pages, place a PDF under assets/resume.pdf and set an action URL to that file."
    ],
    actions: [
      {
        label: "Resume PDF",
        url: "assets/resume.pdf"
      }
    ]
  }
];

window.ARCTOS_MANIFESTS = [
  // Add project-owned manifests later, for example:
  // "/weather-app/arctos.manifest.json"
];
