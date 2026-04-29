package netguard

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

type Options struct {
	AllowPrivate bool
}

// ValidateOutboundURL validates a user-controlled outbound URL to reduce SSRF risk.
// It is intended for webhook-style HTTP clients.
func ValidateOutboundURL(ctx context.Context, raw string, opt Options) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("invalid url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("scheme must be http or https")
	}
	if u.User != nil {
		return errors.New("userinfo not allowed in url")
	}
	host := strings.TrimSpace(u.Hostname())
	if host == "" {
		return errors.New("missing host")
	}
	if isObviouslyLocalHost(host) {
		return errors.New("local hostnames are not allowed")
	}

	if ip, err := netip.ParseAddr(host); err == nil {
		return validateIP(ip, opt)
	}
	return validateResolvedHost(ctx, host, opt)
}

// ValidateProbeTarget validates probe targets.
// - kind "http": expects a URL.
// - kind "tcp": expects "host:port".
func ValidateProbeTarget(ctx context.Context, kind, target string, opt Options) error {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "tcp":
		host, port, err := net.SplitHostPort(strings.TrimSpace(target))
		if err != nil {
			return errors.New("tcp target must be host:port")
		}
		if port == "" {
			return errors.New("tcp target missing port")
		}
		host = strings.TrimSpace(host)
		if host == "" {
			return errors.New("tcp target missing host")
		}
		if isObviouslyLocalHost(host) {
			return errors.New("local hostnames are not allowed")
		}
		if ip, err := netip.ParseAddr(host); err == nil {
			return validateIP(ip, opt)
		}
		return validateResolvedHost(ctx, host, opt)
	default:
		return ValidateOutboundURL(ctx, target, opt)
	}
}

func validateResolvedHost(parent context.Context, host string, opt Options) error {
	ctx, cancel := context.WithTimeout(parent, 2*time.Second)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("dns lookup failed: %w", err)
	}
	if len(addrs) == 0 {
		return errors.New("dns lookup returned no addresses")
	}
	for _, a := range addrs {
		ip, ok := netip.AddrFromSlice(a.IP)
		if !ok {
			continue
		}
		ip = ip.Unmap()
		if err := validateIP(ip, opt); err != nil {
			return err
		}
	}
	return nil
}

func validateIP(ip netip.Addr, opt Options) error {
	ip = ip.Unmap()
	if !ip.IsValid() {
		return errors.New("invalid ip")
	}

	// Always block clearly unsafe ranges, even if AllowPrivate=true.
	if ip.IsLoopback() || ip.IsMulticast() || ip.IsUnspecified() {
		return errors.New("loopback/multicast/unspecified ip not allowed")
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return errors.New("link-local ip not allowed")
	}

	// Block cloud metadata IP explicitly.
	if ip.Is4() {
		if ip.String() == "169.254.169.254" {
			return errors.New("cloud metadata ip not allowed")
		}
	}

	if opt.AllowPrivate {
		return nil
	}

	if isPrivateOrReserved(ip) {
		return errors.New("private/reserved ip not allowed")
	}
	return nil
}

func isPrivateOrReserved(ip netip.Addr) bool {
	if ip.IsPrivate() {
		return true
	}
	// Unique local (IPv6 fc00::/7) is considered private by IsPrivate.
	// Add additional special ranges we want to treat as reserved.
	if ip.Is6() && ip.IsLinkLocalUnicast() {
		return true
	}
	// Carrier-grade NAT 100.64.0.0/10
	if ip.Is4() {
		if pfx, _ := netip.ParsePrefix("100.64.0.0/10"); pfx.Contains(ip) {
			return true
		}
	}
	return false
}

func isObviouslyLocalHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	if h == "localhost" || strings.HasSuffix(h, ".localhost") {
		return true
	}
	if h == "host.docker.internal" {
		return true
	}
	return false
}
