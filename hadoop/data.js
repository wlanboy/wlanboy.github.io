(function () {
  const GROUP_HUES = {
    "hdfs": 195,
    "hadoop": 38,
  };

  // Per-group force-simulation tuning.
  // hdfs: dense core of 5 highly connected nodes → shorter springs + more repulsion so labels breathe.
  const GROUP_OPTS = {
    "hdfs": { repel: 22000, springL: 180, spring: 0.006, gravity: 0.0008, iters: 520 },
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
        "description": "HDFS speichert Dateien als Sequenz gleichgroßer Blöcke. Kleine Dateien erzeugen viele Metadatenobjekte im NameNode.",
        "details": [
          "Produktive Blockgröße für gemischte Workloads: dfs.blocksize = 33554432 (32 MB).",
          "Begründung: 32 MB reduziert den Metadaten-Overhead pro Block gegenüber 128 MB, ohne die Fragmentierung großer Dateien zu stark zu erhöhen.",
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
        "description": "Trennung von Control-Path (NameNode) und Data-Path (DataNodes). Rack-Awareness steuert die Platzierung der Replikate.",
        "details": [
          "Write Path: create() → addBlock → Pipeline → ACK-Kaskade.",
          "Rack-Awareness: DN1 (lokales Rack) → DN2 (anderes Rack) → DN3 (anderes Rack). Schützt vor Rack-Ausfall.",
          "Pipeline-Fehlerbehandlung: Fehlerhafte DN wird aus Pipeline entfernt, Block-ID neu vergeben, fehlende Replikate nachgezogen.",
          "Read Path: Client liest direkt vom nächsten DataNode (nach Rack-Distanz gewählt).",
          "Short-Circuit Read: dfs.client.read.shortcircuit = true → Client liest direkt von lokalem Disk, umgeht DataNode-RPC.",
          "Voraussetzung Short-Circuit: dfs.domain.socket.path muss gesetzt sein.",
          "Failover: Client nutzt ConfiguredFailoverProxyProvider für transparentes HA-Failover."
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
          "Produktive Blockgröße für Small-Files: dfs.blocksize = 33554432 (32 MB). Reduziert Metadaten-Overhead pro Block und vermeidet unnötig große Block-Einträge im NameNode.",
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
        "description": "Verteilt Blöcke zwischen DataNodes, um Speicherauslastung anzugleichen. Small-Files und neue DataNodes erzeugen typische Ungleichgewichte.",
        "details": [
          "Aufruf: hdfs balancer -threshold 10 -blockpools <pool>.",
          "Threshold: maximale prozentuale Abweichung vom Cluster-Durchschnitt (Standard: 10 %).",
          "Produktive Bandbreite für 40 GbE-Cluster: dfs.datanode.balance.bandwidthPerSec = 1073741824 (1 GiB/s).",
          "Parallele Moves pro DataNode: dfs.datanode.balance.max.concurrent.moves = 50.",
          "Small-Files erzeugen viele kleine Blöcke → Balancer häufiger ausführen oder per Cron planen.",
          "Zusammenspiel mit Storage Policies: hdfs mover -p <Pfad> verschiebt Blöcke auf das richtige Speichermedium.",
          "Balancer stoppt automatisch, wenn Threshold erreicht ist."
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
        "description": "Schreibgeschützte Point-in-Time-Kopien eines Verzeichnisses. Kostengünstig durch Delta-Speicherung im NameNode.",
        "details": [
          "Snapshot aktivieren: hdfs dfsadmin -allowSnapshot <Pfad>.",
          "Snapshot erstellen: hdfs dfs -createSnapshot <Pfad> <Name>.",
          "Snapshots speichern nur Deltas — keine vollständige Datenkopie.",
          "Zugriff über .snapshot/<Name>/ Unterverzeichnis.",
          "Maximum: 65536 Snapshots pro snapshotfähigem Verzeichnis.",
          "Typische Nutzung: Backup, Rollback, distcp -diff für inkrementelle Replikation.",
          "Snapshot-Quota (max. Anzahl): hdfs dfsadmin -setSnapshotQuota <Pfad> <Anzahl>.",
          "Snapshot deaktivieren (alle Snapshots müssen vorher gelöscht sein): hdfs dfsadmin -disallowSnapshot <Pfad>."
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
       * STORAGE POLICIES
       * ----------------------------------------------------------- */
      {
        "id": "hdfs-storagepolicies",
        "label": "Storage Policies",
        "group": "hdfs",
        "description": "Steuert, welche Speichermedien (DISK, SSD, ARCHIVE, RAM_DISK) für Blöcke genutzt werden. Ermöglicht Tiered Storage für heiße und kalte Daten.",
        "details": [
          "Vordefinierte Policies:",
          [
            "HOT: alle Replikate auf DISK (Standard)",
            "WARM: 1 Replikat auf DISK, Rest auf ARCHIVE",
            "COLD: alle Replikate auf ARCHIVE",
            "ONE_SSD: 1 Replikat auf SSD, Rest auf DISK",
            "ALL_SSD: alle Replikate auf SSD",
            "LAZY_PERSIST: 1 Replikat auf RAM_DISK, Rest auf DISK"
          ],
          "Policy setzen: hdfs storagepolicies -setStoragePolicy -path <Pfad> -policy HOT.",
          "Policy abfragen: hdfs storagepolicies -getStoragePolicy -path <Pfad>.",
          "Alle Policies anzeigen: hdfs storagepolicies -listPolicies.",
          "Mover-Tool: hdfs mover -p <Pfad> verschiebt Blöcke gemäß aktueller Policy.",
          "Kombination mit Erasure Coding: COLD-Daten mit RS-6-3 spart 50–70 % Speicher."
        ],
        "connections": ["hdfs-erasurecoding", "hdfs-block", "hdfs-datanode-role"]
      },

      /* -----------------------------------------------------------
       * ZOOKEEPER
       * ----------------------------------------------------------- */
      {
        "id": "zookeeper",
        "label": "ZooKeeper",
        "group": "hadoop",
        "description": "Verteilter Koordinationsdienst für Leader-Election, Distributed Locks und Konfigurationsverwaltung. Bildet das Rückgrat des HA-Failovers für NameNode und ResourceManager.",
        "details": [
          "Ensemble: Mindestens 3 Knoten erforderlich (Quorum = Mehrheit). 5 Knoten für höhere Fehlertoleranz.",
          "Ports: Client-Port 2181, Peer-Port 2888, Leader-Election-Port 3888.",
          "Ephemeral Nodes: ZKFC schreibt Ephemeral ZNode /hadoop-ha/<ns>/ActiveStandbyElectorLock → nur aktiver NameNode hält diesen Lock.",
          "Session-Timeout: tickTime = 2000 ms, minSessionTimeout = 2×tickTime = 4 s, maxSessionTimeout = 20×tickTime = 40 s.",
          "GC-Risiko: Lange GC-Pausen des NameNode können Session-Timeout auslösen → unbeabsichtigter Failover. G1GC mit -XX:MaxGCPauseMillis=200 empfohlen.",
          "Watches: ZKFC registriert Watches auf den ActiveStandbyElectorLock-ZNode → sofortige Benachrichtigung bei Lock-Verlust.",
          "Datenpersistenz: dataDir auf SSDs legen → reduziert Fsync-Latenz.",
          "Produktivkonfiguration:",
          [
            "tickTime = 2000",
            "initLimit = 10",
            "syncLimit = 5",
            "maxClientCnxns = 60",
            "autopurge.snapRetainCount = 3",
            "autopurge.purgeInterval = 1"
          ],
          "Monitoring: ZooKeeper-Metriken via JMX oder 4-Letter-Words (mntr, stat, ruok).",
          "Produktiv: dedizierte Hosts, SSDs, kein Swap (vm.swappiness = 0)."
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
        "description": "Implementiert den Quorum Journal Manager (QJM). Der aktive NameNode schreibt jede Edit-Log-Transaktion an alle JournalNodes; der Standby liest daraus kontinuierlich, um seinen Namespace aktuell zu halten.",
        "details": [
          "Quorum-Regel: Schreib-Commit erfolgreich, wenn mindestens 2 von 3 JournalNodes bestätigen (Mehrheitsquorum).",
          "Konsistenz: Jede Transaktion trägt eine eindeutige Epoch-Nummer. Ein neuer Active NameNode erhöht die Epoch → veraltete Schreibversuche des alten Active werden abgelehnt.",
          "RPC-Port: 8485 (Schreiben/Lesen des Edit Logs).",
          "HTTP-Port: 8480 (Web-UI, Statusüberwachung).",
          "Datenpfad: dfs.journalnode.edits.dir → dediziertes Verzeichnis, idealerweise auf SSD.",
          "Heap: 512 MB bis 1 GB je nach Transaktionsvolumen.",
          "Startup-Sync: Standby NameNode lädt fehlende Segmente beim Start nach (In-Progress-Segmente).",
          "Split-Brain-Schutz: Epoch-Mechanismus verhindert, dass zwei NameNodes gleichzeitig schreiben.",
          "Produktivkonfiguration:",
          [
            "dfs.journalnode.edits.dir = /data/jn/edits (SSD-Pfad)",
            "dfs.journalnode.rpc-address = 0.0.0.0:8485",
            "dfs.journalnode.http-address = 0.0.0.0:8480"
          ],
          "Monitoring: Segmentlücken und In-Progress-Dateien im Datenpfad beobachten.",
          "Mindestanzahl: 3 JournalNodes; 5 für höhere Fehlertoleranz bei größeren Clustern."
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
        "description": "Zentraler HDFS-Metadatenserver. Verwaltet Namespace, Block-Mapping und Zugriffsrechte vollständig im RAM. Im HA-Betrieb läuft ein Active/Standby-Paar, koordiniert durch ZKFC und JournalNodes.",
        "details": [
          "HA-Rollen: Active NameNode bedient alle Client-RPCs; Standby synchronisiert sich kontinuierlich über JournalNodes.",
          "Ports: RPC 8020 (Clients, DataNodes), HTTP 9870 (Web-UI), HTTPS 9871.",
          "Produktiver Heap: 32 GB (-Xms32g -Xmx32g) für bis zu 200 Mio. Inodes.",
          "GC-Konfiguration: G1GC empfohlen:",
          [
            "-XX:+UseG1GC",
            "-XX:G1HeapRegionSize=32m",
            "-XX:MaxGCPauseMillis=200"
          ],
          "Handler-Threads: dfs.namenode.handler.count = 200, dfs.namenode.service.handler.count = 50.",
          "EditLog-Sync: asynclogging = true → RPC-Thread nicht durch Fsync blockiert.",
          "Checkpoint-Trigger:",
          [
            "dfs.namenode.checkpoint.txns = 250000",
            "dfs.namenode.checkpoint.period = 900 s (15 min)"
          ],
          "Trash: in Produktion deaktiviert (fs.trash.interval = 0) um Metadatenlast zu reduzieren.",
          "I/O-Puffer: io.file.buffer.size = 262144 (256 KB) für kleine Dateien.",
          "Quota Management:",
          [
            "Directory Quota: hdfs dfsadmin -setQuota <N> <Pfad>",
            "Space Quota: hdfs dfsadmin -setSpaceQuota <Bytes> <Pfad>",
            "Snapshot Quota: hdfs dfsadmin -setSnapshotQuota <N> <Pfad>"
          ],
          "Safe Mode: beim Start bis 99,9 % der Blöcke gemeldet → dann automatisch verlassen.",
          "Monitoring: fsck, dfsadmin -report, JMX-Metriken (MissingBlocks, UnderReplicatedBlocks)."
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
        "description": "ZooKeeper Failover Controller — läuft als Daemon neben jedem NameNode. Überwacht dessen Gesundheit via lokaler RPC-Verbindung und koordiniert automatischen Failover über ZooKeeper-Leader-Election.",
        "details": [
          "Health-Check: Periodische RPC-Anfragen an den lokalen NameNode (haadmin -getServiceState).",
          "Election: ZKFC des aktiven NameNode hält Ephemeral ZNode /hadoop-ha/<ns>/ActiveStandbyElectorLock.",
          "Failover-Ablauf:",
          [
            "1. ZKFC erkennt NameNode-Ausfall (RPC-Timeout oder Exception)",
            "2. Ephemeral ZNode verfällt → ZooKeeper benachrichtigt Standby-ZKFC",
            "3. Standby-ZKFC fenced den alten Active (sshfence oder shell)",
            "4. Standby-ZKFC promote Standby NameNode zum neuen Active"
          ],
          "Fencing-Methoden:",
          [
            "Produktiv: sshfence — SSH-Login auf alten Active, kill -9 auf NameNode-Prozess",
            "Lab (nicht produktiv): shell(/bin/true) — kein echtes Fencing"
          ],
          "Fencing-Konfiguration:",
          [
            "dfs.ha.fencing.methods = sshfence",
            "dfs.ha.fencing.ssh.private-key-files = /etc/hadoop/conf/ha_key",
            "dfs.ha.fencing.ssh.connect-timeout = 30000"
          ],
          "Split-Brain-Schutz: Fencing verhindert, dass beide NameNodes gleichzeitig als Active schreiben.",
          "Automatischer vs. manueller Failover: dfs.ha.automatic-failover.enabled = true für automatischen Betrieb.",
          "Manueller Failover: hdfs haadmin -failover nn1 nn2."
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
        "description": "Speichert HDFS-Blöcke auf lokalen Disks und verwaltet Block-Replikations-Pipelines. Im Produktionsbetrieb mit mehreren Volumes pro Node und konfigurierbarer Fehlertoleranz für Disk-Ausfälle.",
        "details": [
          "Ports: Transfer-Port 9866 (Block-Reads/-Writes), RPC 9867, HTTP 9864 (Web-UI).",
          "Heartbeat: alle 3 s an NameNode; Stale nach 30 s; Dead nach 10 min → NameNode leitet Re-Replikation ein.",
          "Block-Reports: Vollständiger Report beim Start; inkrementelle Reports alle 6 h (dfs.blockreport.intervalMsec = 21600000).",
          "Volume-Fehlertoleranz: dfs.datanode.failed.volumes.tolerated = 1 → DataNode bleibt aktiv bei 1 ausgefallener Disk.",
          "Mehrere Volumes empfohlen für Parallelität:",
          [
            "dfs.datanode.data.dir = /data1,/data2,/data3",
            "Volumes können auf verschiedene Disks gemappt werden"
          ],
          "Parallele Transfers: dfs.datanode.max.transfer.threads = 8192 für viele gleichzeitige Block-Operationen.",
          "CRC-Prüfung: Jeder Block wird beim Schreiben mit CRC32c gesichert; bei Lesen geprüft.",
          "Block-Scanning: dfs.datanode.scan.period.hours = 504 (3 Wochen) → regelmäßige Bit-Rot-Erkennung.",
          "Short-Circuit Reads: dfs.client.read.shortcircuit = true → Clients auf demselben Host lesen direkt von Disk.",
          "Storage Policies: DataNode kann mehrere Storage-Typen bereitstellen (DISK, SSD, ARCHIVE).",
          [
            "dfs.datanode.data.dir = [SSD]/ssd/data,[DISK]/hdd/data,[ARCHIVE]/archive/data"
          ],
          "Disk Balancer: hdfs diskbalancer -plan / -execute bei ungleichmäßiger Volume-Auslastung.",
          "Out-of-Service: hdfs dfsadmin -shutdownDatanode <host:port> für wartungsfreundliches Decommissioning."
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
        "description": "Zentraler YARN-Scheduler. Verwaltet Cluster-Ressourcen (vCores, RAM), plant Container-Zuteilung und koordiniert ApplicationMaster-Starts. Im Active/Standby-HA-Betrieb mit ZooKeeper als State Store.",
        "details": [
          "Ports: Web-UI 8088, RPC 8032, Admin 8033, Scheduler 8030.",
          "HA-Konfiguration:",
          [
            "yarn.resourcemanager.ha.enabled = true",
            "yarn.resourcemanager.ha.rm-ids = rm1,rm2",
            "yarn.resourcemanager.recovery.enabled = true",
            "yarn.resourcemanager.store.class = org.apache.hadoop.yarn.server.resourcemanager.recovery.ZKRMStateStore"
          ],
          "Failover: automatisch via ZooKeeper-Leader-Election, kein manueller Eingriff nötig.",
          "Scheduler-Typen:",
          [
            "CapacityScheduler (Standard): Queue-basiert, Hierarchie, Kapazitätsgarantien pro Queue",
            "FairScheduler: Faire Ressourcenteilung über Pools; reaktiver bei wechselnder Last"
          ],
          "CapacityScheduler-Tuning:",
          [
            "yarn.scheduler.capacity.maximum-am-resource-percent = 0.1 (max. 10 % für AMs)",
            "yarn.scheduler.capacity.node-locality-delay = 40 (Scheduler-Versuche vor Remote-Zuteilung)"
          ],
          "ApplicationMaster-Ressourcen: yarn.app.mapreduce.am.resource.mb = 1536 MB (Standard).",
          "Container-Overhead: mapreduce.map.memory.mb = 2048, mapreduce.reduce.memory.mb = 4096.",
          "Log-Aggregation: yarn.log-aggregation-enable = true → Logs nach Container-Ende auf HDFS (yarn.nodemanager.remote-app-log-dir).",
          "Preemption: yarn.resourcemanager.scheduler.monitor.enable = true für präemptive Ressourcenrückforderung.",
          "Node-Labels: Ermöglicht dedizierte Queues für spezielle Hardware (GPUs, High-Memory-Nodes).",
          "Monitoring: yarn application -list, yarn queue -status, YARN-Timeline-Service."
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
        "description": "YARN-Agent auf jedem Worker-Node. Startet und überwacht Container im Auftrag des ResourceManagers, isoliert Ressourcen per cgroups und aggregiert Container-Logs nach HDFS.",
        "details": [
          "Ports: HTTP 8042 (Web-UI), RPC 8041, Localizer 8040.",
          "Ressourcen pro Node (Beispiel Produktionscluster):",
          [
            "yarn.nodemanager.resource.memory-mb = 49152 (48 GB)",
            "yarn.nodemanager.resource.cpu-vcores = 16"
          ],
          "Heartbeat: Alle 1 s an ResourceManager; meldet freie Ressourcen und Container-Status.",
          "Container-Lebenszyklus: Allocated → Running → Completed/Failed → Cleanup.",
          "Ressourcenisolation:",
          [
            "cgroups: yarn.nodemanager.container-executor.class = LinuxContainerExecutor",
            "yarn.nodemanager.linux-container-executor.cgroups.hierarchy = /hadoop-yarn",
            "Verhindert CPU/Speicher-Überbelegung durch einzelne Container"
          ],
          "Log-Aggregation: Container-Logs lokal in yarn.nodemanager.log-dirs, nach Container-Ende auf HDFS aggregiert.",
          "Local Dirs: yarn.nodemanager.local-dirs = /tmp/nm-local-dir → Shuffle-Daten, Jar-Dateien.",
          "Verlust eines NodeManagers → alle laufenden Container auf dem Node verloren → AM leitet Re-Scheduling ein.",
          "Health Checks: yarn.nodemanager.health-checker.script.path → Node markiert UNHEALTHY bei Fehler.",
          "Decommissioning: yarn rmadmin -refreshNodes → NodeManager gracefully decommission.",
          "Node-Labels: Ein NodeManager kann Labels anmelden (z. B. GPU, HIGH_MEM) für spezialisierte Queues."
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
        "description": "Distributed Copy — MapReduce-basiertes Tool für parallele Massenkopien zwischen HDFS-Clustern oder -Pfaden. Standard-Werkzeug für Cluster-Migrationen, DR-Replikation und inkrementelle Datensynchronisation.",
        "details": [
          "Funktionsweise: Generiert eine Liste der zu kopierenden Dateien, verteilt sie auf Mapper → parallele Kopien.",
          "Grundlegende Nutzung: hadoop distcp hdfs://src/pfad hdfs://dst/pfad.",
          "Wichtige Optionen:",
          [
            "-update: Kopiert nur neue oder geänderte Dateien (Größe/Prüfsumme-Vergleich)",
            "-delete: Löscht Zieldateien, die in der Quelle nicht mehr vorhanden sind",
            "-diff <snap1> <snap2>: Inkrementelles Kopieren auf Basis von HDFS-Snapshot-Differenzen",
            "-overwrite: Überschreibt vorhandene Zieldateien ohne Prüfung",
            "-skipcrccheck: Überspringt CRC-Vergleich (schneller, aber weniger sicher)",
            "-bandwidth <MB/s>: Begrenzt Bandbreite pro Mapper"
          ],
          "Inkrementelle Replikation via Snapshots:",
          [
            "hdfs dfs -createSnapshot /src snap1",
            "hadoop distcp -diff snap1 snap2 -update hdfs://src/path hdfs://dst/path",
            "Überträgt nur Deltas → deutlich weniger Datenvolumen als Vollkopie"
          ],
          "Parallelisierung: -m <N> steuert Anzahl der Mapper (Standard: 20).",
          "Cross-Cluster: Quell- und Ziel-NameNode müssen sich gegenseitig erreichen können (WebHDFS oder HDFS-RPC).",
          "Atomic-Commit: -atomic kopiert in temporäres Verzeichnis, dann Rename → atomare Sicht für Konsumenten.",
          "Strategie bei Migration: distcp -update für initiale Bulk-Kopie, dann inkrementelle distcp -diff Läufe bis zum Cut-over.",
          "Monitoring: YARN-Job-UI (Port 8088) zeigt Mapper-Fortschritt und Fehler."
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

      { "from": "hdfs-rbf", "to": "namenode" },
      { "from": "hdfs-rbf", "to": "hdfs-namenode-role" },

      { "from": "hdfs-diskbalancer", "to": "datanode" },
      { "from": "hdfs-diskbalancer", "to": "hdfs-balancer" },

      { "from": "hdfs-balancer", "to": "namenode" },

      { "from": "hdfs-small-files", "to": "namenode" },

      { "from": "hdfs-storagepolicies", "to": "datanode" },

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
