{{- define "wlanboy-site.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Selector-Labels für Deployment und Service. Das Instance-Label trennt mehrere Releases im selben Namespace.
*/}}
{{- define "wlanboy-site.selectorLabels" -}}
app: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
