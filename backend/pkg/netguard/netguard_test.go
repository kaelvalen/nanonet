package netguard

import (
	"context"
	"testing"
	"time"
)

func TestValidateOutboundURL_BlocksLoopbackEvenWhenAllowPrivate(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := ValidateOutboundURL(ctx, "http://127.0.0.1/", Options{AllowPrivate: true}); err == nil {
		t.Fatalf("expected loopback to be rejected")
	}
}

func TestValidateOutboundURL_BlocksCloudMetadataAlways(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := ValidateOutboundURL(ctx, "http://169.254.169.254/latest/meta-data", Options{AllowPrivate: true}); err == nil {
		t.Fatalf("expected metadata IP to be rejected")
	}
}

func TestValidateOutboundURL_AllowsPublicIP(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := ValidateOutboundURL(ctx, "http://1.1.1.1/", Options{AllowPrivate: false}); err != nil {
		t.Fatalf("expected public IP to be allowed, got: %v", err)
	}
}

func TestValidateProbeTarget_TCPPrivateIPBlockedWhenDisallowed(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := ValidateProbeTarget(ctx, "tcp", "10.0.0.1:80", Options{AllowPrivate: false}); err == nil {
		t.Fatalf("expected private IP to be rejected")
	}
}

func TestValidateProbeTarget_TCPPrivateIPAllowedWhenEnabled(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	if err := ValidateProbeTarget(ctx, "tcp", "10.0.0.1:80", Options{AllowPrivate: true}); err != nil {
		t.Fatalf("expected private IP to be allowed, got: %v", err)
	}
}
