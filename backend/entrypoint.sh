#!/bin/sh
# Kubeconfig'i /tmp'ye kopyala ve server adresini kind network IPv4 IP'siyle değiştir
if [ -f "/root/.kube/config" ]; then
    cp /root/.kube/config /tmp/kubeconfig

    # getent hosts -> ilk sonuç IPv6 olabilir; IPv4 için -4 flag kullanan nslookup dene
    CONTROL_PLANE_IP=$(getent ahostsv4 nanonet-control-plane 2>/dev/null | awk 'NR==1{print $1}')
    if [ -z "$CONTROL_PLANE_IP" ]; then
        # fallback: tüm adreslerden IPv4 olanı seç
        CONTROL_PLANE_IP=$(getent hosts nanonet-control-plane 2>/dev/null | awk '{print $1}' | grep -v ':' | head -1)
    fi
    if [ -z "$CONTROL_PLANE_IP" ]; then
        # son fallback: docker network'ten doğrudan al (kind network 172.x)
        CONTROL_PLANE_IP=$(getent hosts nanonet-control-plane 2>/dev/null | awk '{print $1}' | head -1)
    fi

    if [ -n "$CONTROL_PLANE_IP" ]; then
        # Mevcut server adresini (127.0.0.1 veya IPv6) IPv4 ile değiştir
        sed -i "s|https://127\.0\.0\.1:[0-9]*|https://$CONTROL_PLANE_IP:6443|g" /tmp/kubeconfig
        sed -i "s|https://\[fc[0-9a-f:]*\]:[0-9]*|https://$CONTROL_PLANE_IP:6443|g" /tmp/kubeconfig
        sed -i "s|https://fc[0-9a-f:]*:[0-9]*|https://$CONTROL_PLANE_IP:6443|g" /tmp/kubeconfig
        echo "[entrypoint] Kubeconfig güncellendi: https://$CONTROL_PLANE_IP:6443"
    else
        echo "[entrypoint] WARN: nanonet-control-plane IP bulunamadı, kubeconfig değiştirilmedi"
    fi
    export KUBECONFIG=/tmp/kubeconfig
fi

exec "$@"
