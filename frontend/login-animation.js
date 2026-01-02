document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('loginCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let centerX = canvas.width * 0.4; // Shift road left slightly to balance city/beach? No, keep center.
    centerX = canvas.width / 2;

    let centerY = canvas.height / 2;
    let horizon = canvas.height * 0.45;

    window.addEventListener('resize', function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        centerX = canvas.width / 2;
        centerY = canvas.height / 2;
        horizon = canvas.height * 0.45;
        initBuildings();
    });

    // Helper: Random Range
    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    class Star {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * horizon;
            this.size = Math.random() * 1.5;
            this.alpha = Math.random();
        }
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class Wave {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = random(centerX + 100, canvas.width); // Right side
            this.y = random(horizon, canvas.height);
            this.length = random(20, 100);
            this.speed = random(0.5, 1.5);
            this.alpha = 0;
            this.life = 0;
            this.maxLife = random(100, 200);
        }
        update() {
            // Perspective move? No, water just ripples.
            this.x -= this.speed; // Move towards shore (left)
            this.life++;

            // Fade in/out
            if (this.life < 50) this.alpha = this.life / 50;
            else if (this.life > this.maxLife - 50) this.alpha = (this.maxLife - this.life) / 50;

            if (this.life > this.maxLife) this.reset();
        }
        draw() {
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Perspective skew?
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.length, this.y);
            ctx.stroke();
        }
    }

    class Building {
        constructor(side) {
            this.side = side; // Always -1 (Left) based on requirement
            this.reset();
        }

        reset() {
            this.z = 0;
            this.height = random(150, 400); // Taller skyline
            this.width = random(60, 120);
            this.xOffset = random(150, 500);

            const shades = ['#0f172a', '#1e293b', '#020617'];
            this.color = shades[Math.floor(Math.random() * shades.length)];

            this.windows = [];
            const numWindows = Math.floor(random(10, 30));
            for (let i = 0; i < numWindows; i++) {
                if (Math.random() > 0.3) {
                    this.windows.push({
                        wx: random(0.1, 0.8),
                        wy: random(0.1, 0.9),
                        w: random(0.05, 0.15),
                        h: random(0.03, 0.05)
                    });
                }
            }
        }

        update(speed) {
            this.z += speed;
            if (this.z > 1.2) {
                this.reset();
            }
        }

        draw() {
            let scale = this.z * this.z * this.z;
            if (scale < 0.01) return;

            let roadMax = canvas.width * 0.8; // Small highway reference
            let currentOffset = this.xOffset * scale;

            // Left Side Positioning
            let perspectiveX = centerX - (roadMax * 0.5 * scale) - currentOffset;

            let bottomY = horizon + (scale * (canvas.height - horizon));
            let scaledHeight = this.height * scale * 2;
            let scaledWidth = this.width * scale * 3;

            ctx.fillStyle = this.color;
            let bx = perspectiveX - scaledWidth / 2;
            let by = bottomY - scaledHeight;

            ctx.fillRect(bx, by, scaledWidth, scaledHeight);

            ctx.fillStyle = `rgba(253, 224, 71, ${random(0.5, 0.9)})`;
            this.windows.forEach(win => {
                ctx.fillRect(
                    bx + (win.wx * scaledWidth),
                    by + (win.wy * scaledHeight),
                    scaledWidth * win.w,
                    scaledHeight * win.h
                );
            });
        }
    }

    class Vehicle {
        constructor() {
            this.reset();
        }

        reset() {
            this.z = 0;
            // 2 Lanes for smaller highway: -0.5 (Left), 0.5 (Right)
            const lanes = [-0.6, 0.6];
            this.lane = lanes[Math.floor(Math.random() * lanes.length)];
            this.speed = random(0.002, 0.005);
            this.type = Math.random() > 0.4 ? 'car' : 'bike';

            const colors = ['#cbd5e1', '#64748b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.z += this.speed;
            this.speed *= 1.02;
            if (this.z > 1.1) this.reset();
        }

        draw() {
            let scale = this.z * this.z * this.z;
            if (scale < 0.01) return;

            let perspectiveY = horizon + (scale * (canvas.height - horizon));
            let roadMax = canvas.width * 0.6; // NARROW HIGHWAY
            let roadMin = 5;
            let currentRoadWidth = roadMin + (scale * (roadMax - roadMin));

            let laneX = centerX + (this.lane * currentRoadWidth * 0.35); // Adjusted spread
            let size = 120 * scale;

            let alpha = Math.min(scale * 3, 1);

            ctx.save();
            ctx.translate(laneX, perspectiveY);
            ctx.globalAlpha = alpha;

            // Headlights/Shadows (Simplified for cleaner code)
            ctx.globalCompositeOperation = 'screen';
            let beamGrad = ctx.createLinearGradient(0, 0, 0, size * 2);
            beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = beamGrad;
            ctx.beginPath();
            ctx.moveTo(-size * 0.3, size * 0.2);
            ctx.lineTo(-size * 0.5, size * 3.5);
            ctx.lineTo(size * 0.5, size * 3.5);
            ctx.lineTo(size * 0.3, size * 0.2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            if (this.type === 'car') this.drawCar(size);
            else this.drawBike(size);

            ctx.restore();
        }

        drawCar(size) {
            let bodyGrad = ctx.createLinearGradient(-size / 2, -size, size / 2, 0);
            bodyGrad.addColorStop(0, '#1e293b');
            bodyGrad.addColorStop(0.5, this.color);
            bodyGrad.addColorStop(1, '#0f172a');

            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.roundRect(-size * 0.5, -size * 0.5, size, size * 0.5, size * 0.1);
            ctx.fill();

            ctx.fillStyle = '#0f172a'; // Roof
            ctx.beginPath();
            ctx.moveTo(-size * 0.35, -size * 0.5);
            ctx.lineTo(size * 0.35, -size * 0.5);
            ctx.lineTo(size * 0.3, -size * 0.8);
            ctx.lineTo(-size * 0.3, -size * 0.8);
            ctx.fill();

            // Lights
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = size * 0.2;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.rect(-size * 0.45, -size * 0.3, size * 0.15, size * 0.08);
            ctx.rect(size * 0.30, -size * 0.3, size * 0.15, size * 0.08);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        drawBike(size) {
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.moveTo(0, -size * 1.1);
            ctx.lineTo(size * 0.2, -size * 0.5);
            ctx.lineTo(0, size * 0.1);
            ctx.lineTo(-size * 0.2, -size * 0.5);
            ctx.fill();

            ctx.fillStyle = 'white'; // Helmet
            ctx.beginPath();
            ctx.arc(0, -size * 1.1, size * 0.12, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.rect(-size * 0.1, -size * 0.5, size * 0.2, size * 0.6);
            ctx.fill();

            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = size * 0.3;
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, -size * 0.4, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    let stars = [];
    let vehicles = [];
    let buildings = [];
    let waves = [];

    function init() {
        stars = [];
        for (let i = 0; i < 150; i++) stars.push(new Star());

        vehicles = [];
        for (let i = 0; i < 10; i++) {
            let v = new Vehicle();
            v.z = Math.random();
            vehicles.push(v);
        }

        buildings = [];
        for (let i = 0; i < 20; i++) { // Only Left Side Buildings
            let b = new Building(-1);
            b.z = Math.random();
            buildings.push(b);
        }

        waves = [];
        for (let i = 0; i < 50; i++) waves.push(new Wave());
    }

    function drawLandscape() {
        // Sky
        let skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGrad.addColorStop(0, '#020617');
        skyGrad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, horizon);

        stars.forEach(star => star.draw());

        // --- RIGHT SIDE: BEACH / OCEAN ---
        let seaGrad = ctx.createLinearGradient(centerX, horizon, canvas.width, horizon);
        seaGrad.addColorStop(0, '#0f172a'); // Near shore
        seaGrad.addColorStop(1, '#1e3a8a'); // Deep sea (dark blue)

        ctx.fillStyle = '#0f172a'; // Base sea frame
        ctx.fillRect(centerX, horizon, canvas.width / 2, canvas.height - horizon);

        // Waves
        waves.forEach(w => w.update());
        waves.forEach(w => w.draw());

        // --- LEFT SIDE: CITY GROUND ---
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, horizon, centerX, canvas.height - horizon);

        // --- ROAD (Narrow) ---
        let roadMax = canvas.width * 0.6; // Small Highway width
        let roadMin = 5;

        ctx.beginPath();
        ctx.moveTo(centerX - roadMin, horizon);
        ctx.lineTo(centerX + roadMin, horizon);
        ctx.lineTo(centerX + roadMax / 2, canvas.height); // Right edge
        ctx.lineTo(centerX - roadMax / 2, canvas.height); // Left edge
        ctx.closePath();

        let roadGrad = ctx.createLinearGradient(0, horizon, 0, canvas.height);
        roadGrad.addColorStop(0, '#1e293b');
        roadGrad.addColorStop(1, '#020617');
        ctx.fillStyle = roadGrad;
        ctx.fill();

        // Road Edges
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - roadMin, horizon);
        ctx.lineTo(centerX - roadMax / 2, canvas.height);
        ctx.stroke();

        ctx.strokeStyle = '#bfdbfe'; // Sand/Shore line?
        ctx.beginPath();
        ctx.moveTo(centerX + roadMin, horizon);
        ctx.lineTo(centerX + roadMax / 2, canvas.height);
        ctx.stroke();

        // Center Line (Dashed)
        let time = Date.now() * 0.002;
        ctx.beginPath();
        ctx.moveTo(centerX, horizon);
        ctx.lineTo(centerX, canvas.height);
        ctx.strokeStyle = `rgba(255,255,255,0.3)`;
        ctx.setLineDash([10, 30]);
        ctx.lineDashOffset = -time * 50;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawLandscape();

        // Buildings (Left Side Sort)
        buildings.sort((a, b) => a.z - b.z);
        buildings.forEach(b => {
            b.update(0.005); // Faster speed for visible movement
            b.draw();
        });

        // Vehicles
        vehicles.sort((a, b) => a.z - b.z);
        vehicles.forEach(v => {
            v.update();
            v.draw();
        });

        requestAnimationFrame(animate);
    }

    init();
    animate();
});
