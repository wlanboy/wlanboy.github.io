(function () {
  const GROUP_HUES = {
    "hdfs":   195,
    "hadoop":  38,
  };

  // Per-group force-simulation tuning.
  // hdfs: dense core of 5 highly connected nodes → shorter springs + more repulsion so labels breathe.
  const GROUP_OPTS = {
    "hdfs":   { repel: 18000, springL: 160, spring: 0.008, gravity: 0.002, iters: 480 },
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
      { "id": "hdfs",   "label": "HDFS Konzepte",  "color": "#0891b2" },
      { "id": "hadoop", "label": "Hadoop Cluster", "color": "#d97706" }
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
          ["Nach dem Hinzufügen neuer DataNodes (neue DNs sind initial leer)", "Nach sehr ungleichmäßigen Bulk-Schreibvorgängen", "Wenn DataNode-Disk-Auslastung stark voneinander abweicht", "Im Wartungsfenster starten – der Balancer erzeugt erheblichen Netzwerkdurchsatz"],
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
      }
    ],
    "crossConnections": [
      { "from": "hdfs-namenode-role", "to": "namenode"    },
      { "from": "hdfs-datanode-role", "to": "datanode"    },
      { "from": "hdfs-ha",            "to": "zookeeper"   },
      { "from": "hdfs-ha",            "to": "journalnode" },
      { "from": "hdfs-ha",            "to": "zkfc"        },
      { "from": "hdfs-editlog",       "to": "journalnode" }
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
