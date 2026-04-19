package metrics

import (
	"math"
	"time"
)

// Forecast holds a lightweight short-horizon prediction for one metric series,
// produced via Holt's double-exponential smoothing (level + trend).
//
// We deliberately keep this fully in-process and dependency-free: forecasting
// quality is not the goal; the value is in giving the UI a directional
// "where is this trending?" overlay alongside live metrics.
type Forecast struct {
	Series      []ForecastPoint `json:"series"`
	Confidence  float64         `json:"confidence"` // 0–1, based on residual variance
	NextValue   *float64        `json:"next_value"` // 1 step ahead, convenience
	NextAlertAt *time.Time      `json:"next_alert_at,omitempty"`
	Threshold   *float64        `json:"threshold,omitempty"`
}

type ForecastPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Lower     float64   `json:"lower"`
	Upper     float64   `json:"upper"`
}

// HoltLinearForecast builds a Holt linear forecast from a chronological series
// of (timestamp, value) samples. The returned series spans `horizon` future
// points with even spacing equal to the median observed step.
//
// alpha controls level smoothing (0–1), beta controls trend smoothing (0–1).
// Sane defaults: alpha=0.4, beta=0.1.
func HoltLinearForecast(times []time.Time, values []float64, horizon int, alpha, beta float64, threshold *float64) Forecast {
	if len(values) < 4 || horizon <= 0 {
		return Forecast{Series: []ForecastPoint{}}
	}
	if alpha <= 0 || alpha > 1 {
		alpha = 0.4
	}
	if beta < 0 || beta > 1 {
		beta = 0.1
	}

	level := values[0]
	trend := values[1] - values[0]

	// Track residuals to derive a rough confidence interval.
	var residSumSq float64
	residCount := 0

	for i := 1; i < len(values); i++ {
		predicted := level + trend
		residSumSq += (values[i] - predicted) * (values[i] - predicted)
		residCount++

		newLevel := alpha*values[i] + (1-alpha)*(level+trend)
		newTrend := beta*(newLevel-level) + (1-beta)*trend
		level = newLevel
		trend = newTrend
	}

	stdDev := 0.0
	if residCount > 0 {
		stdDev = math.Sqrt(residSumSq / float64(residCount))
	}

	step := medianStep(times)
	if step <= 0 {
		step = time.Minute
	}

	last := times[len(times)-1]
	out := make([]ForecastPoint, 0, horizon)
	var nextAlertAt *time.Time
	for k := 1; k <= horizon; k++ {
		v := level + float64(k)*trend
		// Variance grows ~ k for additive trend; widen the band linearly
		// (close enough for a UI-only signal).
		band := 1.96 * stdDev * math.Sqrt(float64(k))
		ts := last.Add(time.Duration(k) * step)
		out = append(out, ForecastPoint{
			Timestamp: ts,
			Value:     v,
			Lower:     v - band,
			Upper:     v + band,
		})
		if threshold != nil && nextAlertAt == nil && v >= *threshold {
			t := ts
			nextAlertAt = &t
		}
	}

	// Confidence ≈ 1 / (1 + relative std dev). 1.0 → very stable.
	mean := arithmeticMean(values)
	confidence := 1.0
	if mean != 0 {
		rel := stdDev / math.Max(math.Abs(mean), 1e-6)
		confidence = 1.0 / (1.0 + rel)
	}

	var next *float64
	if len(out) > 0 {
		v := out[0].Value
		next = &v
	}

	return Forecast{
		Series:      out,
		Confidence:  confidence,
		NextValue:   next,
		NextAlertAt: nextAlertAt,
		Threshold:   threshold,
	}
}

func medianStep(times []time.Time) time.Duration {
	if len(times) < 2 {
		return 0
	}
	steps := make([]time.Duration, 0, len(times)-1)
	for i := 1; i < len(times); i++ {
		d := times[i].Sub(times[i-1])
		if d > 0 {
			steps = append(steps, d)
		}
	}
	if len(steps) == 0 {
		return 0
	}
	// Quick selection-style median: O(n log n) sort is fine for typical n<2000.
	sortDurations(steps)
	return steps[len(steps)/2]
}

func sortDurations(s []time.Duration) {
	// insertion sort — n is tiny in practice
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j-1] > s[j]; j-- {
			s[j-1], s[j] = s[j], s[j-1]
		}
	}
}

func arithmeticMean(v []float64) float64 {
	if len(v) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range v {
		sum += x
	}
	return sum / float64(len(v))
}
