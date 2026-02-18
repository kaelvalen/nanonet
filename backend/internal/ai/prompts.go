package ai

const AnalysisPromptTemplate = `Sen deneyimli bir DevOps ve SRE uzmanısın. Aşağıdaki mikroservis metriklerini analiz et.

## Servis Bilgisi
- Servis Adı: %s
- Host: %s:%d
- Health Endpoint: %s

## Son %d Dakikanın Metrikleri
%s

## Diğer Servislerin Durumu (cross-servis korelasyon için)
%s

## Görev
1. Metriklerdeki anomalileri tespit et
2. Olası kök nedeni belirle
3. Somut ve uygulanabilir aksiyonlar öner

Yanıtın SADECE saf JSON olmalı. Markdown, kod bloğu veya ekstra metin KULLANMA.
İlk karakter { olmalı, son karakter } olmalı. Örnek format:
{"summary":"...","root_cause":"...","recommendations":[{"action":"...","priority":"high"}],"confidence":0.85}`

const DefaultModel = "claude-3-5-sonnet-20241022"
const MaxTokensDefault = 4096
