const devices = [
  {
    name: "Raspberry Pi 1 Model B",
    year: 2012,
    vendor: "arm",
    vendorLabel: "ARM",
    cpu: "ARM1176JZF-S · 1C/1T · 700 MHz",
    ram: "512 MB SDRAM",
    gpu: "VideoCore IV · ~24 GFLOPS",
    tdpW: 2,
    tdp: "~2 W",
    storage: "SD-Karte",
    network: "100 Mbit LAN · USB 2.0 ×2",
    os: "Raspberry Pi OS 32-Bit · Linux",
    usecase: "IoT, Lernen, einfache Miniserver",
    cb23: 30,
    perf: 0.2
  },
  {
    name: "Raspberry Pi 2 Model B",
    year: 2015,
    vendor: "arm",
    vendorLabel: "ARM",
    cpu: "Cortex-A7 · 4C/4T · 900 MHz",
    ram: "1 GB LPDDR2",
    gpu: "VideoCore IV · ~24 GFLOPS",
    tdpW: 3,
    tdp: "~3 W",
    storage: "MicroSD",
    network: "100 Mbit LAN · USB 2.0 ×4",
    os: "Raspberry Pi OS 32/64-Bit · Linux",
    usecase: "Miniserver, IoT, Heimautomation",
    cb23: 200,
    perf: 1.2
  },
  {
    name: "Bqeel Z83 II",
    year: 2017,
    vendor: "intel",
    vendorLabel: "Intel",
    cpu: "Atom x5-Z8350 · 4C/4T · 1.44 / 1.92 GHz",
    ram: "2 GB DDR3L-1600",
    gpu: "Intel HD Graphics 400 · ~230 GFLOPS",
    tdpW: 4,
    tdp: "4 W",
    storage: "32 GB eMMC",
    network: "100 Mbit LAN · WiFi 5 · BT 4.0 · USB 3.0",
    os: "Windows 10 · Linux",
    usecase: "Thin Client, HTPC, leichtes Büro",
    cb23: 600,
    perf: 3.8
  },
  {
    name: "Raspberry Pi 400",
    year: 2020,
    vendor: "arm",
    vendorLabel: "ARM",
    cpu: "Cortex-A72 · 4C/4T · 1.8 GHz",
    ram: "4 GB LPDDR4-3200",
    gpu: "VideoCore VI · ~55 GFLOPS",
    tdpW: 5,
    tdp: "~5 W",
    storage: "MicroSD",
    network: "GbE · WiFi 5 · BT 5.0 · USB 3.0 ×2",
    os: "Raspberry Pi OS 64-Bit · Linux",
    usecase: "Desktop-Ersatz, Entwicklung, Bildung",
    cb23: 2000,
    perf: 12.5
  },
  {
    name: "Intel NUC7PJYH",
    year: 2018,
    vendor: "intel",
    vendorLabel: "Intel",
    cpu: "Pentium Silver J5005 · 4C/4T · 1.50 / 2.80 GHz",
    ram: "8 GB DDR4-2400",
    gpu: "Intel UHD Graphics 605 · ~403 GFLOPS",
    tdpW: 10,
    tdp: "10 W",
    storage: "M.2 SATA + 2,5\" SATA",
    network: "GbE · WiFi 5 · BT 5.0 · USB 3.1 · HDMI 2.0",
    os: "Windows · Linux",
    usecase: "Heimserver, Büro, HTPC",
    cb23: 2200,
    perf: 13.7
  },
  {
    name: "Intel NUC (i5-7260U)",
    year: 2017,
    vendor: "intel",
    vendorLabel: "Intel",
    cpu: "Core i5-7260U · 2C/4T · 2.20 / 3.40 GHz",
    ram: "32 GB DDR4-2133",
    gpu: "Intel Iris Plus 640 · ~832 GFLOPS",
    tdpW: 15,
    tdp: "15 W",
    storage: "M.2 NVMe + 2,5\" SATA",
    network: "Thunderbolt 3 · GbE · WiFi 5 · BT · USB 3.0 · HDMI",
    os: "Windows · Linux",
    usecase: "Entwicklung, Virtualisierung, Büro",
    cb23: 2800,
    perf: 17.5
  },
  {
    name: "AWOW Mini PC (N150)",
    year: 2024,
    vendor: "intel",
    vendorLabel: "Intel",
    cpu: "Intel N150 · 4C/4T · 0.80 / 3.60 GHz",
    ram: "16 GB DDR4-3200",
    gpu: "Intel UHD Graphics (48 EU) · ~730 GFLOPS",
    tdpW: 6,
    tdp: "6 W",
    storage: "NVMe M.2 (PCIe 3.0)",
    network: "GbE · WiFi 5 · BT 4.2 · USB 3.2 · HDMI 2.0 · DP 1.4",
    os: "Windows 11 · Linux",
    usecase: "Energieeffizienter Server, NAS, Thin Client",
    cb23: 4700,
    perf: 29
  },
  {
    name: "GMKtec G3 Plus (N150)",
    year: 2024,
    vendor: "intel",
    vendorLabel: "Intel",
    cpu: "Intel N150 · 4C/4T · 0.80 / 3.60 GHz",
    ram: "16 GB DDR5-4800",
    gpu: "Intel UHD Graphics (48 EU) · ~730 GFLOPS",
    tdpW: 6,
    tdp: "6 W",
    storage: "NVMe M.2 (PCIe 3.0)",
    network: "2,5 GbE · WiFi 6 · BT 5.2 · USB 3.2 · HDMI 2.0 · DP 1.4",
    os: "Windows 11 · Linux",
    usecase: "Energieeffizienter Server, NAS, Büro",
    cb23: 4800,
    perf: 30
  },
  {
    name: "Beelink SER5 (5800H)",
    year: 2022,
    vendor: "amd",
    vendorLabel: "AMD",
    cpu: "Ryzen 7 5800H · 8C/16T · 3.20 / 4.40 GHz",
    ram: "32 GB DDR4-3200",
    gpu: "Radeon RX Vega 8 · ~1126 GFLOPS",
    tdpW: 45,
    tdp: "45 W (konfig.)",
    storage: "M.2 NVMe (PCIe 3.0) + 2,5\" SATA",
    network: "2,5 GbE · WiFi 6 · BT 5.0 · USB 3.2 · HDMI 2.0 · DP 1.4",
    os: "Windows 11 · Linux",
    usecase: "Entwicklung, Virtualisierung, leichtes Gaming, KI",
    cb23: 13500,
    perf: 84
  },
  {
    name: "Minisforum UM890 Pro",
    year: 2024,
    vendor: "amd",
    vendorLabel: "AMD",
    cpu: "Ryzen 9 8945HS · 8C/16T · 4.00 / 5.20 GHz",
    ram: "32 GB DDR5-5600",
    gpu: "Radeon 780M RDNA 3 · ~3700 GFLOPS",
    tdpW: 65,
    tdp: "45–65 W (konfig.)",
    storage: "M.2 NVMe (PCIe 4.0) + 2,5\" SATA",
    network: "2,5 GbE · WiFi 6E · BT 5.3 · USB 4 · TB4 · HDMI 2.1 · DP 2.0",
    os: "Windows 11 · Linux",
    usecase: "Workstation, Gaming, KI/ML, Virtualisierung",
    cb23: 16000,
    perf: 100
  }
];

devices.forEach(d => { d.eff = Math.round(d.cb23 / d.tdpW); });
const maxEff = Math.max(...devices.map(d => d.eff));

function getPerfClass(perf) {
  if (perf <= 5)  return 'perf-low';
  if (perf <= 25) return 'perf-mid';
  if (perf <= 70) return 'perf-high';
  return 'perf-top';
}

function renderCards(sorted) {
  const grid = document.getElementById('grid');
  grid.innerHTML = sorted.map(d => {
    const effPct = Math.round((d.eff / maxEff) * 100);
    return `
    <div class="card" data-vendor="${d.vendor}">
      <span class="badge badge-${d.vendor}">${d.vendorLabel}</span>
      <span class="repo-name">${d.year}</span>
      <div class="card-title">${d.name}</div>

      <div class="perf-section">
        <div class="perf-label">
          <span>Cinebench R23 Multi-Core</span>
          <span>${d.cb23.toLocaleString('de-DE')}</span>
        </div>
        <div class="perf-bar-bg">
          <div class="perf-bar-fill ${getPerfClass(d.perf)}" style="width:${Math.max(d.perf, 0.5)}%"></div>
        </div>
        <div class="perf-label" style="margin-top:6px">
          <span>Effizienz (CB/W)</span>
          <span>${d.eff}</span>
        </div>
        <div class="eff-bar-bg">
          <div class="eff-bar-fill" style="width:${effPct}%"></div>
        </div>
      </div>

      <table class="spec-table">
        <tr><td>CPU</td><td>${d.cpu}</td></tr>
        <tr><td>RAM</td><td>${d.ram}</td></tr>
        <tr><td>GPU</td><td>${d.gpu}</td></tr>
        <tr><td>TDP</td><td>${d.tdp}</td></tr>
        <tr><td>Speicher</td><td>${d.storage}</td></tr>
        <tr><td>Netzwerk</td><td>${d.network}</td></tr>
        <tr><td>OS</td><td>${d.os}</td></tr>
        <tr><td>Einsatz</td><td>${d.usecase}</td></tr>
      </table>
    </div>`;
  }).join('');
}

function sortAndRender(key) {
  const sorted = [...devices].sort((a, b) => a[key] - b[key]);
  renderCards(sorted);
}

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortAndRender(btn.dataset.sort);
  });
});

document.getElementById('toggleTheme').addEventListener('click', () =>
  document.body.classList.toggle('light'));

sortAndRender('perf');
