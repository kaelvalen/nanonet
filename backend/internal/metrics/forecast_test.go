package metrics

import (
	"math"
	"testing"
	"time"
)

func TestHoltLinearForecastReturnsEmptyOnShortInput(t *testing.T) {
	now := time.Now()
	times := []time.Time{now, now.Add(time.Minute)}
	values := []float64{10, 11}

	f := HoltLinearForecast(times, values, 5, 0.4, 0.1, nil)
	if len(f.Series) != 0 {
		t.Fatalf("expected empty series for n<4, got %d points", len(f.Series))
	}
}

func TestHoltLinearForecastDetectsTrend(t *testing.T) {
	// Noisy upward ramp so residual variance is non-zero and the band widens.
	now := time.Now()
	n := 20
	times := make([]time.Time, n)
	values := make([]float64, n)
	for i := 0; i < n; i++ {
		times[i] = now.Add(time.Duration(i) * time.Minute)
		noise := 0.0
		if i%2 == 0 {
			noise = 0.5
		} else {
			noise = -0.5
		}
		values[i] = 10 + 2*float64(i) + noise
	}

	f := HoltLinearForecast(times, values, 6, 0.5, 0.2, nil)
	if len(f.Series) != 6 {
		t.Fatalf("expected 6 forecast points, got %d", len(f.Series))
	}
	if f.Series[0].Value <= values[n-1] {
		t.Errorf("forecast did not extrapolate upward trend: first=%.2f last_obs=%.2f", f.Series[0].Value, values[n-1])
	}
	if f.Series[5].Value <= f.Series[0].Value {
		t.Errorf("forecast did not continue increasing: %.2f → %.2f", f.Series[0].Value, f.Series[5].Value)
	}
	band0 := f.Series[0].Upper - f.Series[0].Lower
	band5 := f.Series[5].Upper - f.Series[5].Lower
	if band5 <= band0 {
		t.Errorf("confidence band did not widen: %.2f → %.2f", band0, band5)
	}
}

func TestHoltLinearForecastNextAlertAt(t *testing.T) {
	now := time.Now()
	n := 12
	times := make([]time.Time, n)
	values := make([]float64, n)
	for i := 0; i < n; i++ {
		times[i] = now.Add(time.Duration(i) * time.Minute)
		values[i] = 70 + float64(i) // climbs from 70 → 81
	}
	threshold := 90.0
	f := HoltLinearForecast(times, values, 24, 0.5, 0.2, &threshold)
	if f.NextAlertAt == nil {
		t.Fatal("expected NextAlertAt to be set when forecast crosses threshold")
	}
	if f.NextAlertAt.Before(now) {
		t.Errorf("NextAlertAt should be in the future, got %v", f.NextAlertAt)
	}
}

func TestHoltLinearForecastConfidenceBounded(t *testing.T) {
	now := time.Now()
	n := 10
	times := make([]time.Time, n)
	values := make([]float64, n)
	for i := 0; i < n; i++ {
		times[i] = now.Add(time.Duration(i) * time.Minute)
		values[i] = 50 // perfectly flat → max confidence
	}
	f := HoltLinearForecast(times, values, 3, 0.4, 0.1, nil)
	if f.Confidence < 0 || f.Confidence > 1.0001 {
		t.Errorf("confidence out of [0,1]: %v", f.Confidence)
	}
	if math.Abs(f.Confidence-1.0) > 0.01 {
		t.Errorf("expected near-1 confidence on flat series, got %.3f", f.Confidence)
	}
}
