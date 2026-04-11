# shellcheck shell=bash
# Sourced by docker-with-desktop.sh and compose-with-desktop.sh

docker_ok() {
  docker info >/dev/null 2>&1
}

docker_desktop_bootstrap() {
  unset DOCKER_HOST
  if docker_ok; then
    return 0
  fi

  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 1
  fi

  if docker desktop start >/dev/null 2>&1; then
    local _
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
      if docker_ok; then
        echo "docker: engine is up." >&2
        return 0
      fi
      sleep 1
    done
  fi

  docker context use desktop-linux >/dev/null 2>&1 || true
  if docker_ok; then
    return 0
  fi

  local sock
  for sock in \
    "${HOME}/.docker/run/docker.sock" \
    "${HOME}/.docker/desktop/docker.sock" \
    "/var/run/docker.sock"
  do
    if [[ -S "$sock" ]]; then
      export DOCKER_HOST="unix://${sock}"
      if docker_ok; then
        echo "docker: using unix://${sock}" >&2
        return 0
      fi
      unset DOCKER_HOST
    fi
  done

  return 1
}

docker_desktop_fail_help() {
  echo "" >&2
  echo "No se puede hablar con el motor de Docker (docker info falla)." >&2
  echo "" >&2
  echo "Si existe ~/.docker/run/docker.sock pero sigue fallando, suele ser un socket VIEJO:" >&2
  echo "  Cierra Docker Desktop por completo (menú ballena → Quit), vuelve a abrir, espera ~1 min." >&2
  echo "  En Docker Desktop: Troubleshoot → Restart (o Reset to factory defaults si sigue roto)." >&2
  echo "" >&2
  echo "Prueba también el mismo comando en Terminal.app (a veces el terminal del IDE bloquea el socket)." >&2
  echo "  docker desktop start" >&2
  echo "  make docker-doctor" >&2
  echo "" >&2
}
