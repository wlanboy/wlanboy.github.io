## Helm Chart for website

Helm Chart to deploy the static website within a Kubernetes cluster.

### Architecture

The chart creates the following components:

- **Init Container** (`alpine/git`): Clones the configured Git repository into a shared PersistentVolumeClaim at pod startup. Supports a specific branch/ref and an optional sub-path within the repo.
- **Nginx Container** (`nginx:alpine`): Serves the static site content from the PVC. Includes a readiness probe on port 80.
- **PersistentVolumeClaim**: Shared volume between init container and nginx for the cloned site files.
- **ClusterIP Service**: Internal service exposing nginx on port 80.
- **Istio Gateway**: Exposes the site externally on port 80 (HTTP) and optionally port 443 (HTTPS). Created in the `istio-ingress` namespace.
- **Istio VirtualService**: Routes incoming traffic from the Gateway to the nginx service.
- **cert-manager Certificate** (optional): Requests a TLS certificate from the configured ClusterIssuer and stores it in a Kubernetes Secret, which the Gateway references.

### Prerequisites

- Kubernetes cluster with Helm 3
- Istio installed with an `ingressgateway` running in the `istio-ingress` namespace
- cert-manager installed (only required for TLS variant)
- A `ClusterIssuer` named `local-ca-issuer` (only required for TLS variant)

### Installation

**With cert-manager and TLS** (recommended for production):

```bash
helm install wlanboy . -n website --create-namespace -f values.yaml
```

**Without TLS** (simple setup for local/dev clusters):

```bash
helm install wlanboy . -n website --create-namespace -f values-simple.yaml
```

### Configuration

Key values in `values.yaml`:

| Key | Default | Description |
|-----|---------|-------------|
| `site.repoUrl` | `https://github.com/wlanboy/wlanboy.github.io.git` | Git repository to clone |
| `site.ref` | `main` | Branch, tag, or commit SHA to check out |
| `site.subPath` | `""` | Sub-directory within the repo to serve (empty = root) |
| `istio.hosts` | `["wlanboy.tp.lan", "wlanboy.gmk.lan"]` | Hostnames for Gateway and VirtualService |
| `istio.tls.enabled` | `true` | Enable HTTPS on port 443 |
| `istio.tls.secretName` | `wlanboy-tls` | Name of the TLS Secret the Gateway uses |
| `certManager.issuerRef.name` | `local-ca-issuer` | ClusterIssuer to request the certificate from |
| `pvc.size` | `10Mi` | Size of the PVC for the site content |
| `replicaCount` | `1` | Number of nginx replicas |

### Upgrading

After changing values or templates, upgrade the release in-place:

```bash
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
kubectl get gateway,virtualservice -n website
```

Inspect the init container logs to confirm the Git clone succeeded:

```bash
kubectl logs -n website -l app=wlanboy-site -c git-populate
```

### Uninstalling

```bash
helm uninstall wlanboy -n website
```

This removes the Deployment, Service, VirtualService, and Gateway. The PVC and the TLS Secret are **not** deleted automatically — remove them manually if no longer needed:

```bash
kubectl delete pvc wlanboy-site-pvc -n website
kubectl delete secret wlanboy-tls -n istio-ingress
```
