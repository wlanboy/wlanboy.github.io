## Helm Chart for website

Helm Chart to deploy the static website within a Kubernetes cluster.

### Architecture

The chart creates the following components:

- **Init Container** (`buildpack-deps:trixie-scm`, Debian with git): Clones the configured Git repository into the shared content volume at pod startup. Supports a branch via `site.ref` and an optional sub-path within the repo. Repo URL, ref and sub-path reach the script as environment variables, so the shell does not interpret them. The script deletes the `.git` directory, so nginx never serves it.
- **Nginx Container** (`nginxinc/nginx-unprivileged`, Debian): Serves the site content from the shared volume. Runs as UID 101 with a read-only root filesystem, no capabilities and RuntimeDefault seccomp, listens on port 8080. Has a readiness and a liveness probe.
- **Content volume**: An `emptyDir` (default, limited by `contentSizeLimit`). Since the init container clones the repo on every pod start, nothing needs to persist. Alternatively a PersistentVolumeClaim (`pvc.enabled: true`).
- **ClusterIP Service**: Internal service on port 80, forwarding to nginx on port 8080.
- **Istio Gateway** (`networking.istio.io/v1`): Exposes the site on port 80 (HTTP) and optionally port 443 (HTTPS). Created in the `istio-ingress` namespace.
- **Istio VirtualService** (`networking.istio.io/v1`): Routes traffic from the Gateway and from inside the mesh to the nginx service.
- **cert-manager Certificate** (optional): Requests a TLS certificate from the configured ClusterIssuer and stores it in a Secret in the gateway namespace, which the Gateway references.

The pod does not mount a ServiceAccount token, as it never talks to the Kubernetes API. Deployment and Service select pods by `app` and `app.kubernetes.io/instance`, so several releases can share a namespace. The Service name (`service.name`) and the PVC name (`pvc.name`) are fixed values, though, and have to be changed per release.

### Prerequisites

- Kubernetes cluster with Helm 3
- Istio with the `networking.istio.io/v1` API (Istio 1.22 or newer) and an `ingressgateway` running in the `istio-ingress` namespace
- cert-manager installed (only required for TLS variant)
- A `ClusterIssuer` named `local-ca-issuer` (only required for TLS variant)

### Installation

**With cert-manager and TLS** (recommended for production):

```bash
helm install wlanboy . -n website --create-namespace -f values.yaml
```

**Without TLS** (simple setup for local/dev clusters, host `wlanboy.kube.lan`, content on a PVC):

```bash
helm install wlanboy . -n website --create-namespace -f values-simple.yaml
```

Helm always loads `values.yaml` first and merges `values-simple.yaml` on top. Keys missing from `values-simple.yaml` therefore take their value from `values.yaml`.

### Configuration

Key values in `values.yaml`:

| Key | Default | Description |
|-----|---------|-------------|
| `image.repository` / `image.tag` | `nginxinc/nginx-unprivileged` / `1.30-trixie` | nginx image (stable branch, Debian) |
| `gitImage.repository` / `gitImage.tag` | `buildpack-deps` / `trixie-scm` | Image for the git init container |
| `site.repoUrl` | `https://github.com/wlanboy/wlanboy.github.io.git` | Git repository to clone |
| `site.ref` | `main` | Ref to check out after cloning. The clone is shallow (`--depth 1`) and contains only the default branch, so other branches, tags or commit SHAs fail |
| `site.subPath` | `""` | Sub-directory within the repo to serve (empty = root) |
| `contentSizeLimit` | `32Mi` | Size limit of the `emptyDir` for the site content |
| `pvc.enabled` | `false` | Use a PersistentVolumeClaim instead of the `emptyDir` |
| `pvc.size` | `10Mi` | Size of the PVC (only with `pvc.enabled: true`) |
| `resources` | 10m CPU, 32Mi/64Mi memory | Requests and limits for nginx, no CPU limit |
| `gitResources` | 10m CPU, 32Mi/128Mi memory | Requests and limits for the init container |
| `istio.hosts` | `["wlanboy.tp.lan", "wlanboy.gmk.lan"]` | Hostnames for Gateway and VirtualService |
| `istio.tls.enabled` | `true` | Enable HTTPS on port 443 |
| `istio.tls.secretName` | `wlanboy-tls` | Name of the TLS Secret the Gateway uses |
| `certManager.issuerRef.name` | `local-ca-issuer` | ClusterIssuer to request the certificate from |
| `replicaCount` | `1` | Number of nginx replicas |

With `pvc.enabled: true` and `ReadWriteOnce`, the PVC ties the pod to one node. Rolling updates onto another node and `replicaCount` > 1 then fail.

### Upgrading

After changing values or templates, upgrade the release in-place:

```bash
helm upgrade wlanboy . -n website
```

Releases installed before the `app.kubernetes.io/instance` label was added need a one-time deletion of the Deployment, because Kubernetes does not allow changing the selector of an existing Deployment:

```bash
kubectl delete deployment wlanboy-wlanboy-site -n website
helm upgrade wlanboy . -n website
```

Check the rollout status and all managed resources:

```bash
helm status wlanboy -n website --show-resources
```

### Verification

Check that the TLS Secret was created by cert-manager:

```bash
kubectl get secret wlanboy-tls -n istio-ingress
```

Verify that the Istio Gateway and VirtualService are present and configured correctly:

```bash
kubectl get gateway -n istio-ingress
kubectl get virtualservice -n website
```

Inspect the init container logs to confirm the Git clone succeeded:

```bash
kubectl logs -n website -l app=wlanboy-site -c git-populate
```

### Uninstalling

```bash
helm uninstall wlanboy -n website
```

This removes the Deployment, Service, VirtualService, Gateway, Certificate and, if enabled, the PVC. The TLS Secret is **not** deleted automatically, because cert-manager creates it and Helm does not track it. Remove it manually if no longer needed:

```bash
kubectl delete secret wlanboy-tls -n istio-ingress
```
