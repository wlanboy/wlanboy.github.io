```bash
# with certmanager and tls
helm install wlanboy . -n website --create-namespace -f values.yaml
# without ssl
helm install wlanboy . -n website --create-namespace -f values-simple.yaml
```

```bash
kubectl get secret wlanboy-tls -n istio-ingress
kubectl get gateway,virtualservice -n website
```

```bash
helm upgrade wlanboy . -n website
helm status wlanboy -n website --show-resources
```

```bash
helm uninstall wlanboy -n website
```
