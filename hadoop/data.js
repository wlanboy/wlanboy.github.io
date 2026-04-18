(function () {
  const GROUP_HUES = {
    "hdfs":       195,
    "hadoop":      38,
    "prometheus":  25,
    "grafana":    280,
  };

  // Per-group force-simulation tuning.
  // hdfs: dense core of 5 highly connected nodes → shorter springs + more repulsion so labels breathe.
  // prometheus: dual-hub (jmx-config / prometheus-scrape) + 6 leaf prom-* nodes all double-connected →
  //   long springs and strong repulsion so hubs can separate and leaves fan outward.
  const GROUP_OPTS = {
    "hdfs":       { repel: 8500,  springL:  75, spring: 0.020, gravity: 0.005, iters: 380 },
    "hadoop":     { gravity: 0.005 },
    "prometheus": { repel: 9000, springL: 75, spring: 0.008, gravity: 0.005, iters: 420 },
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
      { "id": "hdfs",       "label": "HDFS Konzepte",     "color": "#0891b2" },
      { "id": "hadoop",     "label": "Hadoop Cluster",    "color": "#d97706" },
      { "id": "prometheus", "label": "Prometheus / JMX",  "color": "#dc2626" },
      { "id": "grafana",    "label": "Grafana",            "color": "#7c3aed" }
    ],
    "topics": [
      {
        "id": "hdfs-block", "label": "Blöcke & Replikation", "group": "hdfs",
        "description": "HDFS speichert Dateien als Sequenz gleichgroßer Blöcke. Jeder Block existiert physisch als separate Datei auf dem DataNode-Disk und wird unabhängig repliziert.",
        "details": [
          "Im Cluster ist dfs.blocksize=16 MB konfiguriert (Standard: 128 MB). Die kleinere Blockgröße reduziert ungenutzte Restkapazität am Dateiende und senkt die Anzahl an Blöcken die der NameNode im RAM verwalten muss.",
          "Konfigurationsparameter:",
          ["dfs.blocksize = 16777216 (16 MB)", "dfs.replication = 2 (2 Replicas auf 3 DataNodes)", "dfs.permissions.enabled = false (Lab-Setup)"],
          "Replikations-Pipeline beim Schreiben: Client baut eine TCP-Pipeline zu DN1→DN2 auf. Daten fließen als 64 KB Packets. DN1 leitet jedes Packet an DN2 weiter. Erst wenn beide ACK zurückgesendet haben, bestätigt DN1 dem Client. Bei DataNode-Ausfall bricht der Client ab und der NameNode weist Ersatz-DataNodes zu.",
          "Block-Gesundheitszustände die der NameNode überwacht:",
          ["Under-replicated: weniger als dfs.replication Kopien vorhanden → NameNode löst Re-Replikation aus", "Over-replicated: mehr Kopien als gewünscht → NameNode löscht überschüssige Kopien", "Corrupt: alle Kopien haben CRC-Fehler → Datenverlust, Critical Alert", "Missing: Block in NameNode-Metadata bekannt, aber kein DataNode meldet ihn → kritischster Zustand"]
        ],
        "connections": ["hdfs-namenode-role", "hdfs-datanode-role", "hdfs-ha"]
      },
      {
        "id": "hdfs-namenode-role", "label": "NameNode: Namespace & Metadata", "group": "hdfs",
        "description": "Der NameNode ist der zentrale Metadaten-Server von HDFS. Er hält den gesamten Namespace – Verzeichnisbaum, Datei-zu-Block-Mapping und Block-zu-DataNode-Mapping – vollständig im RAM.",
        "details": [
          "Der Heap-Bedarf wächst linear mit der Anzahl von Dateien und Blöcken. Faustregel: ~150 Bytes pro Inode (Datei oder Verzeichnis) + ~200 Bytes pro Block. Bei 2 GB Heap sind ca. 100–150 Millionen Objekte verwaltbar.",
          "JVM-Konfiguration:",
          ["-Xms2g -Xmx2g (fester Heap, kein Resize-Overhead)", "-XX:+UseG1GC", "-XX:G1HeapRegionSize=32m (2 GB / 64 Regionen = 32 MB – G1-Optimum)", "-XX:MaxGCPauseMillis=200 (unter ZK-Session-Timeout von 120 s)", "GC-Log: /var/log/hadoop/gc-namenode.log (5 × 10 MB rotierend)"],
          "Wichtige Konfigurationsparameter:",
          ["dfs.namenode.handler.count = 80 (parallele Client-RPC-Handler)", "dfs.namenode.service.handler.count = 20 (Handler für DataNodes und ZKFC)", "dfs.namenode.edits.asynclogging = true (Edit-Log-Schreiben entkoppelt vom RPC-Thread)", "dfs.namenode.checkpoint.txns = 1000000 (Checkpoint nach 1 Mio. Transaktionen)", "dfs.namenode.checkpoint.period = 3600 s (oder nach 1 Stunde)"],
          "Im HA-Setup läuft kein separater SecondaryNameNode. Stattdessen führt der Standby-NameNode die Checkpoints durch und überträgt das neue FSImage an den aktiven NameNode."
        ],
        "connections": ["hdfs-block", "hdfs-fsimage", "hdfs-editlog", "hdfs-ha"]
      },
      {
        "id": "hdfs-datanode-role", "label": "DataNode: Block-Storage", "group": "hdfs",
        "description": "DataNodes sind die Worker-Knoten von HDFS. Sie speichern Block-Daten als Dateien im lokalen Dateisystem und führen auf Anweisung des NameNode Block-Operationen aus.",
        "details": [
          "Die Kommunikation zwischen DataNode und NameNode läuft über zwei Kanäle: Heartbeats (Lebenszeichen + Kapazitätsstatus) und Block-Reports (vollständiges Inventory aller gespeicherten Blöcke).",
          "Heartbeat- und Block-Report-Parameter:",
          ["dfs.heartbeat.interval = 3 s", "dfs.namenode.stale.datanode.interval = 30000 ms (kein Heartbeat → stale)", "dfs.blockreport.intervalMsec = 21600000 ms (Full Block-Report alle 6 h)", "dfs.datanode.directoryscan.interval = 21600 s (lokaler Disk-Scan alle 6 h)"],
          "Performance-Parameter:",
          ["dfs.datanode.max.transfer.threads = 4096 (max. parallele Block-Transfers)", "dfs.datanode.handler.count = 20 (RPC-Handler für NameNode- und Client-Anfragen)"],
          "JVM-Konfiguration:",
          ["-Xms1g -Xmx1g", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=100 ms (aggressiver als NameNode)", "GC-Log: /var/log/hadoop/gc-datanode.log"],
          "DataNodes prüfen gespeicherte Blöcke regelmäßig via CRC-Verifizierung. Fehler werden an den NameNode gemeldet, der den Block als corrupt markiert und Re-Replikation von gesunden Kopien auslöst."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role"]
      },
      {
        "id": "hdfs-editlog", "label": "Edit Log", "group": "hdfs",
        "description": "Das Edit Log ist das Write-Ahead-Log des NameNode. Jede Namespace-Änderung wird als Transaktion mit monoton steigender Transaktions-ID geschrieben, bevor sie im RAM-Namespace sichtbar wird.",
        "details": [
          "Namespace-Operationen die als Transaktion geloggt werden:",
          ["create, delete, rename (Datei- und Verzeichnisoperationen)", "setReplication, setPermission, setOwner", "addBlock, updateBlocks, completeFile", "mkdir, symlink"],
          "Im HA-Setup wird das Edit Log nicht auf lokaler Disk geschrieben, sondern über das Quorum Journal Manager (QJM) Protokoll an alle JournalNodes verteilt. Der aktive NameNode sendet jede Transaktion gleichzeitig an alle 3 JNs. Ein Commit gilt als erfolgreich wenn mindestens 2 von 3 JNs bestätigen.",
          "JournalNode-Konfiguration:",
          ["dfs.namenode.shared.edits.dir = qjournal://jn1:8485;jn2:8485;jn3:8485/ns1", "JournalNode RPC-Port: 8485", "JournalNode JMX-Port: 28080", "Heap: -Xms512m -Xmx512m"],
          "dfs.namenode.edits.asynclogging=true entkoppelt das Schreiben des Edit Logs vom RPC-Handler-Thread. Ein dedizierter Logging-Thread übernimmt die Kommunikation mit den JournalNodes, der Client-RPC wartet nicht auf den JN-Quorum-Commit."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-fsimage", "hdfs-ha"]
      },
      {
        "id": "hdfs-fsimage", "label": "FSImage & Checkpoint", "group": "hdfs",
        "description": "Das FSImage ist ein vollständiger, binär serialisierter Snapshot des NameNode-Namespace zu einem bestimmten Zeitpunkt. Es enthält den kompletten Verzeichnisbaum, alle Datei-Attribute und Block-Mappings.",
        "details": [
          "Beim Start lädt der NameNode das letzte FSImage und replayed dann alle Edit-Log-Transaktionen die danach angefallen sind. Je länger kein Checkpoint stattgefunden hat, desto mehr Transaktionen müssen replayed werden und desto länger dauert der Neustart.",
          "Checkpoint-Trigger (OR-Verknüpfung – was zuerst eintritt):",
          ["dfs.namenode.checkpoint.txns = 1000000 (1 Mio. Transaktionen seit letztem Checkpoint)", "dfs.namenode.checkpoint.period = 3600 s (1 Stunde seit letztem Checkpoint)"],
          "Im HA-Setup führt der Standby-NameNode die Checkpoints durch. Ablauf: Standby merged lokales FSImage mit aufgelaufenen Edit-Log-Segmenten → schreibt neues FSImage → überträgt es via HTTP an den aktiven NameNode → aktiver NN nimmt es als neues Basis-FSImage an.",
          "FSImage-Dateien im NameNode-Datenverzeichnis:",
          ["fsimage_XXXXXXXXXXXXXXXX – letztes gespeichertes Image, TX-ID als Suffix", "fsimage_XXXXXXXXXXXXXXXX.md5 – Integritätsprüfung", "edits_inprogress_XXXX – aktuell beschriebenes Edit-Log-Segment", "edits_XXXX-XXXX – abgeschlossene Edit-Log-Segmente"],
          "Der Alert CheckpointLag schlägt an wenn hadoop_namenode_namenodeactivity_transactionssincecheckpoint > 1.000.000 – also wenn kein Checkpoint in angemessener Zeit stattgefunden hat."
        ],
        "connections": ["hdfs-editlog", "hdfs-namenode-role", "hdfs-ha"]
      },
      {
        "id": "hdfs-ha", "label": "High Availability", "group": "hdfs",
        "description": "HDFS HA eliminiert den NameNode als Single Point of Failure durch zwei parallele NameNode-Instanzen mit geteiltem Edit Log über JournalNodes und automatischem Failover via ZooKeeper.",
        "details": [
          "Die HA-Architektur besteht aus fünf Komponenten: 2 NameNodes (aktiv/standby), 3 JournalNodes (Edit-Log-Sharing via QJM), 3 ZooKeeper-Knoten (Leader Election), 2 ZKFCs (Health-Monitor und Failover-Trigger) sowie DataNodes, die beide NNs kennen und dem aktiven folgen.",
          "Automatischer Failover-Ablauf:",
          ["1. ZKFC erkennt dass lokaler NameNode nicht mehr reagiert (Health-Check schlägt fehl)", "2. ZKFC gibt seinen ZooKeeper Ephemeral Lock Node auf", "3. ZooKeeper benachrichtigt den Wächter des anderen ZKFC", "4. Anderer ZKFC führt Fencing aus: shell(/bin/true) – kein echtes Fencing im Lab", "5. Anderer ZKFC promoviert seinen NameNode auf aktiv", "6. DataNodes empfangen neue aktive NN-Adresse und senden Heartbeats dorthin"],
          "HA-Konfigurationsparameter in hdfs-site.xml:",
          ["dfs.nameservices = ns1", "dfs.ha.namenodes.ns1 = nn1,nn2", "dfs.namenode.rpc-address.ns1.nn1 = nn1:8020", "dfs.namenode.rpc-address.ns1.nn2 = nn2:8020", "dfs.ha.automatic-failover.enabled = true", "ha.zookeeper.quorum = zk1:2181,zk2:2181,zk3:2181", "zookeeper.request.timeout = 120000 ms", "dfs.ha.fencing.methods = shell(/bin/true)", "dfs.client.failover.proxy.provider.ns1 = ConfiguredFailoverProxyProvider"],
          "Im Produktivbetrieb muss das Fencing echten Split-Brain verhindern. shell(/bin/true) bedeutet: es wird nie wirklich gefenced. Bei gleichzeitigem Start zweier aktiver NameNodes entstehen divergente Edit Logs – fataler Datenverlust. Produktionsalternativen: SSH-Fencing oder STONITH (Power Cycling via IPMI/iDRAC)."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-editlog", "hdfs-fsimage"]
      },
      {
        "id": "hdfs-replication-pipeline", "label": "Schreib-Pipeline & Read-Path", "group": "hdfs",
        "description": "HDFS-Clients kommunizieren direkt mit DataNodes für Datentransfers, aber immer über den NameNode für Metadaten-Lookups. Dies trennt Control-Path (NameNode) vom Data-Path (DataNodes).",
        "details": [
          "Schreib-Ablauf (Write Path):",
          ["1. Client ruft create() auf dem NameNode – NN prüft Permissions, erstellt Inode, gibt Lease", "2. Client fordert Block an (addBlock RPC) – NN wählt DataNodes mit Rack-Aware Placement", "3. Client baut TCP-Pipeline auf: Client → DN1 → DN2", "4. Client streamt 64 KB Packets, DN1 leitet weiter an DN2", "5. DN2 sendet ACK zurück durch die Pipeline zum Client", "6. Bei vollständigem Block: Client ruft complete() – NN schließt Block"],
          "Lese-Ablauf (Read Path):",
          ["1. Client ruft open() – getBlockLocations RPC an NameNode", "2. NN gibt sortierte DataNode-Liste pro Block zurück (nächster zuerst via Rack-Awareness)", "3. Client liest direkt vom nächsten DataNode, kein Proxy durch den NameNode", "4. Bei DataNode-Fehler: Client versucht nächste DataNode in der Liste", "5. CRC-Prüfung auf Client-Seite nach jedem Block"],
          "dfs.client.failover.proxy.provider.ns1=ConfiguredFailoverProxyProvider sorgt dafür, dass HDFS-Clients bei einem NameNode-Failover automatisch den neuen aktiven NameNode finden ohne Neustart oder Konfigurationsänderung. Der Client probiert nn1 und nn2 durch bis einer antwortet."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role", "hdfs-datanode-role"]
      },
      {
        "id": "hdfs-small-files", "label": "Small-Files-Optimierung", "group": "hdfs",
        "description": "Viele kleine Dateien sind die klassische HDFS-Herausforderung: Jede Datei beansprucht NameNode-RAM unabhängig von ihrer Größe, und das Default-Blockformat ist für kleine Dateien ineffizient.",
        "details": [
          "NameNode-RAM-Verbrauch: jeder Inode (Datei oder Verzeichnis) benötigt ca. 150 Bytes, jeder Block-Mapping-Eintrag ca. 200 Bytes. Bei dfs.replication=2 belegen 1 Mio. Dateien mit je 1 Block bereits ca. 700 MB Heap.",
          "RAM-Kapazitätsabschätzung für 2 GB Heap:",
          ["~8 Mio. Dateien mit durchschnittlich 2 Blöcken je Datei ≈ Grenze des 2-GB-Heaps", "dfs.blocksize=16 MB statt 128 MB: weniger Blöcke pro größerer Datei", "dfs.replication=2 statt 3: reduziert Block-Mapping-Einträge um 33 %"],
          "Konfigurationsanpassungen im Cluster für Small-File-Workloads:",
          ["dfs.blocksize = 16 MB (statt 128 MB Default)", "dfs.namenode.handler.count = 80 (mehr parallele Client-Verbindungen)", "dfs.namenode.edits.asynclogging = true (geringere Create-Latenz)", "dfs.namenode.checkpoint.txns = 1000000 (regelmäßige Checkpoints)"],
          "Für extreme Small-File-Workloads (Millionen KB-großer Dateien) reichen diese Anpassungen nicht aus. Langfristige Lösungen: HAR-Archives (mehrere Dateien in einem Container), SequenceFiles (Key-Value-Store für kleine Dateien) oder Apache Ozone als Object-Storage-Alternative zu HDFS."
        ],
        "connections": ["hdfs-block", "hdfs-namenode-role"]
      },
      {
        "id": "hdfs-balancer", "label": "HDFS Balancer", "group": "hdfs",
        "description": "Der HDFS Balancer ist ein eigenständiges Tool das Block-Daten zwischen DataNodes umverteilt, um eine gleichmäßige Disk-Auslastung wiederherzustellen – z.B. nach dem Hinzufügen neuer DataNodes oder nach ungleichmäßigen Schreiblasten.",
        "details": [
          "Der Balancer läuft als separater JVM-Prozess (kein YARN-Job). Er koordiniert Block-Moves direkt über die DataNode-Transfer-Threads. Der aktive NameNode weist den Balancer auf Quell- und Ziel-DataNodes hin; die eigentliche Datenübertragung läuft wie eine normale Block-Replikation über TCP.",
          "Aufruf und wichtige Flags:",
          ["hdfs balancer -threshold 10 (max. erlaubte Differenz der Disk-Auslastung in %)", "hdfs balancer -idleiterations 5 (Abbruch nach N Iterationen ohne Fortschritt)", "hdfs balancer -blockpools ns1 (auf einen Nameservice begrenzen)"],
          "Bandbreiten- und Performance-Parameter:",
          ["dfs.datanode.balance.bandwidthPerSec = 104857600 (100 MB/s – Standard)", "dfs.balancer.moverThreads = 1000 (parallele Move-Threads)", "dfs.balancer.max-no-move-interval = 60000 ms (Timeout ohne erfolgreichen Move)", "dfs.balancer.getBlocks.size = 2147483648 (Max. Bytes pro getBlocks-RPC-Aufruf)"],
          "Wann den Balancer starten:",
          ["Nach dem Hinzufügen neuer DataNodes (neue DNs sind initial leer)", "Nach sehr ungleichmäßigen Bulk-Schreibvorgängen", "Wenn DataNode-Disk-Auslastung im Grafana-Dashboard stark voneinander abweicht", "Im Wartungsfenster starten – der Balancer erzeugt erheblichen Netzwerkdurchsatz"],
          "Der Balancer beendet sich selbst wenn der Threshold erreicht ist oder kein Fortschritt mehr möglich ist. Er kann jederzeit mit Ctrl+C abgebrochen werden ohne den Cluster zu beschädigen – laufende Block-Moves werden abgeschlossen, keine Daten gehen verloren."
        ],
        "connections": ["hdfs-block", "hdfs-datanode-role", "datanode"]
      },
      {
        "id": "hdfs-snapshots", "label": "HDFS Snapshots", "group": "hdfs",
        "description": "HDFS Snapshots sind schreibgeschützte Point-in-Time-Kopien von Verzeichnisbäumen. Sie werden als reine Metadaten-Operationen implementiert – es werden keine Datenblöcke kopiert. Der NameNode speichert nur die Differenz (geänderte Blöcke) zur Snapshot-Zeit.",
        "details": [
          "Snapshots sind auf Verzeichnisebene aktivierbar. Ein Snapshot-fähiges Verzeichnis wird als 'snapshottable directory' markiert. Der NameNode hält Snapshot-Metadaten im RAM (ca. 150 Bytes pro Snapshot-Eintrag, ähnlich wie normale Inodes).",
          "Snapshot-Verwaltung via HDFS-Shell:",
          ["hdfs dfsadmin -allowSnapshot /user/data → Verzeichnis snapshot-fähig machen", "hdfs dfs -createSnapshot /user/data backup-2026-04-18 → Snapshot erstellen", "hdfs dfs -listSnapshots /user/data → alle Snapshots auflisten", "hdfs dfs -deleteSnapshot /user/data backup-2026-04-18 → Snapshot löschen", "hdfs snapshotDiff /user/data backup-2026-04-18 . → Diff zwischen Snapshot und aktuellem Stand"],
          "Zugriff auf Snapshot-Daten:",
          ["Snapshots sind unter /user/data/.snapshot/backup-2026-04-18/ zugänglich", ".snapshot ist ein virtuelles Verzeichnis – es erscheint nicht in ls, ist aber direkt adressierbar", "Dateien im Snapshot können wie normale HDFS-Dateien gelesen werden (hdfs dfs -cat, distcp, etc.)"],
          "Typische Anwendungsfälle:",
          ["Backup vor einem Bulk-Delete oder einer Datenmigration", "Datenbasis für inkrementellen distcp: hdfs distcp -update -diff snap1 snap2 /src /dst", "Rollback bei fehlerhafter ETL-Verarbeitung", "Konsistenter Lese-Snapshot für parallele Analysen ohne Write-Locks"],
          "Einschränkungen: max. 65536 Snapshots pro Verzeichnis. Gelöschte Dateien deren Blöcke noch in einem Snapshot referenziert sind, belegen weiterhin Disk-Kapazität. Snapshots werden nicht automatisch angelegt – keine Scheduler-Integration in Vanilla HDFS."
        ],
        "connections": ["hdfs-namenode-role", "hdfs-block", "hdfs-replication-pipeline"]
      },
      {
        "id": "zookeeper", "label": "ZooKeeper", "group": "hadoop",
        "description": "3-Knoten-Quorum (zk1, zk2, zk3) für Cluster-Koordination und Leader Election. ZooKeeper verwaltet den aktiven NameNode und koordiniert den automatischen Failover via ZKFC.",
        "details": [
          "ZooKeeper bildet das Fundament der HDFS-HA-Infrastruktur. Es speichert ephemere Nodes für die aktive NameNode-Identität. Der ZooKeeper-Session-Timeout ist der kritische Parameter: alle JVM-GC-Pausen der Hadoop-Dienste müssen kürzer sein, sonst verliert ein Dienst fälschlicherweise seine Session.",
          "ZooKeeper-Cluster-Konfiguration:",
          ["Knoten: zk1, zk2, zk3", "Image: zookeeper:3.9.4", "Client-Port: 2181", "Quorum-String: zk1:2181,zk2:2181,zk3:2181", "Minimale Verfügbarkeit: 2 von 3 Knoten"],
          "Konfigurationsparameter in den Hadoop-Diensten:",
          ["ha.zookeeper.quorum = zk1:2181,zk2:2181,zk3:2181", "zookeeper.request.timeout = 120000 ms (120 s Session-Timeout)", "MaxGCPauseMillis = 200 ms (alle Dienste – weit unter ZK-Timeout)"],
          "Bei echtem Produktionseinsatz sollten ZooKeeper-Knoten auf dedizierten Hosts mit schnellen lokalen SSDs laufen. ZooKeeper ist latenz-sensitiv: die fsync-Zeit bei Transaktions-Commits bestimmt die Commit-Latenz, die direkt in die ZKFC-Reaktionszeit einfließt."
        ],
        "connections": ["zkfc", "journalnode", "namenode", "resourcemanager"]
      },
      {
        "id": "journalnode", "label": "JournalNode", "group": "hadoop",
        "description": "3 JournalNodes (jn1, jn2, jn3) bilden das Quorum Journal Manager (QJM) für den HA-Edit-Log-Sharing zwischen den NameNodes.",
        "details": [
          "Der JournalNode ist ein leichtgewichtiger Daemon der ausschließlich Edit-Log-Segmente speichert. Er schreibt keine FSImages und verwaltet keinen eigenen Namespace. Seine Hauptaufgabe: Edit-Log-Segmente des aktiven NameNode empfangen, persistent speichern und dem Standby-NameNode zum Lesen bereitstellen.",
          "Konfiguration im docker-compose.yml:",
          ["JMX-Export-Port: 28080", "Heap: -Xms512m -Xmx512m", "GC: G1GC mit MaxGCPauseMillis=200 ms", "JournalNode-RPC-Port: 8485"],
          "Konfigurationsparameter in hdfs-site.xml:",
          ["dfs.namenode.shared.edits.dir = qjournal://jn1:8485;jn2:8485;jn3:8485/ns1", "dfs.journalnode.edits.dir = /data/hadoop/journal"],
          "Für den Quorum-Mechanismus gilt: 2 von 3 JournalNodes müssen eine Transaktion bestätigen. Fällt ein JN aus, arbeitet der Cluster weiter. Fällt ein zweiter JN aus, stoppt der aktive NameNode das Schreiben. JournalNodes niemals auf denselben Hosts wie NameNodes betreiben."
        ],
        "connections": ["namenode", "zookeeper"]
      },
      {
        "id": "namenode", "label": "NameNode", "group": "hadoop",
        "description": "2 NameNodes (nn1 aktiv, nn2 standby) verwalten den HDFS-Namespace im HA-Betrieb. Nameservice: ns1. Heap: 2 GB, JMX-Export auf Port 28080.",
        "details": [
          "Ports und Dienste:",
          ["nn1 Web-UI: 9870, nn2 Web-UI: 9871", "NameNode RPC (Clients): 8020", "JMX-Export NameNode: 28080", "JMX-Export ZKFC: 28081"],
          "JVM-Konfiguration:",
          ["-Xms2g -Xmx2g", "-XX:+UseG1GC", "-XX:G1HeapRegionSize=32m (64 Regionen bei 2 GB Heap)", "-XX:MaxGCPauseMillis=200", "GC-Log: /var/log/hadoop/gc-namenode.log (5 × 10 MB rotierend)"],
          "Kritische hdfs-site.xml Parameter:",
          ["dfs.namenode.handler.count = 80", "dfs.namenode.service.handler.count = 20", "dfs.namenode.edits.asynclogging = true", "dfs.namenode.checkpoint.txns = 1000000", "dfs.namenode.checkpoint.period = 3600", "dfs.blocksize = 16777216 (16 MB)", "dfs.replication = 2"],
          "core-site.xml Parameter:",
          ["fs.defaultFS = hdfs://ns1", "io.file.buffer.size = 131072 (128 KB I/O-Puffer)", "hadoop.security.authentication = simple", "hadoop.tmp.dir = /data/hadoop/tmp", "fs.trash.interval = 10080 min (7 Tage Papierkorb)", "fs.trash.checkpoint.interval = 1440 min (24 h)"]
        ],
        "connections": ["zkfc", "journalnode", "datanode", "zookeeper"]
      },
      {
        "id": "zkfc", "label": "ZKFC", "group": "hadoop",
        "description": "ZooKeeper Failover Controller läuft als separater Prozess auf jedem NameNode-Host und überwacht den lokalen NameNode für automatisches HA-Failover.",
        "details": [
          "ZKFC hat zwei Hauptaufgaben: Health-Monitoring des lokalen NameNode (via periodische RPC-Health-Checks) und ZooKeeper-basierte Leader Election. Nur der ZKFC des aktiven NameNode hält einen ZooKeeper-Ephemeral-Lock-Node. Verliert er den Lock, kann der andere ZKFC übernehmen.",
          "Betrieb und Konfiguration:",
          ["Läuft als separater Prozess hdfs zkfc auf nn1 und nn2", "JMX-Export-Port: 28081 (separater Port, nicht 28080 wie NameNode)", "dfs.ha.automatic-failover.enabled = true", "dfs.ha.fencing.methods = shell(/bin/true) (Lab: kein echtes Fencing)"],
          "ZKFC Failover-Ablauf bei NameNode-Ausfall:",
          ["1. ZKFC sendet RPC-Health-Check an lokalen NameNode", "2. Nach Timeout oder Fehler: ZKFC markiert NN als unhealthy", "3. ZKFC gibt ZooKeeper Ephemeral Node auf", "4. ZooKeeper benachrichtigt den Wächter des anderen ZKFC", "5. Anderer ZKFC führt Fencing aus (shell /bin/true → kein echtes Fencing)", "6. Neuer aktiver NameNode wird proklamiert"],
          "Das Fencing mit shell(/bin/true) bedeutet: Es wird nie wirklich gefenced. Im Lab ist das akzeptabel weil nur je ein Container läuft. In Produktion kann das dazu führen dass zwei NameNodes gleichzeitig aktiv werden – divergente Edit Logs und Datenverlust."
        ],
        "connections": ["namenode", "zookeeper"]
      },
      {
        "id": "datanode", "label": "DataNode", "group": "hadoop",
        "description": "3 DataNodes (dn1, dn2, dn3) speichern HDFS-Blöcke und führen Datenoperationen auf Anweisung von NameNode und Clients aus.",
        "details": [
          "Ports und Dienste:",
          ["Daten-Transfer-Port: 9866", "Web-UI: 9864", "IPC-Port: 9867", "JMX-Export: 28080"],
          "JVM-Konfiguration:",
          ["-Xms1g -Xmx1g", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=100 ms", "GC-Log: /var/log/hadoop/gc-datanode.log"],
          "Kritische hdfs-site.xml Parameter:",
          ["dfs.datanode.max.transfer.threads = 4096", "dfs.datanode.handler.count = 20", "dfs.heartbeat.interval = 3 s", "dfs.namenode.stale.datanode.interval = 30000 ms", "dfs.blockreport.intervalMsec = 21600000 ms (6 h Full Block-Report)", "dfs.datanode.directoryscan.interval = 21600 s (6 h lokaler Disk-Scan)"],
          "Bei mehreren konfigurierten Volumes verteilt HDFS Blöcke round-robin. dfs.datanode.failed.volumes.tolerated bestimmt ab wann ein DataNode sich selbst aus dem Cluster nimmt. Volume-Ausfälle sind Critical-Alert-Kandidaten weil sie die effektive Replikationsrate senken."
        ],
        "connections": ["namenode"]
      },
      {
        "id": "resourcemanager", "label": "ResourceManager", "group": "hadoop",
        "description": "Der YARN ResourceManager verwaltet Cluster-Ressourcen und Job-Scheduling. In diesem Setup minimal für distcp-Jobs konfiguriert.",
        "details": [
          "Ports und Dienste:",
          ["Web-UI: 8088", "JobHistory Server Web-UI: 19888", "ResourceManager RPC: 8032", "Admin RPC: 8033", "JMX-Export: 28080"],
          "JVM-Konfiguration:",
          ["-Xms2g -Xmx2g", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200 ms"],
          "yarn-site.xml Parameter:",
          ["yarn.resourcemanager.hostname = rm", "yarn.nodemanager.aux-services = mapreduce_shuffle", "yarn.scheduler.maximum-allocation-mb = 2048", "yarn.log-aggregation-enable = true", "yarn.log-aggregation.retain-seconds = 604800 (7 Tage)", "yarn.nodemanager.vmem-check-enabled = false"],
          "mapred-site.xml Parameter:",
          ["mapreduce.framework.name = yarn", "mapreduce.jobhistory.address = rm:10020", "mapreduce.jobhistory.webapp.address = rm:19888", "mapreduce.am.resource.mb = 512", "mapreduce.map.memory.mb = 512", "mapreduce.reduce.memory.mb = 512", "mapreduce.job.ubertask.enable = true (kleine Jobs laufen im AM-Container)"],
          "capacity-scheduler.xml:",
          ["yarn.scheduler.capacity.root.queues = default", "yarn.scheduler.capacity.root.default.capacity = 100", "yarn.scheduler.capacity.root.default.maximum-capacity = 100", "yarn.scheduler.capacity.root.default.state = RUNNING"]
        ],
        "connections": ["nodemanager", "zookeeper"]
      },
      {
        "id": "nodemanager", "label": "NodeManager", "group": "hadoop",
        "description": "Der YARN NodeManager führt Container auf dem Worker-Knoten aus und verwaltet lokale Ressourcen (CPU, Memory, Disk).",
        "details": [
          "Ports und Dienste:",
          ["Web-UI: 8042", "RPC-Port: 8041", "JMX-Export: 28080"],
          "JVM-Konfiguration:",
          ["-Xms1g -Xmx1g", "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200 ms"],
          "yarn-site.xml Parameter (NodeManager-spezifisch):",
          ["yarn.nodemanager.resource.memory-mb = 2048", "yarn.nodemanager.resource.cpu-vcores = 2", "yarn.nodemanager.vmem-check-enabled = false", "yarn.nodemanager.local-dirs = /data/yarn/local", "yarn.nodemanager.log-dirs = /data/yarn/logs", "yarn.nodemanager.aux-services = mapreduce_shuffle"],
          "Der NodeManager meldet sich beim ResourceManager an und sendet regelmäßige Heartbeats mit Ressourcenverbrauch und Container-Status. Bei Ausfall des NodeManager markiert der RM alle laufenden Container als verloren. Applikationen die Fault-Tolerance implementieren (MapReduce) starten fehlgeschlagene Tasks auf anderen NodeManagern neu."
        ],
        "connections": ["resourcemanager", "datanode"]
      },
      {
        "id": "distcp", "label": "DistCp", "group": "hadoop",
        "description": "DistCp (Distributed Copy) ist ein MapReduce-basiertes Tool für großvolumige Datenkopiervorgänge innerhalb eines HDFS-Clusters oder zwischen zwei Clustern. Jeder Map-Task kopiert eine Teilmenge der Dateien parallel.",
        "details": [
          "DistCp läuft als MapReduce-Job auf YARN. Der Job-Client berechnet eine Liste aller zu kopierenden Dateien, teilt sie in gleich große Batches auf und erzeugt einen Mapper pro Batch. Jeder Mapper liest aus dem Quell-HDFS und schreibt in das Ziel-HDFS direkt über die DataNode-Transfer-Pfade.",
          "Grundlegende Syntax:",
          ["hadoop distcp hdfs://ns1/src hdfs://ns1/dst", "hadoop distcp -m 10 hdfs://ns1/src hdfs://ns1/dst (-m: Anzahl Mapper)", "hadoop distcp -bandwidth 50 hdfs://ns1/src hdfs://ns1/dst (-bandwidth: MB/s pro Mapper)", "hadoop distcp -update hdfs://ns1/src hdfs://ns1/dst (nur geänderte Dateien kopieren)", "hadoop distcp -delete hdfs://ns1/src hdfs://ns1/dst (Zieldateien löschen die in Quelle fehlen)"],
          "Wichtige Flags:",
          ["-p (rbugct) → Attribute bewahren: permissions, replication, block-size, user, group, checksum, timestamps", "-atomic → Kopie zuerst in tmp-Verzeichnis, dann atomares Rename", "-overwrite → Zieldateien immer überschreiben, unabhängig von Änderungsstatus", "-diff snap1 snap2 → inkrementelles distcp über HDFS-Snapshot-Diff (nur geänderte Blöcke)"],
          "YARN-Ressourcenverbrauch im Cluster:",
          ["mapreduce.am.resource.mb = 512 MB (ApplicationMaster)", "mapreduce.map.memory.mb = 512 MB (pro Mapper-Container)", "Mapper-Anzahl -m begrenzen damit distcp nicht den gesamten YARN-Cluster belegt", "distcp erscheint in der YARN Web-UI (Port 8088) unter dem job-Namen 'distcp'"],
          "Inkrementelles distcp mit Snapshot-Diff:",
          ["hdfs dfsadmin -allowSnapshot /src", "hdfs dfs -createSnapshot /src snap1", "hadoop distcp -update -diff snap1 snap2 hdfs://ns1/src hdfs://ns1/dst", "Nur Blöcke die sich zwischen snap1 und snap2 geändert haben werden übertragen – erhebliche Bandbreiteneinsparung"]
        ],
        "connections": ["resourcemanager", "nodemanager", "hdfs-replication-pipeline", "hdfs-snapshots"]
      },
      {
        "id": "jmx-agent", "label": "JMX Exporter Agent", "group": "prometheus",
        "description": "Der Prometheus JMX Exporter Java Agent instrumentiert Hadoop-Prozesse von innen und exponiert JMX-Metriken als Prometheus-Endpunkt auf Port 28080.",
        "details": [
          "Der Agent läuft im selben Prozess wie der Hadoop-Dienst. Dadurch gibt es keine Netzwerklatenz zwischen Prozess und Exporter, und der Agent hat direkten Zugriff auf alle JMX-MBeans ohne separaten TCP-basierten JMX-Port.",
          "JVM-Argument-Syntax:",
          ["-javaagent:/opt/hadoop/jmx_prometheus_javaagent.jar=28080:/opt/hadoop/config/jmx_config.yml", "Port 28080: HTTP-Endpunkt /metrics im Prometheus-Textformat", "ZKFC nutzt separaten Port 28081 (zwei Prozesse auf demselben NameNode-Host)"],
          "Technische Eigenschaften:",
          ["Instrumentierung via Java Instrumentation API – kein JMX-TCP-Port nötig", "MBean-Traversal bei jedem Scrape (kein Caching zwischen Scrapes)", "Lazy Loading: Metriken erst verfügbar wenn MBeans registriert sind", "Thread-safe: parallele Prometheus-Scrapes möglich"],
          "Da der Agent im selben Prozess läuft, blockieren JVM-Pausen (GC, Safepoint) auch den Scrape-HTTP-Handler. Prometheus wertet das als Timeout und zählt es als Scrape-Failure. Die scrape_timeout-Einstellung sollte daher über den erwarteten MaxGCPauseMillis liegen."
        ],
        "connections": ["jmx-config", "prometheus-scrape"]
      },
      {
        "id": "jmx-config", "label": "jmx_config.yml", "group": "prometheus",
        "description": "jmx_config.yml definiert welche JMX-MBeans exportiert werden und wie sie auf Prometheus-Metriknamen gemappt werden – eine einzige Konfigurationsdatei für alle Hadoop-Rollen.",
        "details": [
          "Die Konfiguration besteht aus einer Liste von Rules (Regex-Muster). Jede Rule matched gegen den vollständigen MBean-Namen (Domain:type=X,name=Y) und extrahiert Labels und Metrikwerte. Rules werden sequenziell ausgewertet – die erste passende Rule gewinnt.",
          "Abgedeckte MBean-Domains:",
          ["Hadoop:service=DataNode,name=DataNodeActivity – Block-Ops, Bytes read/written", "Hadoop:service=DataNode,name=FSDatasetState – Disk-Kapazität, Volume-Status", "Hadoop:service=DataNode,name=DataNodeVolume – per-Volume-Metriken", "Hadoop:service=NameNode,name=NameNodeActivity – Namespace-Ops (create, delete, rename)", "Hadoop:service=NameNode,name=FSNamesystem – Block-Counts, Replication-Status", "Hadoop:service=NameNode,name=FSNamesystemState – Kapazität, Files/Blocks total", "Hadoop:service=NameNode,name=NameNodeStatus – HAState (active/standby als 0/1)", "Hadoop:service=NameNode,name=RetryCache – Cache-Hits/Misses für idempotente RPCs", "Hadoop:service=*,name=JvmMetrics – Heap, GC, Threads (alle Dienste)", "Hadoop:service=*,name=RpcActivityForPort* – RPC-Latenz und -Durchsatz", "Hadoop:service=ResourceManager,name=ClusterMetrics – NM-Status, Container", "Hadoop:service=ResourceManager,name=QueueMetrics – Queue-Statistiken", "Hadoop:service=NodeManager,name=NodeManagerMetrics – Container, Dirs, Fehler", "Hadoop:service=JournalNode,name=Journal-* – Edit-Log-Segment-Metriken"],
          "Metrik-Labels werden aus MBean-Attributen extrahiert. Der Hostname wird als instance-Label gesetzt, der Service-Name als service-Label. Damit sind Metriken in Grafana-Queries über {instance=\"dn1\"} filterbar."
        ],
        "connections": ["jmx-agent", "prom-namenode-metrics", "prom-datanode-metrics", "prom-yarn-metrics", "prom-jvm-metrics", "prom-rpc-metrics", "prom-journalnode-metrics"]
      },
      {
        "id": "prometheus-scrape", "label": "Scrape-Konfiguration", "group": "prometheus",
        "description": "prometheus.yml konfiguriert wie Prometheus die Hadoop-Dienste scrapt – welche Endpunkte, wie oft, und welche Labels gesetzt werden.",
        "details": [
          "Globale Einstellungen:",
          ["scrape_interval: 30s", "evaluation_interval: 30s (Alert-Rules alle 30 s auswerten)", "Retention: 1 Tag (--storage.tsdb.retention.time=1d)", "Prometheus-Port: 9090", "Image: prom/prometheus:v3.8.1"],
          "Scrape-Jobs mit Targets:",
          ["hadoop-namenodes: nn1:28080, nn2:28080 (label: role=namenode)", "hadoop-zkfc: nn1:28081, nn2:28081 (label: role=zkfc)", "hadoop-datanodes: dn1:28080, dn2:28080, dn3:28080 (label: role=datanode)", "hadoop-journalnodes: jn1:28080, jn2:28080, jn3:28080 (label: role=journalnode)", "hadoop-resourcemanager: rm:28080 (label: role=resourcemanager)", "hadoop-nodemanager: nm:28080 (label: role=nodemanager)"],
          "Relabeling: Für jeden Job extrahiert eine relabel_configs-Regel den Hostnamen aus __address__ (z.B. \"nn1:28080\" → \"nn1\") und setzt ihn als instance-Label. Damit sind Metriken in Grafana-Queries über {instance=\"dn1\"} filterbar ohne den Port mitzuführen."
        ],
        "connections": ["jmx-agent", "prom-namenode-metrics", "prom-datanode-metrics", "prom-yarn-metrics", "prom-jvm-metrics", "prom-rpc-metrics", "prom-journalnode-metrics"]
      },
      {
        "id": "prom-namenode-metrics", "label": "NameNode-Metriken", "group": "prometheus",
        "description": "JMX-exportierte Metriken der NameNode-MBeans – die wichtigsten für Cluster-Health, Kapazitätsüberwachung und HA-Status.",
        "details": [
          "FSNamesystemState-Metriken (Kapazität & Namespace):",
          ["hadoop_namenode_fsnamesystemstate_capacitytotal – Gesamt-HDFS-Kapazität in Bytes", "hadoop_namenode_fsnamesystemstate_capacityused – Genutzter Speicher in Bytes", "hadoop_namenode_fsnamesystemstate_capacityremaining – Freier Speicher in Bytes", "hadoop_namenode_fsnamesystemstate_filesandDirectoriesTotal – Namespace-Objekte gesamt", "hadoop_namenode_fsnamesystemstate_blocktotal – Blöcke gesamt"],
          "FSNamesystem-Metriken (Block-Gesundheit):",
          ["hadoop_namenode_fsnamesystem_underreplicatedblocks – Unter-replizierte Blöcke", "hadoop_namenode_fsnamesystem_corruptblocks – Beschädigte Blöcke (→ Critical Alert)", "hadoop_namenode_fsnamesystem_missingreplicablocks – Fehlende Blöcke (→ Critical Alert)", "hadoop_namenode_fsnamesystem_pendingreplicationblocks – In Replikation befindliche Blöcke", "hadoop_namenode_fsnamesystem_scheduledreplicationblocks – Geplante Replikationen"],
          "NameNodeActivity-Metriken (Operationen):",
          ["hadoop_namenode_namenodeactivity_transactionssincecheckpoint – Checkpoint-Lag", "hadoop_namenode_namenodeactivity_createfilenumops – create()-Aufrufe", "hadoop_namenode_namenodeactivity_deletefilenumops – delete()-Aufrufe", "hadoop_namenode_namenodeactivity_getblocklocationsnumops – getBlockLocations()-Aufrufe", "hadoop_namenode_namenodeactivity_addblockops – addBlock()-Aufrufe"],
          "NameNodeStatus-Metriken (HA):",
          ["hadoop_namenode_namenodesatatus_hastate – 0=standby, 1=active (per instance-Label differenziert)", "hadoop_namenode_namenodesatatus_state – String-Feld: active / standby / initializing"]
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "prom-datanode-metrics", "label": "DataNode-Metriken", "group": "prometheus",
        "description": "JMX-exportierte Metriken der DataNode-MBeans – Durchsatz, Block-Operationen und Disk-Gesundheit.",
        "details": [
          "DataNodeActivity-Metriken (Durchsatz & Operationen):",
          ["hadoop_datanode_datanodeactivity_bytesread – Gelesene Bytes (Counter)", "hadoop_datanode_datanodeactivity_byteswritten – Geschriebene Bytes (Counter)", "hadoop_datanode_datanodeactivity_readsfromlocaclient – Lokale Client-Reads", "hadoop_datanode_datanodeactivity_readsfromremoteclient – Remote Client-Reads", "hadoop_datanode_datanodeactivity_heartbeats – Heartbeat-Zähler", "hadoop_datanode_datanodeactivity_heartbeatsavgtime – Heartbeat-Latenz in ms"],
          "FSDatasetState-Metriken (Disk-Kapazität):",
          ["hadoop_datanode_fsdatasetstate_dfsused – Von HDFS genutzter Disk-Speicher in Bytes", "hadoop_datanode_fsdatasetstate_capacity – Gesamt-Disk-Kapazität in Bytes", "hadoop_datanode_fsdatasetstate_remaining – Freier Disk-Speicher in Bytes", "hadoop_datanode_fsdatasetstate_numfailedvolumes – Ausgefallene Volumes (→ Critical Alert)"],
          "IBR- und Block-Metriken:",
          ["hadoop_datanode_datanodeactivity_incrementalblockreportinprogress – Ausstehende IBRs", "hadoop_datanode_datanodeactivity_blocksreplicated – Replizierte Blöcke", "hadoop_datanode_datanodeactivity_blocksremoved – Gelöschte Blöcke", "hadoop_datanode_datanodeactivity_blockverificationfailures – CRC-Fehler (→ Warning Alert)"]
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "prom-yarn-metrics", "label": "YARN-Metriken", "group": "prometheus",
        "description": "JMX-exportierte YARN-Metriken für ResourceManager und NodeManager – Cluster-Kapazität, Container-Status und Queue-Auslastung.",
        "details": [
          "ClusterMetrics (ResourceManager):",
          ["hadoop_resourcemanager_clustermetrics_numactivenms – Aktive NodeManager", "hadoop_resourcemanager_clustermetrics_numlostnms – Verlorene NodeManager (→ Warning Alert)", "hadoop_resourcemanager_clustermetrics_numunhealthynms – Ungesunde NodeManager", "hadoop_resourcemanager_clustermetrics_allocatedmb – Allozierter Memory in MB", "hadoop_resourcemanager_clustermetrics_availablemb – Verfügbarer Memory in MB", "hadoop_resourcemanager_clustermetrics_allocatedvcores – Allozierte vCores", "hadoop_resourcemanager_clustermetrics_availablevcores – Verfügbare vCores"],
          "QueueMetrics (ResourceManager, pro Queue):",
          ["hadoop_resourcemanager_queuemetrics_appspending – Wartende Applikationen", "hadoop_resourcemanager_queuemetrics_appsrunning – Laufende Applikationen", "hadoop_resourcemanager_queuemetrics_appscompleted – Abgeschlossene Applikationen", "hadoop_resourcemanager_queuemetrics_appsfailed – Fehlgeschlagene Applikationen", "hadoop_resourcemanager_queuemetrics_appskilled – Abgebrochene Applikationen"],
          "NodeManagerMetrics (NodeManager):",
          ["hadoop_nodemanager_nodemanagermetrics_containersrunning – Laufende Container", "hadoop_nodemanager_nodemanagermetrics_containerslaunched – Gestartete Container", "hadoop_nodemanager_nodemanagermetrics_containersfailed – Fehlgeschlagene Container", "hadoop_nodemanager_nodemanagermetrics_badlocaldirs – Defekte lokale Verzeichnisse (→ Alert)", "hadoop_nodemanager_nodemanagermetrics_badlogdirs – Defekte Log-Verzeichnisse"]
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "prom-jvm-metrics", "label": "JVM-Metriken", "group": "prometheus",
        "description": "JVM-Metriken gelten für alle Hadoop-Dienste (NameNode, DataNode, JournalNode, ResourceManager, NodeManager, ZKFC). Das * im Metriknamen steht für den jeweiligen Service-Namen.",
        "details": [
          "Heap-Metriken:",
          ["hadoop_*_jvmmetrics_memheapusedm – Aktuell genutzter Heap in MB", "hadoop_*_jvmmetrics_memheapcommittedm – Vom OS reservierter Heap in MB", "hadoop_*_jvmmetrics_memheapmaxm – Maximaler Heap (Xmx) in MB", "hadoop_*_jvmmetrics_memnonheapusedm – Non-Heap (Metaspace, Code Cache) in MB", "hadoop_*_jvmmetrics_memnonheapcommittedm – Committeter Non-Heap in MB"],
          "GC-Metriken (pro GC-Phase):",
          ["hadoop_*_jvmmetrics_gccount – GC-Zyklen gesamt (Counter, G1 Young und Old getrennt)", "hadoop_*_jvmmetrics_gctimemillis – Kumulierte GC-Zeit in ms (Counter)", "Berechnung GC-Last: rate(gctimemillis[1m]) / 1000 = GC-Sekunden pro Sekunde"],
          "Thread-Metriken:",
          ["hadoop_*_jvmmetrics_threadsrunnable – Threads im RUNNABLE-Zustand", "hadoop_*_jvmmetrics_threadsblocked – Threads im BLOCKED-Zustand (→ Warning Alert)", "hadoop_*_jvmmetrics_threadswaiting – Threads im WAITING-Zustand", "hadoop_*_jvmmetrics_threadstimedwaiting – Threads im TIMED_WAITING-Zustand"],
          "Log-Level-Zähler (Counter – immer steigend):",
          ["hadoop_*_jvmmetrics_logfatal – Anzahl FATAL-Log-Meldungen", "hadoop_*_jvmmetrics_logerror – Anzahl ERROR-Log-Meldungen", "hadoop_*_jvmmetrics_logwarn – Anzahl WARN-Log-Meldungen", "hadoop_*_jvmmetrics_loginfo – Anzahl INFO-Log-Meldungen"]
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "prom-rpc-metrics", "label": "RPC-Metriken", "group": "prometheus",
        "description": "RPC-Metriken für alle Hadoop-Dienste, differenziert nach Port (Client-RPC vs. Service-RPC) und Methode.",
        "details": [
          "RpcActivity-Metriken (aggregiert pro Port):",
          ["hadoop_*_rpcactivity_rpcqueuetimeavgtime – Durchschnittliche Queue-Wartezeit in ms", "hadoop_*_rpcactivity_rpcprocessingtimeavgtime – Durchschnittliche Verarbeitungszeit in ms", "hadoop_*_rpcactivity_rpcqueuetimenumops – Anzahl RPC-Aufrufe (Queue-Zeit gemessen)", "hadoop_*_rpcactivity_callqueuelength – Aktuelle Länge der RPC-Warteschlange", "hadoop_*_rpcactivity_openconnections – Offene RPC-Verbindungen", "hadoop_*_rpcactivity_droppedconnections – Abgebrochene Verbindungen", "hadoop_*_rpcactivity_authorizationsuccesses – Erfolgreiche Auth-Prüfungen", "hadoop_*_rpcactivity_authorizationfailures – Fehlgeschlagene Auth-Prüfungen (→ Alert)"],
          "RpcDetailedActivity-Metriken (pro Methode, NameNode):",
          ["hadoop_namenode_rpcdetailedactivity_getblocklocationsnumops – Read-Path-Aufrufe", "hadoop_namenode_rpcdetailedactivity_addblocknumops – Schreib-Path-Aufrufe", "hadoop_namenode_rpcdetailedactivity_completenumops – File-Close-Aufrufe", "hadoop_namenode_rpcdetailedactivity_mkdirnumops – mkdir-Aufrufe", "hadoop_namenode_rpcdetailedactivity_deletenumops – Delete-Aufrufe"],
          "Port-Label differenziert Client-RPC (8020) von Service-RPC (interne DataNode/ZKFC-Kommunikation). Hohe Queue-Latenz auf dem Client-RPC-Port deutet auf Client-Überlastung hin. Hohe Latenz auf dem Service-RPC-Port korreliert mit DataNode-Heartbeat-Problemen."
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "prom-journalnode-metrics", "label": "JournalNode-Metriken", "group": "prometheus",
        "description": "JMX-exportierte Metriken der JournalNode-MBeans – Edit-Log-Sync-Latenz, Batch-Durchsatz und Quorum-Verfügbarkeit.",
        "details": [
          "Journal-Metriken (Edit-Log-Operationen):",
          ["hadoop_journalnode_journal_syncsavgtime – Durchschnittliche fsync-Dauer in ms (→ Warning Alert > 500 ms)", "hadoop_journalnode_journal_syncsnumops – Anzahl fsync-Operationen (Counter)", "hadoop_journalnode_journal_batcheswritten – Geschriebene Edit-Log-Batches (Counter, → Alert wenn Rate == 0)", "hadoop_journalnode_journal_byteswritten – Geschriebene Bytes (Counter)", "hadoop_journalnode_journal_txnswritten – Geschriebene Transaktionen (Counter)"],
          "Quorum- und Verfügbarkeitsmetriken:",
          ["up{role=\"journalnode\"} – Scrape-Erreichbarkeit: 1=up, 0=down (→ Critical Alert)", "count(up{role=\"journalnode\"} == 1) – Anzahl erreichbarer JNs (→ Warning Alert < 3)"],
          "JVM-Metriken: JournalNodes exportieren dieselben JVM-MBeans wie alle anderen Hadoop-Dienste (Heap, GC, Threads). Diese werden über prom-jvm-metrics abgedeckt. Der JournalNode-Heap ist auf 512 MB begrenzt – HeapHigh-Alert bei > 80 % ist besonders relevant.",
          "Alle JournalNode-Metriken sind per instance-Label {instance=\"jn1\"} / {instance=\"jn2\"} / {instance=\"jn3\"} differenzierbar, da der Prometheus-Scrape-Job hadoop-journalnodes die drei Targets jn1:28080, jn2:28080, jn3:28080 kennt."
        ],
        "connections": ["prometheus-scrape", "jmx-config"]
      },
      {
        "id": "dash-namenode-cluster", "label": "Dashboard: NameNode Cluster", "group": "grafana",
        "description": "Primäres Cluster-Übersichts-Dashboard – zeigt den Gesamtzustand des HDFS-Clusters auf einen Blick.",
        "details": [
          "Panels im Dashboard:",
          ["Cluster-Kapazität: Gesamt/Used/Remaining als Gauge (%) und Zeitreihe", "Block-Gesundheit: Missing/Corrupt/Under-Replicated als Stat-Panels (0=grün, >0=rot)", "DataNode-Status: Tabelle mit allen DNs, Kapazität, Used%, Heartbeat-Status", "HA-Status: State-Timeline für nn1 und nn2 (active/standby über Zeit)", "Filesystem-Objekte: Files + Directories als Zeitreihe", "Aktive DataNodes: Anzahl live/stale/dead als Stat-Panels"],
          "Wichtigste PromQL-Queries:",
          ["Kapazitäts-% = (capacityused / capacitytotal) * 100", "HA-Status = hadoop_namenode_namenodesatatus_hastate{instance=\"nn1\"}", "Dead DataNodes = sum(hadoop_namenode_fsnamesystemstate_numdeadDataNodes)", "Missing Blocks = hadoop_namenode_fsnamesystem_missingreplicablocks"]
        ],
        "connections": ["alert-namenode", "dash-namenode-metrics"]
      },
      {
        "id": "dash-namenode-metrics", "label": "Dashboard: NameNode Metrics", "group": "grafana",
        "description": "Operationales NameNode-Dashboard für tiefere Analyse von Namespace-Operationen, Edit-Log-Wachstum und Checkpoint-Verhalten.",
        "details": [
          "Panels im Dashboard:",
          ["Namespace-Operationen/s: create, delete, rename, getlisting als Zeitreihe (rate 1m)", "Transaktionen seit Checkpoint: Zeitreihe mit Schwelle bei 1 Mio.", "Letzter Checkpoint-Zeitpunkt: Stat-Panel mit Zeitstempel", "RPC-Queue-Latenz: Durchschnitt als Zeitreihe (client-port vs. service-port)", "RPC-Durchsatz: Ops/s aufgegliedert nach Methode (getBlockLocations, addBlock, complete)", "Open RPC-Verbindungen: Zeitreihe"],
          "Wichtigste PromQL-Queries:",
          ["Create-Rate = rate(hadoop_namenode_namenodeactivity_createfilenumops[1m])", "Checkpoint-Lag = hadoop_namenode_namenodeactivity_transactionssincecheckpoint", "RPC-Queue-Latenz = hadoop_namenode_rpcactivity_rpcqueuetimeavgtime"]
        ],
        "connections": ["alert-namenode", "dash-namenode-cluster", "dash-rpc"]
      },
      {
        "id": "dash-datanode-metrics", "label": "Dashboard: DataNode Metrics", "group": "grafana",
        "description": "DataNode-Dashboard für Durchsatz-Monitoring, Block-Operationen und Disk-Auslastung pro Node.",
        "details": [
          "Panels im Dashboard:",
          ["Read/Write-Durchsatz: Bytes/s aggregiert und per Instance als Zeitreihe", "Lokale vs. Remote-Reads: Verhältnis als gestapeltes Balkendiagramm", "Block-Operationen/s: replicated, removed, verified als Zeitreihen", "Disk-Auslastung: Used% pro DataNode als Heatmap", "IBR ausstehend: Incremental Block Reports in Progress als Zeitreihe", "Block-Verifikationsfehler: Counter als Zeitreihe mit Alert-Schwelle", "Heartbeat-Latenz: Durchschnitt per Instance"],
          "Wichtigste PromQL-Queries:",
          ["Durchsatz = rate(hadoop_datanode_datanodeactivity_bytesread[1m])", "Disk-% = (dfsused / capacity) * 100", "CRC-Fehler/min = rate(blockverificationfailures[1m])"]
        ],
        "connections": ["alert-datanode"]
      },
      {
        "id": "dash-jvm", "label": "Dashboard: JVM Metrics", "group": "grafana",
        "description": "JVM-Dashboard für alle Hadoop-Dienste – Heap-Überwachung, GC-Analyse und Thread-Monitoring mit Service-Selector-Variable.",
        "details": [
          "Panels im Dashboard:",
          ["Heap-Auslastung: Used/Max in % als Gauge pro Service und Zeitreihe", "GC-Zeit-Anteil: rate(gctimemillis[1m]) / 10000 in % als Zeitreihe", "GC-Frequenz: rate(gccount[1m]) – G1 Young und Old getrennt", "Thread-Übersicht: runnable/blocked/waiting als gestapeltes Area-Chart", "Log-Level-Zähler: rate(logerror[5m]) und rate(logfatal[5m]) als Zeitreihe", "Metaspace: nonheapused/nonheapcommitted als Zeitreihe"],
          "Dashboard-Variablen:",
          ["service: Dropdown für namenode, datanode, resourcemanager, nodemanager, journalnode", "instance: Dropdown für spezifische Instanz (z.B. dn1, dn2, dn3)"]
        ],
        "connections": ["alert-jvm"]
      },
      {
        "id": "dash-rpc", "label": "Dashboard: RPC Metrics", "group": "grafana",
        "description": "RPC-Performance-Dashboard für Latenz-Monitoring und Troubleshooting von RPC-Engpässen in allen Hadoop-Diensten.",
        "details": [
          "Panels im Dashboard:",
          ["Queue-Latenz: Durchschnitt in ms als Zeitreihe mit Schwelle bei 1000 ms", "Processing-Latenz: Durchschnitt in ms mit Schwelle bei 500 ms", "Call-Queue-Länge: aktuelle Warteschlangenlänge mit Schwelle bei 100", "RPC-Durchsatz: Ops/s total und per Methode", "Auth-Fehler: rate(authorizationfailures[5m]) als Zeitreihe", "Open Connections: Zeitverlauf der offenen RPC-Verbindungen", "Dropped Connections: rate(droppedconnections[1m])"],
          "Wichtige PromQL-Queries:",
          ["Queue-Latenz = hadoop_namenode_rpcactivity_rpcqueuetimeavgtime{port=\"8020\"}", "Queue-Länge = hadoop_namenode_rpcactivity_callqueuelength", "Auth-Fehler-Rate = rate(hadoop_namenode_rpcactivity_authorizationfailures[5m])"]
        ],
        "connections": ["alert-rpc", "dash-namenode-metrics"]
      },
      {
        "id": "dash-yarn", "label": "Dashboard: YARN", "group": "grafana",
        "description": "Drei YARN-Dashboards für Cluster-, Queue- und NodeManager-Überwachung.",
        "details": [
          "YARN Cluster Metrics Dashboard:",
          ["Aktive / Verlorene / Ungesunde NodeManager als Stat-Panels", "Allozierter vs. verfügbarer Memory als Gauge (Cluster-Auslastung %)", "Allozierte vs. verfügbare vCores als Gauge", "Memory-Nutzung über Zeit als Zeitreihe"],
          "YARN Queue Metrics Dashboard:",
          ["Apps: pending/running/completed/failed/killed als Zeitreihe", "Queue-Kapazität und -Auslastung in %", "Pending Resources (Memory + vCores wartend auf Allokation)", "App-Fehler-Rate als Zeitreihe"],
          "NodeManager Metrics Dashboard:",
          ["Container-Status: running/launched/failed als Zeitreihe", "Container-Fehler-Rate: rate(containersfailed[1m])", "Bad Local Dirs + Bad Log Dirs als Stat-Panels", "Container-Start-Latenz als Zeitreihe"]
        ],
        "connections": ["alert-yarn"]
      },
      {
        "id": "dash-other", "label": "Weitere Dashboards", "group": "grafana",
        "description": "4 spezialisierte Dashboards für detaillierte Analyse einzelner HDFS-Komponenten: FSVolume, FSNamesystem, JournalNode und RetryCache.",
        "details": [
          "FSVolume Metrics Dashboard:",
          ["Disk-Auslastung per Volume per DataNode als Heatmap", "Freier Speicher per Volume als Zeitreihe", "IBR-Status pro Volume"],
          "FSNamesystem Metrics Dashboard:",
          ["Namespace-Größe: Files + Blocks + Directories als Zeitreihe", "Replication-Status: under-replicated vs. over-replicated", "Pending Replications als Zeitreihe"],
          "JournalNode Metrics Dashboard:",
          ["Edit-Log-Segmente: Anzahl und Größe", "Sync-Zeiten: Dauer für JN-Commits", "Quorum-Status: alle 3 JNs erreichbar?", "Transaktionen verarbeitet pro Zeiteinheit"],
          "RetryCache Metrics Dashboard:",
          ["Cache-Hit-Rate: hits / (hits + misses) als Zeitreihe", "Cache-Evictions über Zeit", "Bedeutung: hohe Miss-Rate deutet auf viele Client-Retries hin (Netzwerkprobleme oder NN-Überlastung)"]
        ],
        "connections": ["dash-namenode-cluster", "dash-datanode-metrics", "prom-journalnode-metrics"]
      },
      {
        "id": "alert-namenode", "label": "Alerts: NameNode", "group": "grafana",
        "description": "7 Alert-Rules in namenode.yml für die kritischsten HDFS-Cluster-Zustände – von fehlenden Blöcken bis zur Kapazitätsgrenze.",
        "details": [
          "Critical Alerts (sofortige Aktion erforderlich):",
          ["MissingBlocks: missingreplicablocks > 0 → Datenverlust möglich, sofort handeln", "CorruptBlocks: corruptblocks > 0 → CRC-Fehler ohne gesunde Kopie", "CapacityCritical: capacityused / capacitytotal > 0.95 → Schreiboperationen scheitern bald"],
          "Warning Alerts (Überwachung und Reaktion erforderlich):",
          ["UnderReplicatedBlocks: underreplicatedblocks > 100 → Replikationsprozess läuft hinterher", "CapacityWarning: capacityused / capacitytotal > 0.85 → Kapazitätsplanung nötig", "DeadDataNodes: staleDataNodes > 0 → DataNode-Ausfall oder Netzwerkproblem", "CheckpointLag: transactionssincecheckpoint > 1000000 → langer NN-Neustart droht"],
          "Alert-Routing (policies.yml):",
          ["Critical: group_wait=10s, repeat_interval=1h", "Warning: group_wait=30s, repeat_interval=4h", "Gruppierung nach: alertname, severity", "Kontaktpunkt: E-Mail"]
        ],
        "connections": ["dash-namenode-cluster", "dash-namenode-metrics"]
      },
      {
        "id": "alert-datanode", "label": "Alerts: DataNode", "group": "grafana",
        "description": "4 Alert-Rules in datanode.yml für DataNode-Gesundheit, Block-Integrität und Heartbeat-Verhalten.",
        "details": [
          "Alert-Definitionen:",
          ["VolumeFailures (Critical): numfailedvolumes > 0 for 0m → Disk-Ausfall, sofortiges Handeln", "BlockVerificationFailures (Warning): rate(blockverificationfailures[5m]) > 0 for 5m → anhaltende CRC-Fehler", "HeartbeatLatencyHigh (Warning): heartbeatsavgtime > 5000 ms for 5m → Netzwerk- oder GC-Probleme", "IBRPendingHigh (Warning): incrementalblockreportinprogress > 1000 for 5m → Block-Report-Rückstau"],
          "Ursachenanalyse bei VolumeFailures:",
          ["Fehlerhafte Disk (S.M.A.R.T.-Status prüfen)", "Volles Filesystem (df -h auf dem DataNode-Host)", "Fehlende Schreibrechte im Datenverzeichnis", "DataNode entfernt sich selbst wenn dfs.datanode.failed.volumes.tolerated überschritten"]
        ],
        "connections": ["dash-datanode-metrics"]
      },
      {
        "id": "alert-yarn", "label": "Alerts: YARN", "group": "grafana",
        "description": "4 Alert-Rules in yarn.yml für YARN-Cluster-Gesundheit, NodeManager-Status und Container-Betrieb.",
        "details": [
          "Alert-Definitionen:",
          ["LostNodeManagers (Warning): numlostnms > 0 for 1m → NM ausgefallen, Kapazitätsverlust", "UnhealthyNodeManagers (Warning): numunhealthynms > 0 for 5m → NM meldet sich als unhealthy", "ContainerFailuresHigh (Warning): rate(containersfailed[1m]) > 10 for 5m → App-Fehler oder Ressourcenmangel", "BadLocalDirs (Warning): badlocaldirs > 0 for 0m → NM-Arbeitsverzeichnis beschädigt"],
          "UnhealthyNodeManager – mögliche Ursachen:",
          ["Volle Festplatte (yarn.nodemanager.disk-health-checker.min-free-space-per-disk-mb unterschritten)", "Fehlende oder nicht schreibbare lokale Verzeichnisse", "Prozessgrenzwerte (ulimit) erreicht"],
          "Alert-Eskalationspfad:",
          ["BadLocalDirs → UnhealthyNodeManagers → LostNodeManagers (stufenweise Eskalation)", "RM legt bei UnhealthyNM keine neuen Container ab, Container laufen aber noch", "Bei LostNM werden alle Container als verloren markiert"]
        ],
        "connections": ["dash-yarn"]
      },
      {
        "id": "alert-rpc", "label": "Alerts: RPC", "group": "grafana",
        "description": "5 Alert-Rules in rpc.yml für RPC-Performance-Überwachung und Sicherheit.",
        "details": [
          "Alert-Definitionen:",
          ["RPCQueueLatencyHigh (Warning): rpcqueuetimeavgtime > 1000 ms for 5m → Handler ausgelastet oder GC-Pause", "RPCProcessingLatencyHigh (Warning): rpcprocessingtimeavgtime > 500 ms for 5m → NN-Verarbeitung langsam", "RPCCallQueueTooLong (Warning): callqueuelength > 100 for 2m → Handler-Threads nicht ausreichend", "RPCAuthFailures (Warning): rate(authorizationfailures[5m]) > 0 for 10m → Berechtigungsprobleme", "RPCDroppedConnections (Warning): rate(droppedconnections[1m]) > 0 for 5m → Netzwerkprobleme"],
          "Korrelationen für Troubleshooting:",
          ["RPCQueueLatencyHigh + GCTimeHigh → GC-Pause blockiert RPC-Handler-Threads", "RPCCallQueueTooLong + hohe Create-Rate → dfs.namenode.handler.count erhöhen", "RPCAuthFailures dauerhaft → Zugriffskontrolle und Netzwerksegmentierung prüfen"]
        ],
        "connections": ["dash-rpc"]
      },
      {
        "id": "alert-jvm", "label": "Alerts: JVM", "group": "grafana",
        "description": "9 Alert-Rules in jvm.yml für JVM-Gesundheit aller Hadoop-Dienste – Heap, GC, Threads und Metaspace.",
        "details": [
          "Heap-Alerts:",
          ["HeapCritical (Critical): memheapusedm / memheapmaxm > 0.90 for 2m → OOM-Risiko", "HeapWarning (Warning): memheapusedm / memheapmaxm > 0.75 for 5m → GC-Frequenz steigt", "HeapCommittedNearMax (Warning): memheapcommittedm / memheapmaxm > 0.95 for 5m → Heap vollständig alloziert"],
          "GC-Alerts:",
          ["GCTimeHigh (Warning): rate(gctimemillis[1m]) / 10000 > 0.30 for 5m → mehr als 30 % CPU-Zeit in GC", "GCFrequencyHigh (Warning): rate(gccount[1m]) > 2 for 5m → mehr als 2 GC-Zyklen pro Minute"],
          "Thread-Alerts:",
          ["BlockedThreads (Warning): threadsblocked > 10 for 5m → Deadlock-Risiko oder Lock-Contention", "ThreadCountHigh (Warning): threadsrunnable + threadsblocked + threadswaiting > 500 for 5m → Thread-Leak", "WaitingThreads (Warning): threadswaiting > 50 for 5m → viele Threads warten auf Locks"],
          "Metaspace-Alert:",
          ["MetaspaceHigh (Warning): memnonheapusedm / memnonheapcommittedm > 0.80 for 5m → Class-Loading-Probleme"],
          "Bei HeapCritical: zuerst GC-Log prüfen (/var/log/hadoop/gc-*.log). Full-GC-Zyklen deuten auf zu kleinen Heap oder Memory-Leak. GCTimeHigh ohne HeapWarning deutet auf häufige Young-Generation-GCs durch hohe Allokationsrate hin."
        ],
        "connections": ["dash-jvm"]
      },
      {
        "id": "alert-journalnode", "label": "Alerts: JournalNode", "group": "grafana",
        "description": "5 Alert-Rules in journalnode.yml für JournalNode-Verfügbarkeit, Quorum-Sicherheit und Sync-Performance – kritisch weil JN-Ausfälle den aktiven NameNode zum Stillstand bringen können.",
        "details": [
          "Alert-Definitionen:",
          ["JournalNodeDown (Critical): up{role=\"journalnode\"} == 0 for 1m → JN nicht mehr scrappbar, Quorum gefährdet", "JournalNodeQuorumAtRisk (Warning): count(up{role=\"journalnode\"} == 1) < 3 for 2m → nur noch 2 von 3 JNs aktiv, kein Ausfall-Puffer", "JournalNodeSyncLatencyHigh (Warning): hadoop_journalnode_journal_syncsavgtime > 500 ms for 5m → langsame JN-Commits blockieren NN-Edit-Log", "JournalNodeBatchesWrittenRateZero (Warning): rate(hadoop_journalnode_journal_batcheswritten[5m]) == 0 for 10m → JN empfängt keine Transaktionen mehr", "JournalNodeHeapHigh (Warning): memheapusedm / memheapmaxm > 0.80 for 5m → JN-Heap-Druck, Heap ist auf 512 MB begrenzt"],
          "Warum JournalNode-Alerts kritisch sind:",
          ["Bei 2 von 3 ausgefallenen JNs kann der aktive NameNode kein Edit-Log mehr schreiben", "Der NameNode stoppt alle Namespace-Operationen (Writes) bis der Quorum wiederhergestellt ist", "Reads (getBlockLocations) funktionieren noch, aber alle Write-Operationen (create, delete, addBlock) scheitern", "JournalNodeQuorumAtRisk ist der Frühwarnindikator – bei diesem Alert sofort reagieren bevor der zweite JN ausfällt"],
          "Korrelationen für Troubleshooting:",
          ["JournalNodeSyncLatencyHigh + RPCQueueLatencyHigh → Edit-Log-Engpass blockiert NameNode-RPC-Handler", "JournalNodeSyncLatencyHigh + GCTimeHigh (JN) → GC-Pausen verzögern JN-fsync-Operationen", "JournalNodeDown + EditLog-Fehler im NN-Log → JN-Container neu starten und hdfs namenode -bootstrapStandby prüfen"],
          "Alert-Routing: JournalNodeDown als Critical mit group_wait=10s, repeat_interval=30m. QuorumAtRisk als Warning mit group_wait=30s. Beide in dieselbe Alertgruppe wie NameNode-Alerts gruppieren da JN-Ausfälle direkt den NameNode betreffen."
        ],
        "connections": ["dash-other", "journalnode", "prom-journalnode-metrics"]
      }
    ],
    "crossConnections": [
      { "from": "namenode",            "to": "prom-namenode-metrics"    },
      { "from": "namenode",            "to": "prom-rpc-metrics"         },
      { "from": "datanode",            "to": "prom-datanode-metrics"    },
      { "from": "resourcemanager",     "to": "prom-yarn-metrics"        },
      { "from": "nodemanager",         "to": "prom-yarn-metrics"        },
      { "from": "prom-namenode-metrics", "to": "dash-namenode-cluster"  },
      { "from": "prom-namenode-metrics", "to": "dash-namenode-metrics"  },
      { "from": "prom-datanode-metrics", "to": "dash-datanode-metrics"  },
      { "from": "prom-datanode-metrics", "to": "dash-other"             },
      { "from": "prom-jvm-metrics",    "to": "dash-jvm"                 },
      { "from": "prom-rpc-metrics",    "to": "dash-rpc"                 },
      { "from": "prom-yarn-metrics",   "to": "dash-yarn"                },
      { "from": "prom-namenode-metrics", "to": "dash-other"             },
      { "from": "alert-namenode",      "to": "prom-namenode-metrics"    },
      { "from": "alert-datanode",      "to": "prom-datanode-metrics"    },
      { "from": "alert-jvm",           "to": "prom-jvm-metrics"         },
      { "from": "alert-rpc",           "to": "prom-rpc-metrics"         },
      { "from": "alert-yarn",          "to": "prom-yarn-metrics"        },
      { "from": "hdfs-namenode-role",  "to": "namenode"                 },
      { "from": "hdfs-datanode-role",  "to": "datanode"                 },
      { "from": "hdfs-ha",             "to": "zookeeper"                },
      { "from": "hdfs-ha",             "to": "journalnode"              },
      { "from": "hdfs-ha",             "to": "zkfc"                     },
      { "from": "hdfs-editlog",        "to": "journalnode"              },
      { "from": "hdfs-fsimage",        "to": "prom-namenode-metrics"    },
      { "from": "hdfs-block",          "to": "prom-datanode-metrics"    },
      { "from": "hdfs-small-files",    "to": "prom-namenode-metrics"    },
      { "from": "hdfs-balancer",       "to": "prom-datanode-metrics"    },
      { "from": "hdfs-snapshots",      "to": "prom-namenode-metrics"    },
      { "from": "distcp",              "to": "prom-yarn-metrics"        },
      { "from": "alert-journalnode",   "to": "prom-journalnode-metrics"  },
      { "from": "journalnode",          "to": "prom-journalnode-metrics"  },
      { "from": "prom-journalnode-metrics", "to": "dash-other"            },
      { "from": "zkfc",                 "to": "prom-jvm-metrics"          },
      { "from": "zkfc",                 "to": "prom-rpc-metrics"          }
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
