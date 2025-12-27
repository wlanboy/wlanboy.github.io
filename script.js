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
    const response = await fetch("readme-data.json");
    const repos = await response.json();

    // Flatten: jede README wird eine eigene Kachel
    allItems = repos.flatMap(repo =>
        repo.readmes.map(r => ({
            repo: repo.name,
            title: r.title,
            description: r.description,
            path: r.path,
            url: repo.url,
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

        // README direkt öffnen
        card.addEventListener("click", () => {
            const readmeUrl = `${item.url}/blob/main/${item.path}`;
            window.open(readmeUrl, "_blank");
        });

        grid.appendChild(card);
    });

    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    grid.appendChild(sentinel);
    observer.observe(sentinel);
}

// -------------------------------
// MODAL
// -------------------------------
function openModal(item) {
    modalTitle.textContent = item.title;
    modalRepo.textContent = item.repo;
    modalText.textContent = item.fullText;
    modal.classList.remove("hidden");
}

modalClose.addEventListener("click", () => {
    modal.classList.add("hidden");
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
            item.repo.toLowerCase().includes(q))
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
