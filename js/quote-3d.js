/**
 * 3D Visualization for Quote Calculator
 * Uses Three.js to render interactive box/pallet preview
 */

class Quote3DViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.packageType = 'box';
        this.dimensions = { width: 12, height: 12, depth: 12 };
        this.mesh = null;

        this.init();
        this.animate();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight || 500;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(40, 30, 40);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // OrbitControls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 150;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 80, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // Grid floor
        this.createFloor();

        // Initial package
        this.createBox();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    createFloor() {
        // Grid helper (1-foot squares, 10x10 feet)
        const gridHelper = new THREE.GridHelper(120, 10, 0xcccccc, 0xe0e0e0);
        gridHelper.position.y = 0;
        this.scene.add(gridHelper);

        // Floor plane for shadows
        const floorGeometry = new THREE.PlaneGeometry(120, 120);
        const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createBox() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        const { width, height, depth } = this.dimensions;
        // Convert inches to scene units (scale down by 4)
        const w = width / 4;
        const h = height / 4;
        const d = depth / 4;

        const geometry = new THREE.BoxGeometry(w, h, d);

        // Cardboard material
        const material = new THREE.MeshStandardMaterial({
            color: 0xc9a66b,  // Cardboard brown
            roughness: 0.8,
            metalness: 0
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = h / 2;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Add tape stripes
        this.addBoxTape(w, h, d);

        // Add dimension labels
        this.updateLabels();
    }

    addBoxTape(w, h, d) {
        // Remove old tape
        this.scene.children
            .filter(c => c.userData.isTape)
            .forEach(c => this.scene.remove(c));

        const tapeColor = 0x8b7355;
        const tapeMaterial = new THREE.MeshBasicMaterial({ color: tapeColor });

        // Top center tape
        const tapeWidth = Math.min(w * 0.15, 2);
        const tapeGeom = new THREE.BoxGeometry(tapeWidth, 0.1, d);
        const topTape = new THREE.Mesh(tapeGeom, tapeMaterial);
        topTape.position.set(0, h + 0.05, 0);
        topTape.userData.isTape = true;
        this.scene.add(topTape);

        // Side tapes
        const sideGeom = new THREE.BoxGeometry(tapeWidth, h * 0.3, 0.1);

        const frontTape = new THREE.Mesh(sideGeom, tapeMaterial);
        frontTape.position.set(0, h * 0.85, d / 2 + 0.05);
        frontTape.userData.isTape = true;
        this.scene.add(frontTape);

        const backTape = new THREE.Mesh(sideGeom, tapeMaterial);
        backTape.position.set(0, h * 0.85, -d / 2 - 0.05);
        backTape.userData.isTape = true;
        this.scene.add(backTape);
    }

    createPallet() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }

        // Clear any tape
        this.scene.children
            .filter(c => c.userData.isTape || c.userData.isPallet)
            .forEach(c => this.scene.remove(c));

        const { width, height, depth } = this.dimensions;
        const w = width / 4;
        const h = height / 4;
        const d = depth / 4;

        // Pallet base material (wood)
        const woodMaterial = new THREE.MeshStandardMaterial({
            color: 0xa0826d,
            roughness: 0.9,
            metalness: 0
        });

        // Create pallet group
        const palletGroup = new THREE.Group();
        palletGroup.userData.isPallet = true;

        // Pallet base (standard 48x40)
        const palletW = 12; // 48 inches / 4
        const palletD = 10; // 40 inches / 4
        const slat = 0.5;

        // Top slats
        for (let i = 0; i < 5; i++) {
            const topSlat = new THREE.Mesh(
                new THREE.BoxGeometry(palletW, 0.3, 1.5),
                woodMaterial
            );
            topSlat.position.set(0, 0.65, -palletD / 2 + 1 + i * 2.5);
            topSlat.castShadow = true;
            palletGroup.add(topSlat);
        }

        // Bottom stringers
        for (let i = -1; i <= 1; i++) {
            const stringer = new THREE.Mesh(
                new THREE.BoxGeometry(1, 0.5, palletD),
                woodMaterial
            );
            stringer.position.set(i * 5, 0.25, 0);
            stringer.castShadow = true;
            palletGroup.add(stringer);
        }

        this.scene.add(palletGroup);

        // Box on top of pallet
        const boxMaterial = new THREE.MeshStandardMaterial({
            color: 0xc9a66b,
            roughness: 0.8,
            metalness: 0
        });

        const boxGeom = new THREE.BoxGeometry(
            Math.min(w, palletW - 0.5),
            h - 1,
            Math.min(d, palletD - 0.5)
        );
        this.mesh = new THREE.Mesh(boxGeom, boxMaterial);
        this.mesh.position.y = 0.8 + (h - 1) / 2;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Wrap effect
        const wrapMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const wrapGeom = new THREE.BoxGeometry(
            Math.min(w, palletW - 0.4) + 0.1,
            h - 0.8,
            Math.min(d, palletD - 0.4) + 0.1
        );
        const wrap = new THREE.Mesh(wrapGeom, wrapMaterial);
        wrap.position.y = 0.8 + (h - 1) / 2;
        wrap.userData.isPallet = true;
        this.scene.add(wrap);

        this.updateLabels();
    }

    updateDimensions(length, width, height) {
        this.dimensions = { width: length, height: height, depth: width };

        if (this.packageType === 'box') {
            this.createBox();
        } else {
            this.createPallet();
        }

        // Adjust camera based on size
        const maxDim = Math.max(length, width, height) / 4;
        const distance = maxDim * 4 + 20;
        this.camera.position.set(distance, distance * 0.75, distance);
    }

    setPackageType(type) {
        this.packageType = type;
        if (type === 'pallet') {
            this.createPallet();
        } else {
            this.createBox();
        }
    }

    updateLabels() {
        // Remove old labels
        this.scene.children
            .filter(c => c.userData.isLabel)
            .forEach(c => {
                this.scene.remove(c);
                if (c.material && c.material.map) c.material.map.dispose();
            });

        // Create new labels with dimensions
        const { width, height, depth } = this.dimensions;

        this.createLabel(`${width}"`, { x: 0, y: -2, z: depth / 8 + 3 }, 'length');
        this.createLabel(`${depth}"`, { x: width / 8 + 3, y: -2, z: 0 }, 'width');
        this.createLabel(`${height}"`, { x: width / 8 + 3, y: height / 8, z: depth / 8 + 1 }, 'height');
    }

    createLabel(text, position, type) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;

        ctx.fillStyle = '#1e3a5f';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, position.y, position.z);
        sprite.scale.set(6, 3, 1);
        sprite.userData.isLabel = true;
        this.scene.add(sprite);
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight || 500;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.quote3D = new Quote3DViewer('quote-canvas');
});
