(function () {
  "use strict";

  var STORAGE = {
    notes: "hexald.notes",
    backlog: "hexald.backlog.v6"
  };

  var LEGACY_STORAGE = {
    notes: "tinyworld.notes",
    backlog: "hexald.backlog.v5"
  };

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  Object.keys(STORAGE).forEach(function (name) {
    var next = STORAGE[name];
    var prev = LEGACY_STORAGE[name];
    if (!storageGet(next) && storageGet(prev)) {
      storageSet(next, storageGet(prev));
    }
  });

  /* Mobile nav */

  var body = document.body;
  var sidebar = document.getElementById("sidebar");

  function openNav() {
    body.classList.add("nav-open");
  }

  function closeNav() {
    body.classList.remove("nav-open");
  }

  document.querySelectorAll("[data-open-nav]").forEach(function (btn) {
    btn.addEventListener("click", openNav);
  });

  document.querySelectorAll("[data-close-nav]").forEach(function (btn) {
    btn.addEventListener("click", closeNav);
  });

  document.addEventListener("click", function (event) {
    if (!body.classList.contains("nav-open")) return;
    if (sidebar && sidebar.contains(event.target)) return;
    if (event.target.closest("[data-open-nav]")) return;
    closeNav();
  });

  sidebar && sidebar.querySelectorAll("a[href^='#']").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  /* Active section */

  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".sidebar nav a[href^='#']")
  );

  var observed = navLinks
    .map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    })
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
    });
  }

  if ("IntersectionObserver" in window && observed.length) {
    var current = observed[0].id;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) current = entry.target.id;
        });
        setActive(current);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0.05 }
    );
    observed.forEach(function (section) {
      observer.observe(section);
    });
    setActive(current);
  }

  /* Search / Ctrl+K */

  var overlay = document.getElementById("search-overlay");
  var searchInput = document.getElementById("search-input");
  var searchResults = document.getElementById("search-results");
  var activeIndex = 0;

  var sections = [
    { id: "overview", label: "Overview — Dashboard" },
    { id: "vision", label: "Concept — Vision et piliers" },
    { id: "gameplay", label: "Gameplay — Boucle principale" },
    { id: "world", label: "World — Génération" },
    { id: "economy", label: "Economy — Population et hors ligne" },
    { id: "production", label: "Production — Chaînes" },
    { id: "buildings", label: "Buildings" },
    { id: "design", label: "Design — Direction artistique" },
    { id: "technical", label: "Technical — Architecture" },
    { id: "decisions", label: "Decisions — Decision log" },
    { id: "wiki", label: "Wiki — Index contenu" },
    { id: "wiki-biomes", label: "Wiki — Biomes" },
    { id: "wiki-resources", label: "Wiki — Ressources" },
    { id: "wiki-buildings", label: "Wiki — Bâtiments" },
    { id: "wiki-chains", label: "Wiki — Chaînes" },
    { id: "wiki-world", label: "Wiki — Monde & régions" },
    { id: "wiki-pois", label: "Wiki — POI" },
    { id: "monetization", label: "Monétisation" },
    { id: "roadmap", label: "Roadmap" },
    { id: "priorities", label: "Priorities" },
    { id: "backlog", label: "Backlog" },
    { id: "ideas", label: "Ideas — Parking lot" },
    { id: "pvp", label: "PvP" },
    { id: "risks", label: "Risks" },
    { id: "mvp", label: "MVP — Scope" }
  ];

  function filteredSections(query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(function (item) {
      return item.label.toLowerCase().indexOf(q) !== -1 || item.id.indexOf(q) !== -1;
    });
  }

  function renderSearch(query) {
    var items = filteredSections(query);
    if (activeIndex >= items.length) activeIndex = 0;
    searchResults.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("li");
      empty.textContent = "Aucune section";
      empty.style.padding = "10px";
      empty.style.color = "var(--muted)";
      searchResults.appendChild(empty);
      return items;
    }
    items.forEach(function (item, index) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      if (index === activeIndex) btn.className = "is-active";
      btn.addEventListener("click", function () {
        goTo(item.id);
      });
      li.appendChild(btn);
      searchResults.appendChild(li);
    });
    return items;
  }

  function openSearch() {
    overlay.hidden = false;
    overlay.classList.add("is-open");
    activeIndex = 0;
    renderSearch("");
    searchInput.value = "";
    searchInput.focus();
  }

  function closeSearch() {
    overlay.classList.remove("is-open");
    overlay.hidden = true;
  }

  function goTo(id) {
    closeSearch();
    closeNav();
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }

  document.querySelectorAll("[data-open-search]").forEach(function (btn) {
    btn.addEventListener("click", openSearch);
  });

  overlay && overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeSearch();
  });

  searchInput && searchInput.addEventListener("input", function () {
    activeIndex = 0;
    renderSearch(searchInput.value);
  });

  document.addEventListener("keydown", function (event) {
    var key = event.key;
    var metaK = (event.ctrlKey || event.metaKey) && (key === "k" || key === "K");
    if (metaK) {
      event.preventDefault();
      if (overlay.classList.contains("is-open")) closeSearch();
      else openSearch();
      return;
    }
    if (key === "Escape") {
      closeSearch();
      closeNav();
      return;
    }
    if (!overlay.classList.contains("is-open")) return;
    var items = filteredSections(searchInput.value);
    if (key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % Math.max(items.length, 1);
      renderSearch(searchInput.value);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % Math.max(items.length, 1);
      renderSearch(searchInput.value);
    } else if (key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      goTo(items[activeIndex].id);
    }
  });

  /* Quick notes */

  var notes = document.getElementById("quick-notes");
  var notesStatus = document.getElementById("notes-status");
  var saveTimer;

  if (notes) {
    var saved = storageGet(STORAGE.notes);
    if (saved) notes.value = saved;
    notes.addEventListener("input", function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        var ok = storageSet(STORAGE.notes, notes.value);
        if (notesStatus) {
          notesStatus.textContent = ok
            ? "Enregistré localement."
            : "Impossible d’enregistrer (stockage bloqué).";
        }
      }, 250);
    });
  }

  /* Ideas filter */

  var ideaCards = document.querySelectorAll("#ideas-grid .idea[data-status]");
  document.querySelectorAll("#ideas [data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var filter = btn.getAttribute("data-filter");
      document.querySelectorAll("#ideas [data-filter]").forEach(function (other) {
        other.classList.toggle("is-on", other === btn);
      });
      ideaCards.forEach(function (card) {
        var show = filter === "all" || card.getAttribute("data-status") === filter;
        card.hidden = !show;
      });
    });
  });

  /* Wiki filters */

  document.querySelectorAll("[data-wiki-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var filter = btn.getAttribute("data-wiki-filter");
      var target = btn.getAttribute("data-wiki-target");
      document
        .querySelectorAll('[data-wiki-filter][data-wiki-target="' + target + '"]')
        .forEach(function (other) {
          other.classList.toggle("is-on", other === btn);
        });

      if (target === "biomes") {
        document.querySelectorAll("#wiki-biomes-grid .wiki-entry").forEach(function (card) {
          var kind = card.getAttribute("data-wiki-kind");
          card.hidden = !(filter === "all" || kind === filter);
        });
      }

      if (target === "buildings") {
        document.querySelectorAll("#wiki-buildings-table tbody tr").forEach(function (row) {
          var kind = row.getAttribute("data-wiki-kind");
          row.hidden = !(filter === "all" || kind === filter);
        });
      }

      if (target === "pois") {
        document.querySelectorAll("#wiki-pois-grid .wiki-entry").forEach(function (card) {
          var kind = card.getAttribute("data-wiki-kind");
          card.hidden = !(filter === "all" || kind === filter);
        });
      }
    });
  });

  /* Kanban */

  var kanban = document.getElementById("kanban");
  if (kanban) {
    var columns = kanban.querySelectorAll("[data-column]");
    var dragged = null;

    function persistBacklog() {
      var state = {};
      columns.forEach(function (col) {
        var ids = Array.prototype.map.call(col.querySelectorAll(".task[data-id]"), function (task) {
          return task.getAttribute("data-id");
        });
        state[col.getAttribute("data-column")] = ids;
      });
      storageSet(STORAGE.backlog, JSON.stringify(state));
    }

    function restoreBacklog() {
      var raw = storageGet(STORAGE.backlog);
      if (!raw) return;
      var state;
      try {
        state = JSON.parse(raw);
      } catch (err) {
        return;
      }
      Object.keys(state).forEach(function (column) {
        var col = kanban.querySelector('[data-column="' + column + '"]');
        if (!col) return;
        state[column].forEach(function (id) {
          var task = kanban.querySelector('.task[data-id="' + id + '"]');
          if (task) col.appendChild(task);
        });
      });
    }

    restoreBacklog();

    kanban.querySelectorAll(".task").forEach(function (task) {
      task.addEventListener("dragstart", function (event) {
        dragged = task;
        task.style.opacity = "0.45";
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", task.getAttribute("data-id") || "");
        }
      });
      task.addEventListener("dragend", function () {
        task.style.opacity = "";
        dragged = null;
        columns.forEach(function (col) {
          col.classList.remove("is-over");
        });
      });
    });

    columns.forEach(function (col) {
      col.addEventListener("dragover", function (event) {
        event.preventDefault();
        col.classList.add("is-over");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      col.addEventListener("dragleave", function () {
        col.classList.remove("is-over");
      });
      col.addEventListener("drop", function (event) {
        event.preventDefault();
        col.classList.remove("is-over");
        if (dragged) {
          col.appendChild(dragged);
          persistBacklog();
        }
      });
    });
  }
})();
