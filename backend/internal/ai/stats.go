package ai

import (
	"math"
	"sort"

	"nanonet-backend/internal/metrics"
)

// buildSummaryFromDB DB'den gelen StatsSummary + küçük zaman serisini birleştirir.
// Ağır istatistikler (mean, stddev, P95) DB'den gelir; trend ve spike Go'da hesaplanır.
func buildSummaryFromDB(db *metrics.StatsSummary, recent []metrics.Metric, windowMinutes int) MetricsSummary {
	s := MetricsSummary{
		SampleCount:   int(db.SampleCount),
		WindowMin:     windowMinutes,
		DownCount:     int(db.DownCount),
		DegradedCount: int(db.DegradedCount),
	}

	deref := func(p *float64) float64 {
		if p == nil {
			return 0
		}
		return *p
	}

	s.CPUMean = deref(db.CPUMean)
	s.CPUMin = deref(db.CPUMin)
	s.CPUMax = deref(db.CPUMax)
	s.MemMean = deref(db.MemMean)
	s.MemMin = deref(db.MemMin)
	s.MemMax = deref(db.MemMax)
	s.LatencyMean = deref(db.LatencyMean)
	s.LatencyMin = deref(db.LatencyMin)
	s.LatencyMax = deref(db.LatencyMax)
	s.LatencyP95 = deref(db.LatencyP95)
	s.ErrorRateMean = deref(db.ErrorRateMean)

	// Stddev: DB sorgusu STDDEV_POP içermiyor; recent slice'dan hesapla
	latVals := make([]float64, 0, len(recent))
	cpuVals := make([]float64, 0, len(recent))
	memVals := make([]float64, 0, len(recent))
	for _, m := range recent {
		if m.LatencyMS != nil {
			latVals = append(latVals, float64(*m.LatencyMS))
		}
		if m.CPUPercent != nil {
			cpuVals = append(cpuVals, float64(*m.CPUPercent))
		}
		if m.MemoryUsedMB != nil {
			memVals = append(memVals, float64(*m.MemoryUsedMB))
		}
	}
	_, s.LatencyStddev, _, _ = basicStats(latVals)
	_, s.CPUStddev, _, _ = basicStats(cpuVals)
	_, s.MemStddev, _, _ = basicStats(memVals)

	// Spike count: P95 üstündeki nokta sayısı (DB'den gelen P95 ile)
	if s.LatencyP95 > 0 {
		for _, v := range latVals {
			if v > s.LatencyP95 {
				s.SpikeCount++
			}
		}
	}

	// Trend: son 10 vs ilk 10 nokta (recent slice zaten küçük)
	s.TrendDirection, s.TrendDelta = latencyTrend(latVals)

	return s
}

// summarizeMetrics ham time series'i istatistiksel özete dönüştürür.
// 500 nokta yerine ~20 alan gönderilir; token kullanımı ~10x azalır.
func summarizeMetrics(data []metrics.Metric, windowMinutes int) MetricsSummary {
	n := len(data)
	s := MetricsSummary{
		SampleCount: n,
		WindowMin:   windowMinutes,
	}
	if n == 0 {
		return s
	}

	// Pointer alanları için güvenli slice'lar
	cpuVals := make([]float64, 0, n)
	memVals := make([]float64, 0, n)
	latVals := make([]float64, 0, n)
	errVals := make([]float64, 0, n)

	latencyP95Scratch := make([]float64, 0, n)

	for _, m := range data {
		switch m.Status {
		case "down":
			s.DownCount++
		case "degraded":
			s.DegradedCount++
		}

		if m.CPUPercent != nil {
			cpuVals = append(cpuVals, float64(*m.CPUPercent))
		}
		if m.MemoryUsedMB != nil {
			memVals = append(memVals, float64(*m.MemoryUsedMB))
		}
		if m.LatencyMS != nil {
			v := float64(*m.LatencyMS)
			latVals = append(latVals, v)
			latencyP95Scratch = append(latencyP95Scratch, v)
		}
		if m.ErrorRate != nil {
			errVals = append(errVals, float64(*m.ErrorRate))
		}
	}

	s.CPUMean, s.CPUStddev, s.CPUMin, s.CPUMax = basicStats(cpuVals)
	s.MemMean, s.MemStddev, s.MemMin, s.MemMax = basicStats(memVals)
	s.LatencyMean, s.LatencyStddev, s.LatencyMin, s.LatencyMax = basicStats(latVals)

	// P95 latency
	if len(latencyP95Scratch) > 0 {
		sort.Float64s(latencyP95Scratch)
		idx := int(math.Ceil(0.95*float64(len(latencyP95Scratch)))) - 1
		if idx < 0 {
			idx = 0
		}
		s.LatencyP95 = latencyP95Scratch[idx]
	}

	// Ortalama error rate
	if len(errVals) > 0 {
		var sum float64
		for _, v := range errVals {
			sum += v
		}
		s.ErrorRateMean = sum / float64(len(errVals))
	}

	// Spike count: P95 üstündeki nokta sayısı.
	// mean+2σ yerine P95 kullanılır; mikroservis latency dağılımı sağa çarpık
	// olduğundan σ-tabanlı threshold false positive/negative üretebilir.
	if s.LatencyP95 > 0 {
		for _, v := range latVals {
			if v > s.LatencyP95 {
				s.SpikeCount++
			}
		}
	}

	// Trend: son 10 nokta vs ilk 10 nokta latency ortalaması
	s.TrendDirection, s.TrendDelta = latencyTrend(latVals)

	return s
}

func basicStats(vals []float64) (mean, stddev, min, max float64) {
	if len(vals) == 0 {
		return
	}
	min = vals[0]
	max = vals[0]
	var sum float64
	for _, v := range vals {
		sum += v
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	mean = sum / float64(len(vals))

	var varianceSum float64
	for _, v := range vals {
		diff := v - mean
		varianceSum += diff * diff
	}
	stddev = math.Sqrt(varianceSum / float64(len(vals)))
	return
}

func latencyTrend(latVals []float64) (direction string, delta float64) {
	n := len(latVals)
	if n < 10 {
		return "insufficient_data", 0
	}

	window := 10
	if n < 20 {
		window = n / 2
	}

	var firstSum, lastSum float64
	for i := 0; i < window; i++ {
		firstSum += latVals[i]
	}
	for i := n - window; i < n; i++ {
		lastSum += latVals[i]
	}

	firstAvg := firstSum / float64(window)
	lastAvg := lastSum / float64(window)
	delta = lastAvg - firstAvg

	switch {
	case delta > 10:
		direction = "degrading"
	case delta < -10:
		direction = "improving"
	default:
		direction = "stable"
	}
	return
}
