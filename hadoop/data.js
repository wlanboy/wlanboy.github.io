(function () {
  const GROUP_HUES = {
    "hdfs": 195,
    "hadoop": 38,
  };

  // Per-group force-simulation tuning.
  // hdfs: dense core of 5 highly connected nodes → shorter springs + more repulsion so labels breathe.
  const GROUP_OPTS = {
    "hdfs": { repel: 18000, springL: 160, spring: 0.008, gravity: 0.002, iters: 480 },
    "hadoop": { gravity: 0.005 },
  };

  function formatDetails(details) {
    const lines = [];
    for (const d of details) {
      if (Array.isArray(d)) {
        for (const item of d) lines.push("• " + item);
      } else {
        lines.push(d);
      }
    }
    return lines.join("\n");
  }

  function magFromConnections(count) {
    if (count >= 5) return 1;
    if (count >= 3) return 2;
    return 3;
  }

  const raw = {
    "groups": [
      { "id": "hdfs", "label": "HDFS Konzepte", "color": "#0891b2" },
      { "id": "hadoop", "label": "Hadoop Cluster", "color": "#d97706" }
    ],

    "topics": [

      /* -----------------------------------------------------------
       * HDFS BLOCKS & REPLICATION
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-block",
        "label": "Blöcke & Replikation",
        "group": "hdfs",
        "description": "HDFS speichert Dateien als Sequenz gleichgroßer Blöcke. Kleine Dateien profitieren von reduzierter Blockanzahl.",
        "details": [
          "Produktive Blockgröße für gemischte Workloads: dfs.blocksize = 33554432 (32 MB).",
          "Begründung: 32 MB reduziert Blockanzahl bei Small-Files, ohne die Fragmentierung großer Dateien zu stark zu erhöhen.",
          "Replikationsfaktor: dfs.replication = 3 (Standard für Produktionscluster).",
          "Replikations-Pipeline: Client → DN1 → DN2 → DN3, 64 KB Packets, ACK-Kaskade.",
          "Block-Gesundheitszustände:",
          [
            "Under-replicated: weniger als 3 Kopien → Re-Replikation",
            "Over-replicated: mehr Kopien → überschüssige Kopien löschen",
            "Corrupt: alle Kopien fehlerhaft → Datenverlust",
            "Missing: Block bekannt, aber kein DataNode meldet ihn → kritisch"
          ]
        ],
        "connections": ["hdfs-namenode-role", "hdfs-datanode-role", "hdfs-ha"]
      },

      /* -----------------------------------------------------------
       * NAMENODE
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-namenode-role",
        "label": "NameNode: Namespace & Metadata",
        "group": "hdfs",
        "description": "Der NameNode verwaltet den gesamten Namespace im RAM. Small-Files erhöhen die Metadatenlast massiv.",
        "details": [
          "Produktiver Heap für Small-Files: -Xms32g -Xmx32g (bis 200 Mio. Objekte).",
          "G1GC empfohlen: -XX:+UseG1GC, -XX:G1HeapRegionSize=32m.",
          "Handler für hohe Create-Last:",
          [
            "dfs.namenode.handler.count = 200",
            "dfs.namenode.service.handler.count = 50"
          ],
          "EditLog-Optimierung:",
          [
            "dfs.namenode.edits.asynclogging = true",
            "dfs.namenode.checkpoint.txns = 250000",
            "dfs.namenode.checkpoint.period = 900"
          ],
          "Small-Files erzeugen viele Inodes → häufigere Checkpoints reduzieren Restart-Zeit."
        ],
        "connections": ["hdfs-block", "hdfs-fsimage", "hdfs-editlog", "hdfs-ha"]
      },

      /* -----------------------------------------------------------
       * DATANODE
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-datanode-role",
        "label": "DataNode: Block-Storage",
        "group": "hdfs",
        "description": "DataNodes speichern Blöcke und müssen bei Small-Files viele kleine Transfers verarbeiten.",
        "details": [
          "dfs.datanode.max.transfer.threads = 8192 (viele parallele kleine Blocktransfers).",
          "dfs.datanode.directoryscan.interval = 3600 (häufigere Volume-Scans für kleine Dateien).",
          "Heartbeat: 3 s, Stale-Timeout: 30 s.",
          "CRC-Prüfung für gespeicherte Blöcke."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role"]
      },

      /* -----------------------------------------------------------
       * EDIT LOG
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-editlog",
        "label": "Edit Log",
        "group": "hdfs",
        "description": "Write-Ahead-Log für alle Namespace-Änderungen.",
        "details": [
          "Transaktionen: create, delete, rename, addBlock, completeFile usw.",
          "HA: Edit Log wird über QJM an 3 JournalNodes geschrieben.",
          "Commit erfolgreich bei 2 von 3 JournalNodes.",
          "Asynclogging entkoppelt RPC-Thread vom Logging-Thread."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-fsimage", "hdfs-ha"]
      },

      /* -----------------------------------------------------------
       * FSIMAGE
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-fsimage",
        "label": "FSImage & Checkpoint",
        "group": "hdfs",
        "description": "FSImage speichert den Namespace. Small-Files erzeugen viele EditLog-Einträge.",
        "details": [
          "Checkpoint-Trigger für Small-Files:",
          [
            "dfs.namenode.checkpoint.txns = 250000",
            "dfs.namenode.checkpoint.period = 900"
          ],
          "Häufigere Checkpoints reduzieren Restart-Zeit bei Millionen kleiner Dateien."
        ],
        "connections": ["hdfs-editlog", "hdfs-namenode-role", "hdfs-ha"]
      },

      /* -----------------------------------------------------------
       * HIGH AVAILABILITY
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-ha",
        "label": "High Availability",
        "group": "hdfs",
        "description": "HDFS HA eliminiert den NameNode als Single Point of Failure.",
        "details": [
          "Komponenten: 2 NameNodes, 3 JournalNodes, 3 ZooKeeper-Knoten, 2 ZKFCs.",
          "Produktives Fencing:",
          [
            "dfs.ha.fencing.methods = sshfence",
            "dfs.ha.fencing.ssh.private-key-files=/etc/hadoop/conf/ha_key",
            "dfs.ha.fencing.ssh.connect-timeout=30000"
          ],
          "Lab-Setup (nicht produktiv!): shell(/bin/true).",
          "Failover-Ablauf: ZKFC erkennt Fehler → ZK Lock → Fencing → Promotion."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-editlog", "hdfs-fsimage"]
      },

      /* -----------------------------------------------------------
       * REPLICATION PIPELINE
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-replication-pipeline",
        "label": "Schreib-Pipeline & Read-Path",
        "group": "hdfs",
        "description": "Trennung von Control-Path (NameNode) und Data-Path (DataNodes).",
        "details": [
          "Write Path: create() → addBlock → Pipeline → ACK-Kaskade.",
          "Read Path: Client liest direkt vom nächsten DataNode.",
          "Failover: Client nutzt ConfiguredFailoverProxyProvider."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role", "hdfs-datanode-role"]
      },

      /* -----------------------------------------------------------
       * SMALL FILES
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-small-files",
        "label": "Small-Files-Optimierung",
        "group": "hdfs",
        "description": "Viele kleine Dateien belasten den NameNode durch hohe Metadatenlast. Optimierungen reduzieren RAM-Verbrauch, RPC-Last und EditLog-Druck.",
        "details": [
          "NameNode-RAM-Verbrauch: ~150 Bytes pro Inode + ~200 Bytes pro Block. Millionen kleiner Dateien erzeugen extrem viele Metadatenobjekte.",
          "Produktive Blockgröße für Small-Files: dfs.blocksize = 33554432 (32 MB). Reduziert Blockanzahl, aber vermeidet 128-MB-Verschwendung.",
          "Replikation bleibt auf 3, da kleine Dateien anfälliger für Blockverlust sind.",
          "I/O-Puffer erhöhen: io.file.buffer.size = 262144 (256 KB) → weniger RPC-Overhead bei vielen kleinen Writes.",
          "Short-Circuit Reads aktivieren: dfs.client.read.shortcircuit = true → reduziert Latenz für kleine Dateien.",
          "RPC-Server skalieren:",
          [
            "dfs.namenode.handler.count = 200 (mehr parallele Create-Operationen)",
            "dfs.namenode.service.handler.count = 50"
          ],
          "EditLog- und Checkpoint-Optimierung:",
          [
            "dfs.namenode.edits.asynclogging = true (entkoppelt Create-Last vom Logging)",
            "dfs.namenode.checkpoint.txns = 250000 (häufigere Checkpoints)",
            "dfs.namenode.checkpoint.period = 900 (15 Minuten)"
          ],
          "DataNode-Optimierungen:",
          [
            "dfs.datanode.max.transfer.threads = 8192 (viele kleine Blocktransfers)",
            "dfs.datanode.directoryscan.interval = 3600 (häufigere Volume-Scans)"
          ],
          "Trash deaktiviert, um Metadatenlast zu reduzieren: fs.trash.interval = 0.",
          "Quota Management zwingend notwendig, um unkontrolliertes Wachstum zu verhindern.",
          "Langfristige Alternativen: HAR, SequenceFiles, Apache Ozone."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role", "namenode"]
      },

      /* -----------------------------------------------------------
       * HDFS BALANCER
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-balancer",
        "label": "HDFS Balancer",
        "group": "hdfs",
        "description": "Verteilt Blöcke zwischen DataNodes. Small-Files erzeugen ungleichmäßige Verteilung.",
        "details": [
          "Produktive Bandbreite für 40 Gbit/s Cluster: dfs.datanode.balance.bandwidthPerSec = 1073741824 (1 GB/s).",
          "Small-Files erzeugen viele kleine Blöcke → Balancer häufiger ausführen."
        ],
        "connections": ["hdfs-block", "hdfs-datanode-role", "datanode", "namenode"]
      },

      /* -----------------------------------------------------------
       * DISK BALANCER (NEU)
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-diskbalancer",
        "label": "HDFS Disk Balancer",
        "group": "hdfs",
        "description": "Optimiert Blockverteilung innerhalb eines DataNodes.",
        "details": [
          "Analysiert Volume-Auslastung und erstellt Migrationspläne.",
          "CLI: hdfs diskbalancer -plan / -execute / -query.",
          "Sinnvoll bei NVMe-Setups oder Volume-Erweiterungen.",
          "Arbeitet unabhängig vom normalen HDFS Balancer."
        ],
        "connections": ["datanode", "hdfs-balancer"]
      },

      /* -----------------------------------------------------------
       * SNAPSHOTS
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-snapshots",
        "label": "HDFS Snapshots",
        "group": "hdfs",
        "description": "Schreibgeschützte Point-in-Time-Kopien.",
        "details": [
          "Snapshots speichern nur Deltas.",
          "Zugriff über .snapshot/ Verzeichnis.",
          "Typische Nutzung: Backup, Rollback, distcp -diff.",
          "Snapshot-Quota: hdfs dfsadmin -setSnapshotQuota."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-block", "hdfs-replication-pipeline"]
      },

      /* -----------------------------------------------------------
       * ERASURE CODING (NEU)
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-erasurecoding",
        "label": "Erasure Coding",
        "group": "hdfs",
        "description": "Speicheroptimierte Alternative zur Replikation.",
        "details": [
          "Typische Policy: RS-6-3-1024k.",
          "Reduziert Speicherbedarf um 50–70%.",
          "Nicht geeignet für kleine Dateien.",
          "Erfordert CPU für Encoding/Decoding."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role"]
      },

      /* -----------------------------------------------------------
       * FEDERATION (NEU)
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-federation",
        "label": "HDFS Federation",
        "group": "hdfs",
        "description": "Mehrere unabhängige NameNodes teilen sich den Cluster.",
        "details": [
          "Jeder NameNode verwaltet eigenen Namespace.",
          "DataNodes melden sich bei allen NameNodes an.",
          "Skalierung für sehr große Cluster."
        ],
        "connections": ["hdfs-namenode-role"]
      },

      /* -----------------------------------------------------------
       * ROUTER-BASED FEDERATION (NEU)
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-rbf",
        "label": "Router-Based Federation",
        "group": "hdfs",
        "description": "Globaler Namespace über mehrere NameNodes.",
        "details": [
          "Router leitet Anfragen an passende NameNodes.",
          "Unterstützt Mount Tables und Caching.",
          "HA-fähig."
        ],
        "connections": ["hdfs-federation", "hdfs-namenode-role"]
      },

      /* -----------------------------------------------------------
       * ZOOKEEPER
       * ----------------------------------------------------------- */
      {
        "id": "zookeeper",
        "label": "ZooKeeper",
        "group": "hadoop",
        "description": "3-Knoten-Quorum für HA-Failover.",
        "details": [
          "Speichert Ephemeral Nodes für aktiven NameNode.",
          "Session-Timeout kritisch für GC-Pausen.",
          "Produktiv: dedizierte Hosts, SSDs."
        ],
        "connections": ["zkfc", "journalnode", "namenode", "resourcemanager"]
      },

      /* -----------------------------------------------------------
       * JOURNALNODE
       * ----------------------------------------------------------- */
      {
        "id": "journalnode",
        "label": "JournalNode",
        "group": "hadoop",
        "description": "Speichert Edit-Log-Segmente für HA.",
        "details": [
          "Quorum: 2 von 3 müssen committen.",
          "RPC-Port: 8485.",
          "Heap: 512 MB."
        ],
        "connections": ["namenode", "zookeeper"]
      },

      /* -----------------------------------------------------------
       * NAMENODE (CLUSTER)
       * ----------------------------------------------------------- */
      {
        "id": "namenode",
        "label": "NameNode",
        "group": "hadoop",
        "description": "Zentraler Metadatenserver. Small-Files erzeugen hohe Metadatenlast.",
        "details": [
          "Produktiver Heap: 32 GB.",
          "Trash deaktiviert:",
          [
            "fs.trash.interval = 0",
            "fs.trash.checkpoint.interval = 0"
          ],
          "I/O-Puffer für kleine Dateien:",
          "io.file.buffer.size = 262144 (256 KB).",
          "Quota Management:",
          [
            "Directory Quota: hdfs dfsadmin -setQuota",
            "Space Quota: hdfs dfsadmin -setSpaceQuota",
            "Snapshot Quota: hdfs dfsadmin -setSnapshotQuota"
          ]
        ],
        "connections": ["zkfc", "journalnode", "datanode", "zookeeper"]
      },

      /* -----------------------------------------------------------
       * ZKFC
       * ----------------------------------------------------------- */
      {
        "id": "zkfc",
        "label": "ZKFC",
        "group": "hadoop",
        "description": "Überwacht NameNode und steuert Failover.",
        "details": [
          "Health-Checks via RPC.",
          "Hält ZooKeeper-Lock.",
          "Produktives Fencing: sshfence."
        ],
        "connections": ["namenode", "zookeeper"]
      },

      /* -----------------------------------------------------------
       * DATANODE (CLUSTER)
       * ----------------------------------------------------------- */
      {
        "id": "datanode",
        "label": "DataNode",
        "group": "hadoop",
        "description": "3 DataNodes speichern HDFS-Blöcke.",
        "details": [
          "Transfer-Port: 9866.",
          "Volume-Ausfälle kritisch.",
          "Disk Balancer empfohlen."
        ],
        "connections": ["namenode"]
      },

      /* -----------------------------------------------------------
       * RESOURCEMANAGER
       * ----------------------------------------------------------- */
      {
        "id": "resourcemanager",
        "label": "ResourceManager",
        "group": "hadoop",
        "description": "Verwaltet YARN-Ressourcen.",
        "details": [
          "Web-UI: 8088.",
          "AM-Ressourcen: 512 MB.",
          "Log-Aggregation aktiv."
        ],
        "connections": ["nodemanager", "zookeeper"]
      },

      /* -----------------------------------------------------------
       * NODEMANAGER
       * ----------------------------------------------------------- */
      {
        "id": "nodemanager",
        "label": "NodeManager",
        "group": "hadoop",
        "description": "Führt YARN-Container aus.",
        "details": [
          "Ressourcen: 2 vCores, 2 GB RAM.",
          "Heartbeat an RM.",
          "Verlust eines NodeManagers → Container verloren."
        ],
        "connections": ["resourcemanager", "datanode"]
      },

      /* -----------------------------------------------------------
       * DISTCP
       * ----------------------------------------------------------- */
      {
        "id": "distcp",
        "label": "DistCp",
        "group": "hadoop",
        "description": "MapReduce-basiertes Kopiertool.",
        "details": [
          "Parallelisiert Kopiervorgänge über Mapper.",
          "Unterstützt -update, -delete, -diff.",
          "Inkrementelles distcp über Snapshots."
        ],
        "connections": ["resourcemanager", "nodemanager", "hdfs-replication-pipeline", "hdfs-snapshots"]
      }
    ],

    "crossConnections": [
      { "from": "hdfs-namenode-role", "to": "namenode" },
      { "from": "hdfs-datanode-role", "to": "datanode" },

      { "from": "hdfs-ha", "to": "zookeeper" },
      { "from": "hdfs-ha", "to": "journalnode" },
      { "from": "hdfs-ha", "to": "zkfc" },

      { "from": "hdfs-editlog", "to": "journalnode" },

      /* Neue / korrigierte Verbindungen */
      { "from": "hdfs-erasurecoding", "to": "hdfs-block" },
      { "from": "hdfs-erasurecoding", "to": "hdfs-namenode-role" },
      { "from": "hdfs-erasurecoding", "to": "hdfs-datanode-role" },

      { "from": "hdfs-federation", "to": "namenode" },
      { "from": "hdfs-federation", "to": "datanode" },

      { "from": "hdfs-rbf", "to": "namenode" },
      { "from": "hdfs-rbf", "to": "hdfs-namenode-role" },

      { "from": "hdfs-diskbalancer", "to": "datanode" },
      { "from": "hdfs-diskbalancer", "to": "hdfs-balancer" },

      { "from": "hdfs-balancer", "to": "namenode" },

      { "from": "hdfs-small-files", "to": "namenode" },

      { "from": "hdfs-snapshots", "to": "namenode" },

      { "from": "distcp", "to": "namenode" }
    ]
  };

  // Build topic → group lookup
  const topicGroup = {};
  for (const t of raw.topics) topicGroup[t.id] = t.group;

  // Build constellations
  const constellations = raw.groups.map((g, i) => {
    const groupTopics = raw.topics.filter(t => t.group === g.id);

    const stars = groupTopics.map(t => ({
      id: t.id,
      label: t.label,
      x: 0, y: 0,
      mag: t.connections.length >= 5 ? 1 : t.connections.length >= 3 ? 2 : 3,
      desc: t.description + (t.details.length ? "\n\n" + formatDetails(t.details) : ""),
    }));

    // Intra-group lines (deduplicated)
    const lineSet = new Set();
    const lines = [];
    for (const t of groupTopics) {
      for (const conn of t.connections) {
        if (topicGroup[conn] === g.id) {
          const key = [t.id, conn].sort().join("|");
          if (!lineSet.has(key)) {
            lineSet.add(key);
            lines.push([t.id, conn]);
          }
        }
      }
    }

    return {
      id: g.id,
      name: g.label.toUpperCase(),
      catalog: "C-0" + (i + 1),
      hue: GROUP_HUES[g.id] ?? 200,
      cx: 400, cy: 400,
      stars,
      lines,
      opts: GROUP_OPTS[g.id] ?? {},
    };
  });

  // Cross edges from explicit crossConnections
  const seen = new Set();
  const crossEdges = [];
  for (const cc of raw.crossConnections) {
    const key = cc.from + "|" + cc.to;
    if (!seen.has(key)) {
      seen.add(key);
      crossEdges.push({ from: cc.from, to: cc.to, label: "" });
    }
  }
  // Add implicit cross-group edges from topic connections not already listed
  for (const t of raw.topics) {
    for (const conn of t.connections) {
      if (topicGroup[conn] && topicGroup[conn] !== t.group) {
        const key = t.id + "|" + conn;
        const keyRev = conn + "|" + t.id;
        if (!seen.has(key) && !seen.has(keyRev)) {
          seen.add(key);
          crossEdges.push({ from: t.id, to: conn, label: "" });
        }
      }
    }
  }

  window.CONSTELLATIONS = constellations;
  window.CROSS_EDGES = crossEdges;
})();
