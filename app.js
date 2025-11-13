document.addEventListener('DOMContentLoaded', () => {

    const FIELD_WIDTH_YARDS = 53.3 * 2; // Sideline to sideline
    const FIELD_HEIGHT_YARDS = 60; // Displayed portion of the field

    // --- UTILITY FUNCTIONS ---
    const lerp = (start, end, t) => start * (1 - t) + end * t;
    const quadraticBezier = (p0, p1, p2, t) => {
        const oneMinusT = 1 - t;
        return {
            x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
            y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
        };
    };

    // --- CORE COMPONENTS ---

    class PlayerEntity {
        constructor(id, role) {
            this.id = id;
            this.role = role;
            this.position = { x: 0, y: 0 }; // World coordinates (yards)

            this.element = document.createElement('div');
            this.element.id = id;
            this.element.className = `player-entity player-${role.toLowerCase()}`;

            if (id === 'BALL') {
                this.element.innerHTML = `<svg><use xlink:href="#football-icon"/></svg>`;
            } else {
                this.element.innerHTML = `<svg><use xlink:href="#helmet-icon"/></svg>`;
            }
        }

        render(container) {
            container.appendChild(this.element);
        }

        setPosition(worldPos, worldToScreen) {
            this.position = worldPos;
            const screenPos = worldToScreen(worldPos);
            // Using transform for performance. Centering the icon.
            this.element.style.transform = `translate(${screenPos.x - this.element.offsetWidth / 2}px, ${screenPos.y - this.element.offsetHeight / 2}px)`;
        }
    }

    class RouteAnimator {
        constructor(entities, worldToScreen) {
            this.entities = entities;
            this.worldToScreen = worldToScreen;
            this.animationFrameId = null;
            this.activeAnimations = [];
        }

        stop() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            this.activeAnimations = [];
        }

        play(route) {
            this.stop();

            const allAnimations = [];

            // Add snap animation
            if (route.snapAnimation) {
                const snap = route.snapAnimation;
                const entity = this.entities[snap.entityId];
                allAnimations.push(this.createAnimation(entity, {
                    type: snap.type,
                    start: route.initialPositions[snap.entityId],
                    end: snap.end,
                    duration: snap.duration,
                    delay: snap.delay || 0
                }));
            }

            // Add player path animations
            route.path.forEach(segment => {
                const entity = this.entities[segment.entityId];
                const startPos = allAnimations.length > 0 && allAnimations[allAnimations.length - 1].entityId === segment.entityId
                    ? allAnimations[allAnimations.length - 1].end
                    : route.initialPositions[segment.entityId];

                allAnimations.push(this.createAnimation(entity, { ...segment, start: startPos }));
            });

            this.activeAnimations = allAnimations.map(anim => ({ ...anim, startTime: null }));

            const animate = (timestamp) => {
                let allAnimationsFinished = true;

                this.activeAnimations.forEach(anim => {
                    if (anim.isFinished) return;
                    if (!anim.startTime) anim.startTime = timestamp;

                    const elapsedTime = timestamp - anim.startTime;

                    if (elapsedTime < anim.delay) {
                        allAnimationsFinished = false;
                        return;
                    }
                    
                    const adjustedElapsedTime = elapsedTime - anim.delay;
                    const progress = Math.min(adjustedElapsedTime / anim.duration, 1);

                    let currentPos;
                    if (anim.type === 'line') {
                        currentPos = {
                            x: lerp(anim.start.x, anim.end.x, progress),
                            y: lerp(anim.start.y, anim.end.y, progress)
                        };
                    } else if (anim.type === 'curve') {
                        currentPos = quadraticBezier(anim.start, anim.controlPoint, anim.end, progress);
                    }

                    anim.entity.setPosition(currentPos, this.worldToScreen);

                    if (progress < 1) {
                        allAnimationsFinished = false;
                    } else {
                        anim.isFinished = true;
                    }
                });

                if (!allAnimationsFinished) {
                    this.animationFrameId = requestAnimationFrame(animate);
                } else {
                    console.log(`Route "${route.name}" finished.`);
                }
            };
            this.animationFrameId = requestAnimationFrame(animate);
        }

        createAnimation(entity, segment) {
            return {
                entity,
                entityId: entity.id,
                start: segment.start,
                end: segment.end,
                controlPoint: segment.controlPoint,
                type: segment.type,
                duration: segment.duration,
                delay: segment.delay || 0,
                isFinished: false
            };
        }
    }

    class UIController {
        constructor(routes, onRouteSelect) {
            this.routes = routes;
            this.onRouteSelect = onRouteSelect;
            this.selectorElement = document.getElementById('route-selector');
            this.infoDisplayElement = document.getElementById('route-info-display');
            this.init();
        }

        init() {
            this.selectorElement.innerHTML = '';
            this.routes.forEach(route => {
                const li = document.createElement('li');
                li.textContent = route.name;
                li.dataset.routeId = route.id;
                li.addEventListener('click', () => this.handleSelection(route.id));
                this.selectorElement.appendChild(li);
            });
        }

        handleSelection(routeId) {
            const route = this.routes.find(r => r.id === routeId);
            if (!route) return;

            // Update UI
            this.infoDisplayElement.textContent = route.name;
            Array.from(this.selectorElement.children).forEach(li => {
                li.classList.toggle('active', li.dataset.routeId === routeId);
            });

            // Trigger callback
            this.onRouteSelect(route);
        }
    }

    // --- MAIN APPLICATION LOGIC ---

    class App {
        constructor() {
            this.fieldCanvas = document.getElementById('field-canvas');
            this.scrimmageLine = document.querySelector('.line-of-scrimmage');
            this.routes = [];
            this.entities = {};
            this.animator = null;
            this.uiController = null;

            this.setupCoordinateSystem();
            window.addEventListener('resize', () => this.setupCoordinateSystem());
        }

        async start() {
            await this.loadRoutes();
            this.createEntities();
            this.animator = new RouteAnimator(this.entities, this.worldToScreen.bind(this));
            this.uiController = new UIController(this.routes, this.playRoute.bind(this));
            
            // Set initial state to the first route
            this.resetToRoute(this.routes[0]);
        }

        setupCoordinateSystem() {
            this.canvasRect = this.fieldCanvas.getBoundingClientRect();
            // The coordinate system assumes the 50-yard line is vertical center.
            // Our field SVG shows from the line of scrimmage (y=0) up.
            // Let's assume the visible field is from y=0 to y=60.
            this.yScale = this.canvasRect.height / FIELD_HEIGHT_YARDS;
            this.xScale = this.canvasRect.width / FIELD_WIDTH_YARDS;

            // Position scrimmage line (y=0)
            const scrimmageScreenPos = this.worldToScreen({x: 0, y: 0});
            this.scrimmageLine.style.transform = `translateY(${scrimmageScreenPos.y}px)`;
        }

        worldToScreen(worldPos) {
            // Converts yards {x, y} to pixels {x, y}
            // x=0 is center, y=0 is line of scrimmage
            const screenX = this.canvasRect.width / 2 + worldPos.x * this.xScale;
            // Y is inverted for screen coordinates (0 is top)
            // We set y=0 (scrimmage) to be a certain percentage from the bottom. Let's say 85%.
            const screenY = this.canvasRect.height * 0.85 - worldPos.y * this.yScale;
            return { x: screenX, y: screenY };
        }

        async loadRoutes() {
            try {
                const response = await fetch('routes.json');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                this.routes = await response.json();
            } catch (error) {
                console.error("Fatal: Could not load routes.json. Application cannot start.", error);
            }
        }

        createEntities() {
            // Create all possible entities. A more robust system might do this dynamically.
            this.entities['WR1'] = new PlayerEntity('WR1', 'WR');
            this.entities['QB1'] = new PlayerEntity('QB1', 'QB');
            this.entities['BALL'] = new PlayerEntity('BALL', 'BALL');
            Object.values(this.entities).forEach(e => e.render(this.fieldCanvas));
        }

        resetToRoute(route) {
            this.animator.stop();
            for (const [id, pos] of Object.entries(route.initialPositions)) {
                if (this.entities[id]) {
                    this.entities[id].setPosition(pos, this.worldToScreen.bind(this));
                }
            }
        }

        playRoute(route) {
            this.resetToRoute(route);
            this.animator.play(route);
        }
    }

    // --- INITIALIZE ---
    const app = new App();
    app.start();
});
