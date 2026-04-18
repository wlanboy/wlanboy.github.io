let allItems = [];
let filteredItems = [];
let index = 0;
let sortMode = "date";
const batchSize = 20;

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const sortBtn = document.getElementById("sortRepo");
const themeBtn = document.getElementById("toggleTheme");
const repoFilter = document.getElementById("repoFilter");

const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalRepo = document.getElementById("modalRepo");
const modalText = document.getElementById("modalText");
const modalLink = document.getElementById("modalLink");

let observer;

// -------------------------------
// THEME HANDLING
// -------------------------------
function applyTheme() {
    const theme = localStorage.getItem("theme") || "dark";
    document.body.classList.toggle("light", theme === "light");
}

themeBtn.addEventListener("click", () => {
    const current = localStorage.getItem("theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme();
});

applyTheme();

// -------------------------------
// LOAD JSON
// -------------------------------
async function loadData() {
    let repos;
    try {
        const response = await fetch("readme-data.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        repos = await response.json();
    } catch (err) {
        grid.innerHTML = `<div class="error-msg">Daten konnten nicht geladen werden: ${err.message}</div>`;
        return;
    }

    // Flatten: jede README wird eine eigene Kachel
    allItems = repos.flatMap(repo =>
        repo.readmes.map(r => ({
            repo: repo.name,
            title: r.title,
            description: r.description,
            path: r.path,
            type: r.type,
            url: repo.url,
            branch: repo.default_branch || "main",
            fullText: `# ${r.title}\n\n${r.description}`,
            pushed_at: repo.pushed_at
        }))
    );

    // Repo-Liste für Dropdown
    const repoNames = [...new Set(allItems.map(i => i.repo))].sort();
    repoNames.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        repoFilter.appendChild(opt);
    });

    filteredItems = [...allItems];
    filteredItems.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    setupLazyLoading();
    loadMore();
}

// -------------------------------
// LAZY LOADING
// -------------------------------
function setupLazyLoading() {
    observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
            loadMore();
        }
    });
}

function loadMore() {
    const slice = filteredItems.slice(index, index + batchSize);
    index += batchSize;

    slice.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const badgeClass = item.type === "readme" ? "badge-readme" : "badge-text";
        const badgeLabel = item.type === "readme" ? "README" : "MD";

        card.innerHTML = `
      <div class="badge ${badgeClass}">${badgeLabel}</div>
      <div class="repo-name">${item.repo}</div>
      <div class="card-title">${item.title}</div>
      <div class="card-desc">${item.description}</div>
    `;

        card.addEventListener("click", () => openModal(item));

        grid.appendChild(card);
    });

    if (index < filteredItems.length) {
        const sentinel = document.createElement("div");
        sentinel.style.height = "1px";
        grid.appendChild(sentinel);
        observer.observe(sentinel);
    }
}

// -------------------------------
// MODAL
// -------------------------------
function openModal(item) {
    modalTitle.textContent = item.title;
    modalRepo.textContent = item.repo + " / " + item.path;
    modalText.textContent = item.fullText;
    modalLink.href = `${item.url}/blob/${item.branch}/${item.path}`;
    modal.classList.remove("hidden");
}

function closeModal() {
    modal.classList.add("hidden");
}

modalClose.addEventListener("click", closeModal);

// Backdrop-Klick schließt Modal
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

// ESC schließt Modal
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// -------------------------------
// SEARCH FILTER
// -------------------------------
searchInput.addEventListener("input", applyFilters);

// -------------------------------
// REPO FILTER
// -------------------------------
repoFilter.addEventListener("change", applyFilters);

// -------------------------------
// SORT BY REPO
// -------------------------------
sortBtn.addEventListener("click", () => {
    if (sortMode === "date") {
        filteredItems.sort((a, b) => a.repo.localeCompare(b.repo));
        sortMode = "repo";
        sortBtn.textContent = "Sortiere nach Datum";
    } else {
        filteredItems.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
        sortMode = "date";
        sortBtn.textContent = "Sortiere nach Repo";
    }
    resetGrid();
});


// -------------------------------
// FILTER LOGIC
// -------------------------------
function applyFilters() {
    const q = searchInput.value.toLowerCase();
    const repo = repoFilter.value;

    filteredItems = allItems.filter(item =>
        (repo === "" || item.repo === repo) &&
        (item.title.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.repo.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q))
    );

    resetGrid();
}

// -------------------------------
// RESET GRID
// -------------------------------
function resetGrid() {
    grid.innerHTML = "";
    index = 0;
    loadMore();
}

// -------------------------------
loadData();
