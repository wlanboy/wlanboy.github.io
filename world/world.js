const countries = [
  // Afrika
  { name: "Ägypten",                    capital: "Kairo",             continent: "Africa",        code: "EG" },
  { name: "Äquatorialguinea",           capital: "Malabo",            continent: "Africa",        code: "GQ" },
  { name: "Äthiopien",                  capital: "Addis Abeba",       continent: "Africa",        code: "ET" },
  { name: "Algerien",                   capital: "Algier",            continent: "Africa",        code: "DZ" },
  { name: "Angola",                     capital: "Luanda",            continent: "Africa",        code: "AO" },
  { name: "Benin",                      capital: "Porto-Novo",        continent: "Africa",        code: "BJ" },
  { name: "Botswana",                   capital: "Gaborone",          continent: "Africa",        code: "BW" },
  { name: "Burkina Faso",               capital: "Ouagadougou",       continent: "Africa",        code: "BF" },
  { name: "Burundi",                    capital: "Gitega",            continent: "Africa",        code: "BI" },
  { name: "Cabo Verde",                 capital: "Praia",             continent: "Africa",        code: "CV" },
  { name: "Dem. Rep. Kongo",            capital: "Kinshasa",          continent: "Africa",        code: "CD" },
  { name: "Dschibuti",                  capital: "Dschibuti",         continent: "Africa",        code: "DJ" },
  { name: "Elfenbeinküste",             capital: "Yamoussoukro",      continent: "Africa",        code: "CI" },
  { name: "Eritrea",                    capital: "Asmara",            continent: "Africa",        code: "ER" },
  { name: "Eswatini",                   capital: "Mbabane",           continent: "Africa",        code: "SZ" },
  { name: "Gabun",                      capital: "Libreville",        continent: "Africa",        code: "GA" },
  { name: "Gambia",                     capital: "Banjul",            continent: "Africa",        code: "GM" },
  { name: "Ghana",                      capital: "Accra",             continent: "Africa",        code: "GH" },
  { name: "Guinea",                     capital: "Conakry",           continent: "Africa",        code: "GN" },
  { name: "Guinea-Bissau",              capital: "Bissau",            continent: "Africa",        code: "GW" },
  { name: "Kamerun",                    capital: "Yaoundé",           continent: "Africa",        code: "CM" },
  { name: "Kenia",                      capital: "Nairobi",           continent: "Africa",        code: "KE" },
  { name: "Komoren",                    capital: "Moroni",            continent: "Africa",        code: "KM" },
  { name: "Lesotho",                    capital: "Maseru",            continent: "Africa",        code: "LS" },
  { name: "Liberia",                    capital: "Monrovia",          continent: "Africa",        code: "LR" },
  { name: "Libyen",                     capital: "Tripolis",          continent: "Africa",        code: "LY" },
  { name: "Madagaskar",                 capital: "Antananarivo",      continent: "Africa",        code: "MG" },
  { name: "Malawi",                     capital: "Lilongwe",          continent: "Africa",        code: "MW" },
  { name: "Mali",                       capital: "Bamako",            continent: "Africa",        code: "ML" },
  { name: "Marokko",                    capital: "Rabat",             continent: "Africa",        code: "MA" },
  { name: "Mauretanien",                capital: "Nouakchott",        continent: "Africa",        code: "MR" },
  { name: "Mauritius",                  capital: "Port Louis",        continent: "Africa",        code: "MU" },
  { name: "Mosambik",                   capital: "Maputo",            continent: "Africa",        code: "MZ" },
  { name: "Namibia",                    capital: "Windhoek",          continent: "Africa",        code: "NA" },
  { name: "Niger",                      capital: "Niamey",            continent: "Africa",        code: "NE" },
  { name: "Nigeria",                    capital: "Abuja",             continent: "Africa",        code: "NG" },
  { name: "Rep. Kongo",                 capital: "Brazzaville",       continent: "Africa",        code: "CG" },
  { name: "Ruanda",                     capital: "Kigali",            continent: "Africa",        code: "RW" },
  { name: "São Tomé und Príncipe",      capital: "São Tomé",          continent: "Africa",        code: "ST" },
  { name: "Senegal",                    capital: "Dakar",             continent: "Africa",        code: "SN" },
  { name: "Seychellen",                 capital: "Victoria",          continent: "Africa",        code: "SC" },
  { name: "Sierra Leone",               capital: "Freetown",          continent: "Africa",        code: "SL" },
  { name: "Simbabwe",                   capital: "Harare",            continent: "Africa",        code: "ZW" },
  { name: "Somalia",                    capital: "Mogadischu",        continent: "Africa",        code: "SO" },
  { name: "Sudan",                      capital: "Khartum",           continent: "Africa",        code: "SD" },
  { name: "Südafrika",                  capital: "Pretoria",          continent: "Africa",        code: "ZA" },
  { name: "Südsudan",                   capital: "Juba",              continent: "Africa",        code: "SS" },
  { name: "Tansania",                   capital: "Dodoma",            continent: "Africa",        code: "TZ" },
  { name: "Togo",                       capital: "Lomé",              continent: "Africa",        code: "TG" },
  { name: "Tschad",                     capital: "N'Djamena",         continent: "Africa",        code: "TD" },
  { name: "Tunesien",                   capital: "Tunis",             continent: "Africa",        code: "TN" },
  { name: "Uganda",                     capital: "Kampala",           continent: "Africa",        code: "UG" },
  { name: "Sambia",                     capital: "Lusaka",            continent: "Africa",        code: "ZM" },
  { name: "Zentralafrikanische Rep.",   capital: "Bangui",            continent: "Africa",        code: "CF" },

  // Asien
  { name: "Afghanistan",                capital: "Kabul",             continent: "Asia",          code: "AF" },
  { name: "Armenien",                   capital: "Jerewan",           continent: "Asia",          code: "AM" },
  { name: "Aserbaidschan",              capital: "Baku",              continent: "Asia",          code: "AZ" },
  { name: "Bahrain",                    capital: "Manama",            continent: "Asia",          code: "BH" },
  { name: "Bangladesch",                capital: "Dhaka",             continent: "Asia",          code: "BD" },
  { name: "Bhutan",                     capital: "Thimphu",           continent: "Asia",          code: "BT" },
  { name: "Brunei",                     capital: "Bandar Seri Begawan", continent: "Asia",        code: "BN" },
  { name: "China",                      capital: "Peking",            continent: "Asia",          code: "CN" },
  { name: "Georgien",                   capital: "Tiflis",            continent: "Asia",          code: "GE" },
  { name: "Indien",                     capital: "Neu-Delhi",         continent: "Asia",          code: "IN" },
  { name: "Indonesien",                 capital: "Jakarta",           continent: "Asia",          code: "ID" },
  { name: "Irak",                       capital: "Bagdad",            continent: "Asia",          code: "IQ" },
  { name: "Iran",                       capital: "Teheran",           continent: "Asia",          code: "IR" },
  { name: "Israel",                     capital: "Jerusalem",         continent: "Asia",          code: "IL" },
  { name: "Japan",                      capital: "Tokio",             continent: "Asia",          code: "JP" },
  { name: "Jordanien",                  capital: "Amman",             continent: "Asia",          code: "JO" },
  { name: "Kambodscha",                 capital: "Phnom Penh",        continent: "Asia",          code: "KH" },
  { name: "Kasachstan",                 capital: "Astana",            continent: "Asia",          code: "KZ" },
  { name: "Katar",                      capital: "Doha",              continent: "Asia",          code: "QA" },
  { name: "Kirgisistan",                capital: "Bischkek",          continent: "Asia",          code: "KG" },
  { name: "Kuwait",                     capital: "Kuwait-Stadt",      continent: "Asia",          code: "KW" },
  { name: "Laos",                       capital: "Vientiane",         continent: "Asia",          code: "LA" },
  { name: "Libanon",                    capital: "Beirut",            continent: "Asia",          code: "LB" },
  { name: "Malaysia",                   capital: "Kuala Lumpur",      continent: "Asia",          code: "MY" },
  { name: "Malediven",                  capital: "Malé",              continent: "Asia",          code: "MV" },
  { name: "Mongolei",                   capital: "Ulaanbaatar",       continent: "Asia",          code: "MN" },
  { name: "Myanmar",                    capital: "Naypyidaw",         continent: "Asia",          code: "MM" },
  { name: "Nepal",                      capital: "Kathmandu",         continent: "Asia",          code: "NP" },
  { name: "Nordkorea",                  capital: "Pjöngjang",         continent: "Asia",          code: "KP" },
  { name: "Oman",                       capital: "Maskat",            continent: "Asia",          code: "OM" },
  { name: "Pakistan",                   capital: "Islamabad",         continent: "Asia",          code: "PK" },
  { name: "Palästina",                  capital: "Ramallah",          continent: "Asia",          code: "PS" },
  { name: "Philippinen",                capital: "Manila",            continent: "Asia",          code: "PH" },
  { name: "Saudi-Arabien",              capital: "Riad",              continent: "Asia",          code: "SA" },
  { name: "Singapur",                   capital: "Singapur",          continent: "Asia",          code: "SG" },
  { name: "Sri Lanka",                  capital: "Sri Jayawardenepura Kotte", continent: "Asia",  code: "LK" },
  { name: "Südkorea",                   capital: "Seoul",             continent: "Asia",          code: "KR" },
  { name: "Syrien",                     capital: "Damaskus",          continent: "Asia",          code: "SY" },
  { name: "Tadschikistan",              capital: "Duschanbe",         continent: "Asia",          code: "TJ" },
  { name: "Taiwan",                     capital: "Taipeh",            continent: "Asia",          code: "TW" },
  { name: "Thailand",                   capital: "Bangkok",           continent: "Asia",          code: "TH" },
  { name: "Timor-Leste",                capital: "Dili",              continent: "Asia",          code: "TL" },
  { name: "Türkei",                     capital: "Ankara",            continent: "Asia",          code: "TR" },
  { name: "Turkmenistan",               capital: "Aschgabat",         continent: "Asia",          code: "TM" },
  { name: "Usbekistan",                 capital: "Taschkent",         continent: "Asia",          code: "UZ" },
  { name: "VAE",                        capital: "Abu Dhabi",         continent: "Asia",          code: "AE" },
  { name: "Vietnam",                    capital: "Hanoi",             continent: "Asia",          code: "VN" },
  { name: "Jemen",                      capital: "Sanaa",             continent: "Asia",          code: "YE" },

  // Europa
  { name: "Albanien",                   capital: "Tirana",            continent: "Europe",        code: "AL" },
  { name: "Andorra",                    capital: "Andorra la Vella",  continent: "Europe",        code: "AD" },
  { name: "Belgien",                    capital: "Brüssel",           continent: "Europe",        code: "BE" },
  { name: "Belarus",                    capital: "Minsk",             continent: "Europe",        code: "BY" },
  { name: "Bosnien-Herzegowina",        capital: "Sarajevo",          continent: "Europe",        code: "BA" },
  { name: "Bulgarien",                  capital: "Sofia",             continent: "Europe",        code: "BG" },
  { name: "Dänemark",                   capital: "Kopenhagen",        continent: "Europe",        code: "DK" },
  { name: "Deutschland",                capital: "Berlin",            continent: "Europe",        code: "DE" },
  { name: "Estland",                    capital: "Tallinn",           continent: "Europe",        code: "EE" },
  { name: "Finnland",                   capital: "Helsinki",          continent: "Europe",        code: "FI" },
  { name: "Frankreich",                 capital: "Paris",             continent: "Europe",        code: "FR" },
  { name: "Griechenland",               capital: "Athen",             continent: "Europe",        code: "GR" },
  { name: "Irland",                     capital: "Dublin",            continent: "Europe",        code: "IE" },
  { name: "Island",                     capital: "Reykjavík",         continent: "Europe",        code: "IS" },
  { name: "Italien",                    capital: "Rom",               continent: "Europe",        code: "IT" },
  { name: "Kosovo",                     capital: "Pristina",          continent: "Europe",        code: "XK" },
  { name: "Kroatien",                   capital: "Zagreb",            continent: "Europe",        code: "HR" },
  { name: "Lettland",                   capital: "Riga",              continent: "Europe",        code: "LV" },
  { name: "Liechtenstein",              capital: "Vaduz",             continent: "Europe",        code: "LI" },
  { name: "Litauen",                    capital: "Vilnius",           continent: "Europe",        code: "LT" },
  { name: "Luxemburg",                  capital: "Luxemburg",         continent: "Europe",        code: "LU" },
  { name: "Malta",                      capital: "Valletta",          continent: "Europe",        code: "MT" },
  { name: "Moldau",                     capital: "Chișinău",          continent: "Europe",        code: "MD" },
  { name: "Monaco",                     capital: "Monaco",            continent: "Europe",        code: "MC" },
  { name: "Montenegro",                 capital: "Podgorica",         continent: "Europe",        code: "ME" },
  { name: "Niederlande",                capital: "Amsterdam",         continent: "Europe",        code: "NL" },
  { name: "Nordmazedonien",             capital: "Skopje",            continent: "Europe",        code: "MK" },
  { name: "Norwegen",                   capital: "Oslo",              continent: "Europe",        code: "NO" },
  { name: "Österreich",                 capital: "Wien",              continent: "Europe",        code: "AT" },
  { name: "Polen",                      capital: "Warschau",          continent: "Europe",        code: "PL" },
  { name: "Portugal",                   capital: "Lissabon",          continent: "Europe",        code: "PT" },
  { name: "Rumänien",                   capital: "Bukarest",          continent: "Europe",        code: "RO" },
  { name: "Russland",                   capital: "Moskau",            continent: "Europe",        code: "RU" },
  { name: "San Marino",                 capital: "San Marino",        continent: "Europe",        code: "SM" },
  { name: "Schweden",                   capital: "Stockholm",         continent: "Europe",        code: "SE" },
  { name: "Schweiz",                    capital: "Bern",              continent: "Europe",        code: "CH" },
  { name: "Serbien",                    capital: "Belgrad",           continent: "Europe",        code: "RS" },
  { name: "Slowakei",                   capital: "Bratislava",        continent: "Europe",        code: "SK" },
  { name: "Slowenien",                  capital: "Ljubljana",         continent: "Europe",        code: "SI" },
  { name: "Spanien",                    capital: "Madrid",            continent: "Europe",        code: "ES" },
  { name: "Tschechien",                 capital: "Prag",              continent: "Europe",        code: "CZ" },
  { name: "Ukraine",                    capital: "Kiew",              continent: "Europe",        code: "UA" },
  { name: "Ungarn",                     capital: "Budapest",          continent: "Europe",        code: "HU" },
  { name: "Vatikanstadt",               capital: "Vatikanstadt",      continent: "Europe",        code: "VA" },
  { name: "Vereinigtes Königreich",     capital: "London",            continent: "Europe",        code: "GB" },
  { name: "Zypern",                     capital: "Nikosia",           continent: "Europe",        code: "CY" },

  // Nordamerika
  { name: "Antigua und Barbuda",        capital: "Saint John's",      continent: "North America", code: "AG" },
  { name: "Bahamas",                    capital: "Nassau",            continent: "North America", code: "BS" },
  { name: "Barbados",                   capital: "Bridgetown",        continent: "North America", code: "BB" },
  { name: "Belize",                     capital: "Belmopan",          continent: "North America", code: "BZ" },
  { name: "Costa Rica",                 capital: "San José",          continent: "North America", code: "CR" },
  { name: "Dominica",                   capital: "Roseau",            continent: "North America", code: "DM" },
  { name: "Dominikanische Republik",    capital: "Santo Domingo",     continent: "North America", code: "DO" },
  { name: "El Salvador",                capital: "San Salvador",      continent: "North America", code: "SV" },
  { name: "Grenada",                    capital: "Saint George's",    continent: "North America", code: "GD" },
  { name: "Guatemala",                  capital: "Guatemala-Stadt",   continent: "North America", code: "GT" },
  { name: "Haiti",                      capital: "Port-au-Prince",    continent: "North America", code: "HT" },
  { name: "Honduras",                   capital: "Tegucigalpa",       continent: "North America", code: "HN" },
  { name: "Jamaika",                    capital: "Kingston",          continent: "North America", code: "JM" },
  { name: "Kanada",                     capital: "Ottawa",            continent: "North America", code: "CA" },
  { name: "Kuba",                       capital: "Havanna",           continent: "North America", code: "CU" },
  { name: "Mexiko",                     capital: "Mexiko-Stadt",      continent: "North America", code: "MX" },
  { name: "Nicaragua",                  capital: "Managua",           continent: "North America", code: "NI" },
  { name: "Panama",                     capital: "Panama-Stadt",      continent: "North America", code: "PA" },
  { name: "St. Kitts und Nevis",        capital: "Basseterre",        continent: "North America", code: "KN" },
  { name: "St. Lucia",                  capital: "Castries",          continent: "North America", code: "LC" },
  { name: "St. Vincent & Grenadinen",   capital: "Kingstown",         continent: "North America", code: "VC" },
  { name: "Trinidad und Tobago",        capital: "Port of Spain",     continent: "North America", code: "TT" },
  { name: "USA",                        capital: "Washington D.C.",   continent: "North America", code: "US" },

  // Südamerika
  { name: "Argentinien",                capital: "Buenos Aires",      continent: "South America", code: "AR" },
  { name: "Bolivien",                   capital: "Sucre",             continent: "South America", code: "BO" },
  { name: "Brasilien",                  capital: "Brasília",          continent: "South America", code: "BR" },
  { name: "Chile",                      capital: "Santiago de Chile", continent: "South America", code: "CL" },
  { name: "Ecuador",                    capital: "Quito",             continent: "South America", code: "EC" },
  { name: "Guyana",                     capital: "Georgetown",        continent: "South America", code: "GY" },
  { name: "Kolumbien",                  capital: "Bogotá",            continent: "South America", code: "CO" },
  { name: "Paraguay",                   capital: "Asunción",          continent: "South America", code: "PY" },
  { name: "Peru",                       capital: "Lima",              continent: "South America", code: "PE" },
  { name: "Suriname",                   capital: "Paramaribo",        continent: "South America", code: "SR" },
  { name: "Uruguay",                    capital: "Montevideo",        continent: "South America", code: "UY" },
  { name: "Venezuela",                  capital: "Caracas",           continent: "South America", code: "VE" },

  // Ozeanien
  { name: "Australien",                 capital: "Canberra",          continent: "Oceania",       code: "AU" },
  { name: "Fidschi",                    capital: "Suva",              continent: "Oceania",       code: "FJ" },
  { name: "Kiribati",                   capital: "South Tarawa",      continent: "Oceania",       code: "KI" },
  { name: "Marshallinseln",             capital: "Majuro",            continent: "Oceania",       code: "MH" },
  { name: "Mikronesien",                capital: "Palikir",           continent: "Oceania",       code: "FM" },
  { name: "Nauru",                      capital: "Yaren",             continent: "Oceania",       code: "NR" },
  { name: "Neuseeland",                 capital: "Wellington",        continent: "Oceania",       code: "NZ" },
  { name: "Palau",                      capital: "Ngerulmud",         continent: "Oceania",       code: "PW" },
  { name: "Papua-Neuguinea",            capital: "Port Moresby",      continent: "Oceania",       code: "PG" },
  { name: "Salomonen",                  capital: "Honiara",           continent: "Oceania",       code: "SB" },
  { name: "Samoa",                      capital: "Apia",              continent: "Oceania",       code: "WS" },
  { name: "Tonga",                      capital: "Nukuʻalofa",        continent: "Oceania",       code: "TO" },
  { name: "Tuvalu",                     capital: "Funafuti",          continent: "Oceania",       code: "TV" },
  { name: "Vanuatu",                    capital: "Port Vila",         continent: "Oceania",       code: "VU" },
];

const continentLabel = {
  "Africa":        "Afrika",
  "Asia":          "Asien",
  "Europe":        "Europa",
  "North America": "N.Amerika",
  "South America": "S.Amerika",
  "Oceania":       "Ozeanien",
};

const continentClass = {
  "Africa":        "cb-africa",
  "Asia":          "cb-asia",
  "Europe":        "cb-europe",
  "North America": "cb-namerica",
  "South America": "cb-samerica",
  "Oceania":       "cb-oceania",
};

function flagEmoji(code) {
  if (!code || code.length !== 2) return "🏳";
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('');
}

function buildGrid() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '';
  countries.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'country-card';
    card.dataset.continent = c.continent;
    card.dataset.name = c.name.toLowerCase();
    card.dataset.capital = c.capital.toLowerCase();
    card.dataset.index = i;
    card.innerHTML = `
      <span class="continent-badge ${continentClass[c.continent]}">${continentLabel[c.continent]}</span>
      <div class="country-flag">${flagEmoji(c.code)}</div>
      <div class="country-name">${c.name}</div>
      <div class="country-capital">🏛 ${c.capital}</div>
    `;
    grid.appendChild(card);
  });
}

function applyFilters() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const continent = document.getElementById('continentFilter').value;
  const cards = document.querySelectorAll('.country-card');
  let visible = 0;
  cards.forEach(card => {
    const matchContinent = !continent || card.dataset.continent === continent;
    const matchSearch = !query ||
      card.dataset.name.includes(query) ||
      card.dataset.capital.includes(query);
    const show = matchContinent && matchSearch;
    card.classList.toggle('hidden-card', !show);
    if (show) visible++;
  });
  const info = document.getElementById('result-info');
  info.textContent = visible === countries.length
    ? `${countries.length} Länder`
    : `${visible} von ${countries.length} Ländern`;
}

// Theme toggle
const btn = document.getElementById('toggleTheme');
const saved = localStorage.getItem('world-theme');
if (saved === 'light') { document.body.classList.add('light'); btn.textContent = '☀️'; }

btn.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  btn.textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('world-theme', isLight ? 'light' : 'dark');
});

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('continentFilter').addEventListener('change', applyFilters);

// Modal
const modal = document.getElementById('flag-modal');
const modalFlag = document.getElementById('modal-flag');
const modalName = document.getElementById('modal-name');
const modalCapital = document.getElementById('modal-capital');
const modalInfo = document.getElementById('modal-info');
const modalToggle = document.getElementById('modal-toggle');

function openModal(c) {
  modalFlag.textContent = flagEmoji(c.code);
  modalName.textContent = c.name;
  modalCapital.textContent = '🏛 ' + c.capital;
  modalInfo.classList.remove('hidden-info');
  modalToggle.textContent = 'Verstecken';
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

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

buildGrid();
applyFilters();
