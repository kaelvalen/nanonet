package metrics

import (
	"math"
	"sort"
	"time"
)

// Forecast holds a short-horizon prediction for one metric series.
type Forecast struct {
	Series      []ForecastPoint `json:"series"`
	Confidence  float64         `json:"confidence"` // 0–1
	NextValue   *float64        `json:"next_value"`
	NextAlertAt *time.Time      `json:"next_alert_at,omitempty"`
	Threshold   *float64        `json:"threshold,omitempty"`
}

type ForecastPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Lower     float64   `json:"lower"`
	Upper     float64   `json:"upper"`
}

// MetricBounds defines valid ranges for clamping forecast values.
type MetricBounds struct {
	Min float64
	Max float64
}

var metricBounds = map[string]MetricBounds{
	"cpu":        {Min: 0, Max: 100},
	"error_rate": {Min: 0, Max: 100},
	"latency":    {Min: 0, Max: math.MaxFloat64},
	"memory":     {Min: 0, Max: math.MaxFloat64},
}

// HoltLinearForecast builds a damped Holt linear forecast with automatic
// alpha/beta optimisation via walk-forward grid search, outlier removal,
// OLS-initialised trend, and value clamping for bounded metrics.
//
// alpha/beta are initial hints; when <= 0 the function auto-optimises them.
// metricKey is used only for value clamping ("cpu", "error_rate", etc.).
func HoltLinearForecast(times []time.Time, values []float64, horizon int, alpha, beta float64, threshold *float64, metricKey ...string) Forecast {
	if len(values) < 4 || horizon <= 0 {
		return Forecast{Series: []ForecastPoint{}}
	}

	// ── 1. Outlier removal (Winsorise) ─────────────────────────────────────────
	clean := winsorise(values)

	// ── 2. Adaptive alpha/beta via walk-forward grid search ────────────────────
	if alpha <= 0 || beta < 0 {
		alpha, beta = gridSearchHolt(clean)
	} else {
		// Caller supplied hints — still validate & possibly improve
		bestAlpha, bestBeta := gridSearchHolt(clean)
		// Only override if the found params are clearly better
		if mseHolt(clean, int(float64(len(clean))*0.8), bestAlpha, bestBeta) <
			mseHolt(clean, int(float64(len(clean))*0.8), alpha, beta)*0.9 {
			alpha, beta = bestAlpha, bestBeta
		}
	}

	// ── 3. Damping factor (prevents runaway linear extrapolation) ──────────────
	phi := 0.97 // mild dampening; 1.0 = standard Holt, 0.85 = strong

	// ── 4. Fit damped Holt with OLS-initialised trend ──────────────────────────
	level, trend, residuals := fitDampedHolt(clean, alpha, beta, phi)

	// ── 5. Robust confidence interval from residual distribution ───────────────
	rmse, mad := residualStats(residuals)
	// Use MAD-based scale (more robust to outliers) scaled to 95th-percentile.
	// Fall back to RMSE if MAD is near zero.
	bandScale := mad * 1.4826 * 1.96 // MAD → σ → 95% CI
	if bandScale < rmse*0.5 {
		bandScale = rmse * 1.96
	}

	// ── 6. Compute confidence score ────────────────────────────────────────────
	mean := arithmeticMean(clean)
	confidence := 1.0
	if math.Abs(mean) > 1e-6 {
		// MAPE-like: lower relative error → higher confidence
		mape := 0.0
		if len(residuals) > 0 {
			for _, r := range residuals {
				mape += math.Abs(r) / math.Max(math.Abs(mean), 1)
			}
			mape /= float64(len(residuals))
		}
		confidence = 1.0 / (1.0 + mape*2)
	}
	confidence = math.Max(0.1, math.Min(1.0, confidence))

	// ── 7. Metric bounds for clamping ──────────────────────────────────────────
	var bounds *MetricBounds
	if len(metricKey) > 0 {
		if b, ok := metricBounds[metricKey[0]]; ok {
			bounds = &b
		}
	}

	// ── 8. Generate forecast points ────────────────────────────────────────────
	step := medianStep(times)
	if step <= 0 {
		step = time.Minute
	}
	last := times[len(times)-1]

	out := make([]ForecastPoint, 0, horizon)
	var nextAlertAt *time.Time

	dampSum := 0.0
	for k := 1; k <= horizon; k++ {
		dampSum += math.Pow(phi, float64(k))
		v := level + dampSum*trend

		// Widen band with forecast horizon (uncertainty grows over time)
		band := bandScale * math.Sqrt(float64(k))

		// Clamp to valid range
		if bounds != nil {
			v = math.Max(bounds.Min, math.Min(bounds.Max, v))
		}
		lo := v - band
		hi := v + band
		if bounds != nil {
			lo = math.Max(bounds.Min, lo)
			hi = math.Min(bounds.Max, hi)
		}

		ts := last.Add(time.Duration(k) * step)
		out = append(out, ForecastPoint{
			Timestamp: ts,
			Value:     math.Round(v*100) / 100,
			Lower:     math.Round(lo*100) / 100,
			Upper:     math.Round(hi*100) / 100,
		})

		if threshold != nil && nextAlertAt == nil && v >= *threshold {
			t := ts
			nextAlertAt = &t
		}
	}

	var next *float64
	if len(out) > 0 {
		v := out[0].Value
		next = &v
	}

	return Forecast{
		Series:      out,
		Confidence:  math.Round(confidence*100) / 100,
		NextValue:   next,
		NextAlertAt: nextAlertAt,
		Threshold:   threshold,
	}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// winsorise replaces extreme values (outside 1.5×IQR) with the fence value.
// This preserves time-series continuity while reducing outlier influence.
func winsorise(values []float64) []float64 {
	if len(values) < 4 {
		return values
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	n := len(sorted)
	q1 := sorted[n/4]
	q3 := sorted[3*n/4]
	iqr := q3 - q1
	lo := q1 - 1.5*iqr
	hi := q3 + 1.5*iqr

	out := make([]float64, len(values))
	for i, v := range values {
		switch {
		case v < lo:
			out[i] = lo
		case v > hi:
			out[i] = hi
		default:
			out[i] = v
		}
	}
	return out
}

// olsSlope estimates initial trend using ordinary least squares on the first n points.
func olsSlope(values []float64, n int) float64 {
	if n > len(values) {
		n = len(values)
	}
	if n < 2 {
		return 0
	}
	var sumX, sumY, sumXY, sumX2 float64
	for i := 0; i < n; i++ {
		xi := float64(i)
		sumX += xi
		sumY += values[i]
		sumXY += xi * values[i]
		sumX2 += xi * xi
	}
	fn := float64(n)
	denom := fn*sumX2 - sumX*sumX
	if math.Abs(denom) < 1e-10 {
		return 0
	}
	return (fn*sumXY - sumX*sumY) / denom
}

// fitDampedHolt fits the damped Holt model and returns the final level, trend,
// and one-step-ahead residuals for confidence interval estimation.
func fitDampedHolt(values []float64, alpha, beta, phi float64) (level, trend float64, residuals []float64) {
	level = values[0]
	trend = olsSlope(values, clampInt(8, len(values)))

	residuals = make([]float64, 0, len(values)-1)
	for i := 1; i < len(values); i++ {
		predicted := level + phi*trend
		residuals = append(residuals, values[i]-predicted)

		newLevel := alpha*values[i] + (1-alpha)*(level+phi*trend)
		newTrend := beta*(newLevel-level) + (1-beta)*phi*trend
		level = newLevel
		trend = newTrend
	}
	return
}

// mseHolt evaluates Holt's standard (non-damped) MSE on holdout slice [trainN:].
func mseHolt(values []float64, trainN int, alpha, beta float64) float64 {
	if trainN < 2 || trainN >= len(values) {
		return math.MaxFloat64
	}

	level := values[0]
	trend := olsSlope(values, clampInt(5, trainN))

	for i := 1; i < trainN; i++ {
		newLevel := alpha*values[i] + (1-alpha)*(level+trend)
		newTrend := beta*(newLevel-level) + (1-beta)*trend
		level = newLevel
		trend = newTrend
	}

	var sumSq float64
	for i := trainN; i < len(values); i++ {
		h := float64(i-trainN+1)
		pred := level + h*trend
		d := values[i] - pred
		sumSq += d * d
	}
	return sumSq / float64(len(values)-trainN)
}

// gridSearchHolt finds alpha/beta minimising walk-forward MSE on the last 20%.
func gridSearchHolt(values []float64) (bestAlpha, bestBeta float64) {
	bestAlpha, bestBeta = 0.4, 0.1
	if len(values) < 8 {
		return
	}
	trainN := int(float64(len(values)) * 0.8)
	if trainN < 4 {
		trainN = 4
	}

	alphas := []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8}
	betas := []float64{0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4}

	bestMSE := math.MaxFloat64
	for _, a := range alphas {
		for _, b := range betas {
			mse := mseHolt(values, trainN, a, b)
			if mse < bestMSE {
				bestMSE = mse
				bestAlpha = a
				bestBeta = b
			}
		}
	}
	return
}

// residualStats returns the RMSE and MAD of the residual series.
func residualStats(residuals []float64) (rmse, mad float64) {
	if len(residuals) == 0 {
		return 0, 0
	}
	var sumSq float64
	for _, r := range residuals {
		sumSq += r * r
	}
	rmse = math.Sqrt(sumSq / float64(len(residuals)))

	abs := make([]float64, len(residuals))
	for i, r := range residuals {
		abs[i] = math.Abs(r)
	}
	sort.Float64s(abs)
	mad = abs[len(abs)/2]
	return
}

func medianStep(times []time.Time) time.Duration {
	if len(times) < 2 {
		return 0
	}
	steps := make([]time.Duration, 0, len(times)-1)
	for i := 1; i < len(times); i++ {
		if d := times[i].Sub(times[i-1]); d > 0 {
			steps = append(steps, d)
		}
	}
	if len(steps) == 0 {
		return 0
	}
	sort.Slice(steps, func(i, j int) bool { return steps[i] < steps[j] })
	return steps[len(steps)/2]
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

func clampInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
