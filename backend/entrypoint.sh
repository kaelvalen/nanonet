#!/bin/sh

set -eu

if [ -f "/root/.kube/config" ]; then
    cp /root/.kube/config /tmp/kubeconfig

    control_plane_ip=""
    if control_plane_ip=$(getent ahostsv4 nanonet-control-plane 2>/dev/null | awk 'NR==1 { print $1 }'); then
        :
    fi
    if [ -z "$control_plane_ip" ]; then
        if control_plane_ip=$(getent hosts nanonet-control-plane 2>/dev/null | awk '{ print $1 }' | grep -v ':' | head -n 1); then
            :
        fi
    fi
    if [ -z "$control_plane_ip" ]; then
        if control_plane_ip=$(getent hosts nanonet-control-plane 2>/dev/null | awk '{ print $1 }' | head -n 1); then
            :
        fi
    fi

    if [ -n "$control_plane_ip" ]; then
        sed -i "s|https://127\.0\.0\.1:[0-9]*|https://$control_plane_ip:6443|g" /tmp/kubeconfig
        sed -i "s|https://\[fc[0-9a-f:]*\]:[0-9]*|https://$control_plane_ip:6443|g" /tmp/kubeconfig
        sed -i "s|https://fc[0-9a-f:]*:[0-9]*|https://$control_plane_ip:6443|g" /tmp/kubeconfig
        echo "[entrypoint] Kubeconfig güncellendi: https://$control_plane_ip:6443"
    else
        echo "[entrypoint] WARN: nanonet-control-plane IP bulunamadı, kubeconfig değiştirilmedi"
    fi

    export KUBECONFIG=/tmp/kubeconfig
fi

exec "$@"
