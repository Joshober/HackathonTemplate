.PHONY: kill stack-up stack-down stack-restart run-flutter-mobile flutter-run run-travelbot docker-doctor dev-backend dev-frontend compose-reset

COMPOSE_RUN := "$(CURDIR)/scripts/compose-with-desktop.sh"
DOCKER_RUN := "$(CURDIR)/scripts/docker-with-desktop.sh"
COMPOSE_PROJECT_NAME ?= hackathonstack

FLUTTER_BRANCH ?= flutter-mobile
FLUTTER_DEVICE ?= macos

# Travelbot feature branch (see origin/Travelbot)
TRAVELBOT_BRANCH ?= Travelbot

kill:
	@$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) down --remove-orphans 2>/dev/null || true
	@-pkill -f "next dev" 2>/dev/null || true
	@-pkill -f "flask run" 2>/dev/null || true
	@-pkill -f "python run.py" 2>/dev/null || true
	@echo "kill: done (no matamos puertos 3000/5001: en macOS suele ser el proxy de Docker)"

stack-up:
	$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) up --build -d
	@echo ""
	@echo "Stack: http://localhost:3000 — API http://localhost:5001"
	@echo "Logs frontend: $(COMPOSE_RUN) -f \"$(CURDIR)/docker-compose.yml\" -p $(COMPOSE_PROJECT_NAME) logs -f frontend"

stack-down:
	@$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) down --remove-orphans 2>/dev/null || true
	@echo "stack-down: done"

stack-restart: kill stack-up

compose-reset:
	@echo "compose-reset: $(COMPOSE_PROJECT_NAME)"
	-$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) down --remove-orphans 2>/dev/null || true
	-@ids=$$($(DOCKER_RUN) ps -aq --filter "label=com.docker.compose.project=$(COMPOSE_PROJECT_NAME)" 2>/dev/null); \
		if [ -n "$$ids" ]; then echo $$ids | xargs $(DOCKER_RUN) rm -f 2>/dev/null; fi
	@echo "compose-reset: done"

docker-doctor:
	@echo "=== socket ==="
	@ls -la ~/.docker/run/docker.sock 2>/dev/null || echo "(no existe)"
	@echo "=== docker (PATH) ==="
	@-docker version 2>&1 || true
	@echo "=== docker (wrapper) ==="
	@-$(DOCKER_RUN) version 2>&1 || true

# Sin Docker: dos terminales — backend y frontend en local
dev-backend:
	cd backend && (test -d venv || python3 -m venv venv) && . venv/bin/activate && pip install -q -r requirements.txt && FLASK_ENV=development python run.py

dev-frontend:
	cd frontend && npm ci && npm run dev

run-flutter-mobile:
	@git fetch origin $(FLUTTER_BRANCH) 2>/dev/null || true
	@git checkout $(FLUTTER_BRANCH) 2>/dev/null || git checkout -B $(FLUTTER_BRANCH) origin/$(FLUTTER_BRANCH)
	@git pull --ff-only origin $(FLUTTER_BRANCH) 2>/dev/null || true
	$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) up --build -d
	@echo ""
	@echo "Stack: http://localhost:3000 — API http://localhost:5001"
	@echo "Flutter: make flutter-run"

flutter-run:
	cd mobile && flutter pub get && flutter run -d $(FLUTTER_DEVICE)

# Kill local/docker dev, switch to Travelbot, start stack (same pattern as run-flutter-mobile)
run-travelbot: kill
	@git fetch origin $(TRAVELBOT_BRANCH) 2>/dev/null || true
	@git checkout $(TRAVELBOT_BRANCH) 2>/dev/null || git checkout -B $(TRAVELBOT_BRANCH) origin/$(TRAVELBOT_BRANCH)
	@git pull --ff-only origin $(TRAVELBOT_BRANCH) 2>/dev/null || true
	$(COMPOSE_RUN) -f "$(CURDIR)/docker-compose.yml" -p $(COMPOSE_PROJECT_NAME) up --build -d
	@echo ""
	@echo "Travelbot: http://localhost:3000 — API http://localhost:5001"
	@echo "Logs: $(COMPOSE_RUN) -f \"$(CURDIR)/docker-compose.yml\" -p $(COMPOSE_PROJECT_NAME) logs -f frontend"
