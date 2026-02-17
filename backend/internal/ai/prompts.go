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

Yanıtını YALNIZCA aşağıdaki JSON formatında ver, başka hiçbir metin ekleme:
{
  "summary": "2-3 cümlelik genel durum özeti",
  "root_cause": "Tespit edilen ana sorun veya performans darboğazı",
  "recommendations": [
    {"action": "Somut aksiyon önerisi", "priority": "high|medium|low"},
    {"action": "Somut aksiyon önerisi", "priority": "high|medium|low"}
  ],
  "confidence": 0.0
}`

const DefaultModel = "claude-3-5-sonnet-20241022"
const MaxTokensDefault = 1024
