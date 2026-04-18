// Outbound TCP dependency discovery.
//
// On Linux we read /proc/net/tcp[6] directly so we don't have to shell out
// to `ss` (which may not be present in slim containers). For each row in
// state ESTABLISHED whose local port is an ephemeral one (≥ 32768 by default)
// we emit a (target_host, target_port, "tcp") observation. Same-host loopback
// destinations are filtered to keep the noise down.
//
// This intentionally lives behind a feature gate (`linux` cfg) — on macOS or
// other targets it's a no-op stub returning an empty list.

use serde::Serialize;
use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

#[derive(Debug, Clone, Serialize)]
pub struct DependencyObservation {
    pub target_host: String,
    pub target_port: u16,
    pub protocol: String,
    pub process_name: Option<String>,
}

#[cfg(target_os = "linux")]
pub fn discover() -> Vec<DependencyObservation> {
    let mut out: Vec<DependencyObservation> = Vec::new();
    let mut seen: HashSet<(String, u16)> = HashSet::new();

    if let Ok(rows) = scan_proc("/proc/net/tcp", false) {
        for r in rows {
            if seen.insert((r.target_host.clone(), r.target_port)) {
                out.push(r);
            }
        }
    }
    if let Ok(rows) = scan_proc("/proc/net/tcp6", true) {
        for r in rows {
            if seen.insert((r.target_host.clone(), r.target_port)) {
                out.push(r);
            }
        }
    }
    out
}

#[cfg(not(target_os = "linux"))]
pub fn discover() -> Vec<DependencyObservation> {
    Vec::new()
}

#[cfg(target_os = "linux")]
fn scan_proc(path: &str, ipv6: bool) -> std::io::Result<Vec<DependencyObservation>> {
    use std::fs;
    let body = fs::read_to_string(path)?;
    let mut rows: Vec<DependencyObservation> = Vec::new();

    // Header on first line; data lines begin with a numeric sl column.
    for line in body.lines().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        // Required columns: sl(0) local(1) remote(2) state(3)
        if cols.len() < 4 {
            continue;
        }
        // 01 = ESTABLISHED — anything else is irrelevant for dependency mapping.
        if cols[3] != "01" {
            continue;
        }
        let local_port = match parse_port(cols[1]) {
            Some(p) => p,
            None => continue,
        };
        // Heuristic: caller uses an ephemeral local port (≥1024). This drops
        // rows where *we* are the listener for inbound connections.
        if local_port < 1024 {
            continue;
        }
        let (rem_ip, rem_port) = match parse_endpoint(cols[2], ipv6) {
            Some(v) => v,
            None => continue,
        };
        if rem_port == 0 || is_uninteresting(&rem_ip) {
            continue;
        }
        rows.push(DependencyObservation {
            target_host: rem_ip.to_string(),
            target_port: rem_port,
            protocol: "tcp".into(),
            process_name: None,
        });
    }
    Ok(rows)
}

#[cfg(target_os = "linux")]
fn parse_port(hex: &str) -> Option<u16> {
    let parts: Vec<&str> = hex.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    u16::from_str_radix(parts[1], 16).ok()
}

#[cfg(target_os = "linux")]
fn parse_endpoint(hex: &str, ipv6: bool) -> Option<(IpAddr, u16)> {
    let parts: Vec<&str> = hex.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let port = u16::from_str_radix(parts[1], 16).ok()?;
    let ip = if ipv6 {
        parse_hex_ipv6(parts[0])?
    } else {
        parse_hex_ipv4(parts[0])?
    };
    Some((ip, port))
}

// /proc/net/tcp encodes IPv4 little-endian: "0100007F" → 127.0.0.1
#[cfg(target_os = "linux")]
fn parse_hex_ipv4(hex: &str) -> Option<IpAddr> {
    if hex.len() != 8 {
        return None;
    }
    let n = u32::from_str_radix(hex, 16).ok()?;
    let bytes = n.to_le_bytes();
    Some(IpAddr::V4(Ipv4Addr::new(
        bytes[0], bytes[1], bytes[2], bytes[3],
    )))
}

// /proc/net/tcp6 encodes IPv6 as 32 hex chars in a host-endian byte order
// per 4-byte chunk. Reverse each 4-byte group, then build the address.
#[cfg(target_os = "linux")]
fn parse_hex_ipv6(hex: &str) -> Option<IpAddr> {
    if hex.len() != 32 {
        return None;
    }
    let mut bytes = [0u8; 16];
    for chunk in 0..4 {
        let off = chunk * 8;
        let word = u32::from_str_radix(&hex[off..off + 8], 16).ok()?;
        let le = word.to_le_bytes();
        let dst = chunk * 4;
        bytes[dst..dst + 4].copy_from_slice(&le);
    }
    let v6 = Ipv6Addr::from(bytes);
    // IPv4-mapped (::ffff:a.b.c.d) → return the v4 form.
    if let Some(v4) = v6.to_ipv4_mapped() {
        return Some(IpAddr::V4(v4));
    }
    Some(IpAddr::V6(v6))
}

#[cfg(target_os = "linux")]
fn is_uninteresting(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => v.is_loopback() || v.is_unspecified(),
        IpAddr::V6(v) => v.is_loopback() || v.is_unspecified(),
    }
}
