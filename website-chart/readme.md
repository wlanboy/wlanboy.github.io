```bash
helm install wlanboy . -n website --create-namespace
```

```bash
kubectl get secret wlanboy-tls -n istio-ingress
kubectl get gateway,virtualservice -n website
```

```bash
helm upgrade wlanboy . -n website 
```

```bash
helm uninstall wlanboy -n website
```
