const countries = [
  // Norden
  { name: "Bremen",                     capital: "Bremen",       region: "Nord", code: "HB",
    flag: "repeating-linear-gradient(to bottom, #C8102E 0 12.5%, #ffffff 12.5% 25%)" },
  { name: "Hamburg",                    capital: "Hamburg",      region: "Nord", code: "HH",
    flag: "#ffffff", emblem: "🏰" },
  { name: "Mecklenburg-Vorpommern",     capital: "Schwerin",     region: "Nord", code: "MV",
    flag: "linear-gradient(to bottom, #003399 0 26.67%, #ffffff 26.67% 46.67%, #FFCC00 46.67% 53.33%, #ffffff 53.33% 73.33%, #C8102E 73.33% 100%)" },
  { name: "Niedersachsen",              capital: "Hannover",     region: "Nord", code: "NI",
    flag: "linear-gradient(to bottom, #000000 0 33.33%, #C8102E 33.33% 66.66%, #FFCC00 66.66% 100%)", emblem: "🐎" },
  { name: "Schleswig-Holstein",         capital: "Kiel",         region: "Nord", code: "SH",
    flag: "linear-gradient(to bottom, #003399 0 33.33%, #ffffff 33.33% 66.66%, #C8102E 66.66% 100%)" },

  // Osten
  { name: "Berlin",                     capital: "Berlin",       region: "Ost",  code: "BE",
    flag: "linear-gradient(to right, #E30017 0 20%, #ffffff 20% 80%, #E30017 80% 100%)", emblem: "🐻" },
  { name: "Brandenburg",                capital: "Potsdam",      region: "Ost",  code: "BB",
    flag: "linear-gradient(to bottom, #C8102E 50%, #ffffff 50%)", emblem: "🦅" },
  { name: "Sachsen",                    capital: "Dresden",      region: "Ost",  code: "SN",
    flag: "linear-gradient(to bottom, #ffffff 50%, #0C8B44 50%)" },
  { name: "Sachsen-Anhalt",             capital: "Magdeburg",    region: "Ost",  code: "ST",
    flag: "linear-gradient(to bottom, #FFCC00 50%, #000000 50%)" },
  { name: "Thüringen",                  capital: "Erfurt",       region: "Ost",  code: "TH",
    flag: "linear-gradient(to bottom, #ffffff 50%, #C8102E 50%)" },

  // Süden
  { name: "Baden-Württemberg",          capital: "Stuttgart",    region: "Sued", code: "BW",
    flag: "linear-gradient(to bottom, #000000 50%, #FFCC00 50%)" },
  { name: "Bayern",                     capital: "München",      region: "Sued", code: "BY",
    flag: "linear-gradient(to bottom, #ffffff 50%, #0069B4 50%)" },

  // Westen
  { name: "Nordrhein-Westfalen",        capital: "Düsseldorf",   region: "West", code: "NW",
    flag: "linear-gradient(to bottom, #00A550 0 33.33%, #ffffff 33.33% 66.66%, #C8102E 66.66% 100%)" },
  { name: "Rheinland-Pfalz",            capital: "Mainz",        region: "West", code: "RP",
    flag: "linear-gradient(to bottom, #000000 0 33.33%, #C8102E 33.33% 66.66%, #FFCC00 66.66% 100%)" },
  { name: "Saarland",                   capital: "Saarbrücken",  region: "West", code: "SL",
    flag: "linear-gradient(to bottom, #000000 0 33.33%, #C8102E 33.33% 66.66%, #FFCC00 66.66% 100%)", emblem: "🛡️" },

  // Mitte
  { name: "Hessen",                     capital: "Wiesbaden",    region: "Mitte", code: "HE",
    flag: "linear-gradient(to bottom, #C8102E 50%, #ffffff 50%)" },
];

const continentLabel = {
  "Nord":  "Norden",
  "Ost":   "Osten",
  "Sued":  "Süden",
  "West":  "Westen",
  "Mitte": "Mitte",
};

const continentClass = {
  "Nord":  "cb-nord",
  "Ost":   "cb-ost",
  "Sued":  "cb-sued",
  "West":  "cb-west",
  "Mitte": "cb-mitte",
};

function buildGrid() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '';
  countries.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'country-card';
    card.dataset.continent = c.region;
    card.dataset.name = c.name.toLowerCase();
    card.dataset.capital = c.capital.toLowerCase();
    card.dataset.index = i;
    card.innerHTML = `
      <span class="continent-badge ${continentClass[c.region]}">${continentLabel[c.region]}</span>
      <div class="country-flag" style="background:${c.flag}" title="${c.code}">${c.emblem || ''}</div>
      <div class="country-name">${c.name}</div>
      <div class="country-capital">🏛 ${c.capital}</div>
    `;
    grid.appendChild(card);
  });
}

function applyFilters() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const region = document.getElementById('regionFilter').value;
  const cards = document.querySelectorAll('.country-card');
  let visible = 0;
  cards.forEach(card => {
    const matchRegion = !region || card.dataset.continent === region;
    const matchSearch = !query ||
      card.dataset.name.includes(query) ||
      card.dataset.capital.includes(query);
    const show = matchRegion && matchSearch;
    card.classList.toggle('hidden-card', !show);
    if (show) visible++;
  });
  const info = document.getElementById('result-info');
  info.textContent = visible === countries.length
    ? `${countries.length} Bundesländer`
    : `${visible} von ${countries.length} Bundesländern`;
}

// Theme toggle
const btn = document.getElementById('toggleTheme');
const saved = localStorage.getItem('bund-theme');
if (saved === 'light') { document.body.classList.add('light'); btn.textContent = '☀️'; }

btn.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  btn.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('bund-theme', isLight ? 'light' : 'dark');
});

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('regionFilter').addEventListener('change', applyFilters);

// Modal
const modal = document.getElementById('flag-modal');
const modalFlag = document.getElementById('modal-flag');
const modalName = document.getElementById('modal-name');
const modalCapital = document.getElementById('modal-capital');
const modalInfo = document.getElementById('modal-info');
const modalToggle = document.getElementById('modal-toggle');

function openModal(c, startHidden = false) {
  modalFlag.style.background = c.flag;
  modalFlag.textContent = c.emblem || '';
  modalName.textContent = c.name;
  modalCapital.textContent = '🏛 ' + c.capital;
  modalInfo.classList.toggle('hidden-info', startHidden);
  modalToggle.textContent = startHidden ? 'Anzeigen' : 'Verstecken';
  modal.classList.add('open');
}

function closeModal() { modal.classList.remove('open'); }

document.getElementById('country-grid').addEventListener('click', e => {
  const card = e.target.closest('.country-card');
  if (!card) return;
  openModal(countries[+card.dataset.index]);
});

modalToggle.addEventListener('click', () => {
  const hidden = modalInfo.classList.toggle('hidden-info');
  modalToggle.textContent = hidden ? 'Anzeigen' : 'Verstecken';
});

document.getElementById('guessBtn').addEventListener('click', () => {
  const region = document.getElementById('regionFilter').value;
  const pool = region ? countries.filter(c => c.region === region) : countries;
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  openModal(pick, true);
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

buildGrid();
applyFilters();
