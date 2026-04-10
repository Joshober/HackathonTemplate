.PHONY: kill run-flutter-mobile flutter-run

# Docker Compose v2 (`docker compose`); override if you use standalone `docker-compose`
COMPOSE ?= docker compose

# Branch used for the mobile Flutter workflow
FLUTTER_BRANCH ?= flutter-mobile

kill:
	@$(COMPOSE) down --remove-orphans 2>/dev/null || true
	@for port in 3000 5001; do \
		pids=$$(lsof -ti:$$port 2>/dev/null); \
		if [ -n "$$pids" ]; then \
			echo "$$pids" | xargs kill -9 2>/dev/null || true; \
			echo "Freed port $$port"; \
		fi; \
	done
	@-pkill -f "next dev" 2>/dev/null || true
	@-pkill -f "flask run" 2>/dev/null || true
	@-pkill -f "python run.py" 2>/dev/null || true
	@echo "kill: done"

run-flutter-mobile:
	@git fetch origin $(FLUTTER_BRANCH) 2>/dev/null || true
	@git checkout $(FLUTTER_BRANCH) 2>/dev/null || git checkout -B $(FLUTTER_BRANCH) origin/$(FLUTTER_BRANCH)
	@git pull --ff-only origin $(FLUTTER_BRANCH) 2>/dev/null || true
	$(COMPOSE) up --build -d
	@echo ""
	@echo "Stack is up (detached). Frontend http://localhost:3000 — API http://localhost:5001"
	@echo "Run the Flutter app: make flutter-run"

flutter-run:
	cd mobile && flutter pub get && flutter run
