document.addEventListener('DOMContentLoaded', () => {
    // Check for PixiJS
    if (typeof PIXI === 'undefined') {
        console.error('Pixi.js library is not loaded. Please include it in your HTML.');
        return;
    }

    // --- App Constants ---
    const FIELD_ASPECT_RATIO = 120 / 53.33; // 120 yards (including endzones) / 53.33 yards width
    const COLORS = {
        FIELD_GREEN: 0x0A5B2B,
        LINE_WHITE: 0xFFFFFF,
        ACCENT: 0x00D40B,
    };

    // --- Global State ---
    let activePageId = 'playbook-page';

    // --- DOM Elements ---
    const tabItems = document.querySelectorAll('.tab-item');
    const pages = document.querySelectorAll('.page');
    const playbookCanvas = document.getElementById('field-canvas');
    const creatorCanvas = document.getElementById('creator-canvas');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const clearBtn = document.getElementById('clear-btn');
    const undoBtn = document.getElementById('undo-btn');

    // --- PixiJS Applications ---
    let playbookApp, creatorApp;
    let isPlaybookInitialized = false;
    let isCreatorInitialized = false;

    // --- Helper Function: Draw Football Field ---
    const drawField = (app) => {
        const container = new PIXI.Container();
        app.stage.addChild(container);

        const graphics = new PIXI.Graphics();
        container.addChild(graphics);

        const resizeField = () => {
            const screenW = app.screen.width;
            const screenH = app.screen.height;
            const screenAspect = screenW / screenH;
            
            let fieldW, fieldH;

            if (screenAspect > FIELD_ASPECT_RATIO) {
                fieldH = screenH * 0.9;
                fieldW = fieldH * FIELD_ASPECT_RATIO;
            } else {
                fieldW = screenW * 0.9;
                fieldH = fieldW / FIELD_ASPECT_RATIO;
            }
            
            container.width = fieldW;
            container.height = fieldH;
            container.x = (screenW - fieldW) / 2;
            container.y = (screenH - fieldH) / 2;
        };

        const draw = () => {
            graphics.clear();
            const width = 1200; 
            const height = 533; 

            // Field Background
            graphics.beginFill(COLORS.FIELD_GREEN);
            graphics.drawRect(0, 0, width, height);
            graphics.endFill();

            // White Lines
            graphics.lineStyle(2, COLORS.LINE_WHITE, 1);
            
            // Sidelines & Endlines
            graphics.drawRect(0, 0, width, height);

            // Goal Lines & Endzones
            graphics.moveTo(100, 0);
            graphics.lineTo(100, height);
            graphics.moveTo(1100, 0);
            graphics.lineTo(1100, height);

            // Yard Lines
            for (let i = 1; i <= 19; i++) {
                const x = 100 + i * 50;
                graphics.moveTo(x, 0);
                graphics.lineTo(x, height);
            }
            
            // Hash Marks
            for (let i = 1; i <= 99; i++) {
                const x = 100 + i * 10;
                graphics.moveTo(x, 1);
                graphics.lineTo(x, 5);
                graphics.moveTo(x, height - 1);
                graphics.lineTo(x, height - 5);
            }
        };
        
        app.renderer.on('resize', resizeField);
        resizeField();
        draw();
    };

    // --- Playbook Logic ---
    let playerDot, routePath, animationProgress = 0, isPlaying = false;
    const routePoints = [ {x:600, y:266}, {x:600, y:166}, {x:700, y:66} ]; // Simple Post Route

    const initPlaybook = () => {
        if (isPlaybookInitialized) return;
        
        playbookApp = new PIXI.Application({
            view: playbookCanvas,
            resizeTo: playbookCanvas.parentElement,
            backgroundColor: 0x000000,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        drawField(playbookApp);

        // Draw Route
        routePath = new PIXI.Graphics();
        routePath.lineStyle(4, COLORS.ACCENT, 0.8);
        routePath.moveTo(routePoints[0].x, routePoints[0].y);
        for(let i = 1; i < routePoints.length; i++){
            routePath.lineTo(routePoints[i].x, routePoints[i].y);
        }
        playbookApp.stage.getChildAt(0).addChild(routePath); // Add to field container
        
        // Player Dot
        playerDot = new PIXI.Graphics();
        playerDot.beginFill(COLORS.ACCENT);
        playerDot.drawCircle(0, 0, 8);
        playerDot.endFill();
        playerDot.x = routePoints[0].x;
        playerDot.y = routePoints[0].y;
        playbookApp.stage.getChildAt(0).addChild(playerDot);

        playbookApp.ticker.add((delta) => {
            if (!isPlaying || !playerDot) return;
            animationProgress += 0.005 * delta;
            if (animationProgress > 1) animationProgress = 0;
            
            const totalLength = routePoints.length - 1;
            const currentSegment = Math.floor(animationProgress * totalLength);
            const segmentProgress = (animationProgress * totalLength) - currentSegment;

            const p1 = routePoints[currentSegment];
            const p2 = routePoints[currentSegment + 1] || routePoints[currentSegment];

            playerDot.x = p1.x + (p2.x - p1.x) * segmentProgress;
            playerDot.y = p1.y + (p2.y - p1.y) * segmentProgress;
        });

        isPlaybookInitialized = true;
    };
    
    playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        playPauseBtn.innerHTML = isPlaying ? 
            `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" fill="currentColor"/></svg>` :
            `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>`;
    });

    resetBtn.addEventListener('click', () => {
        animationProgress = 0;
        playerDot.x = routePoints[0].x;
        playerDot.y = routePoints[0].y;
        if (isPlaying) {
             isPlaying = false;
             playPauseBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>`;
        }
    });

    // --- Creator Logic ---
    let isDrawing = false;
    let currentPathPoints = [];
    let drawnPaths = [];
    let drawingLayer;

    const initCreator = () => {
        if (isCreatorInitialized) return;

        creatorApp = new PIXI.Application({
            view: creatorCanvas,
            resizeTo: creatorCanvas.parentElement,
            backgroundColor: 0x000000,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        drawField(creatorApp);
        
        drawingLayer = new PIXI.Graphics();
        creatorApp.stage.getChildAt(0).addChild(drawingLayer);

        const stage = creatorApp.stage.getChildAt(0);
        stage.interactive = true;

        const getLocalPoint = (globalPoint) => {
            return stage.toLocal(globalPoint);
        };

        stage.on('pointerdown', (event) => {
            isDrawing = true;
            const pos = getLocalPoint(event.data.global);
            currentPathPoints = [{x: pos.x, y: pos.y}];
        });

        stage.on('pointermove', (event) => {
            if (!isDrawing) return;
            const pos = getLocalPoint(event.data.global);
            currentPathPoints.push({x: pos.x, y: pos.y});
            
            drawingLayer.clear();
            drawnPaths.forEach(path => redrawPath(path));
            redrawPath(currentPathPoints, true);
        });

        stage.on('pointerup', () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentPathPoints.length > 1) {
                drawnPaths.push(currentPathPoints);
            }
            currentPathPoints = [];
        });

        stage.on('pointerupoutside', () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentPathPoints.length > 1) {
                drawnPaths.push(currentPathPoints);
            }
            currentPathPoints = [];
        });

        isCreatorInitialized = true;
    };

    const redrawPath = (points, isTemporary = false) => {
        if (points.length < 2) return;
        drawingLayer.lineStyle(5, COLORS.ACCENT, isTemporary ? 0.5 : 1);
        drawingLayer.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) {
            drawingLayer.lineTo(points[i].x, points[i].y);
        }
    };
    
    const redrawAllPaths = () => {
        drawingLayer.clear();
        drawnPaths.forEach(path => redrawPath(path));
    };
    
    clearBtn.addEventListener('click', () => {
        drawnPaths = [];
        redrawAllPaths();
    });

    undoBtn.addEventListener('click', () => {
        drawnPaths.pop();
        redrawAllPaths();
    });

    // --- Tab Switching Logic ---
    const switchTab = (targetPageId) => {
        if (activePageId === targetPageId) return;

        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(targetPageId).classList.add('active');

        tabItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`.tab-item[data-page="${targetPageId}"]`).classList.add('active');

        activePageId = targetPageId;

        // Lazy initialize canvases
        if (activePageId === 'playbook-page') initPlaybook();
        if (activePageId === 'creator-page') initCreator();
    };

    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.page);
        });
    });

    // --- PWA Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }

    // --- Initial Load ---
    initPlaybook(); // Initialize the first page
});
