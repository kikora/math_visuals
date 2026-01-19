(function () {
  if (typeof THREE === 'undefined') {
    console.error('THREE.js er ikke lastet inn.');
    return;
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ORBIT_CONTROLS_MODULE_URL = 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
  const ORBIT_CONTROLS_SCRIPT_SRC = (() => {
    if (typeof document === 'undefined') {
      return 'vendor/three/examples/js/controls/OrbitControls.js';
    }
    const current = document.currentScript;
    if (current && current.src) {
      try {
        return new URL('./vendor/three/examples/js/controls/OrbitControls.js', current.src).href;
      } catch (_) {
        // ignore and fall back to relative path below
      }
    }
    return 'vendor/three/examples/js/controls/OrbitControls.js';
  })();
  let orbitControlsPromise = null;
  function ensureOrbitControlsScript() {
    if (typeof document === 'undefined') {
      return Promise.resolve('failed');
    }
    const existing = document.querySelector('script[data-orbit-controls]');
    if (existing) {
      const state = existing.dataset.loaded;
      if (state === 'true') return Promise.resolve('loaded');
      if (state === 'false') return Promise.resolve('failed');
      return new Promise(resolve => {
        const handleLoad = () => {
          existing.dataset.loaded = 'true';
          resolve('loaded');
        };
        const handleError = () => {
          existing.dataset.loaded = 'false';
          resolve('failed');
        };
        existing.addEventListener('load', handleLoad, {
          once: true
        });
        existing.addEventListener('error', handleError, {
          once: true
        });
      });
    }
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = ORBIT_CONTROLS_SCRIPT_SRC;
      script.async = true;
      script.dataset.orbitControls = 'true';
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve('loaded');
      }, {
        once: true
      });
      script.addEventListener('error', () => {
        script.dataset.loaded = 'false';
        resolve('failed');
      }, {
        once: true
      });
      document.head.appendChild(script);
    });
  }
  function getGlobalOrbitControls() {
    return typeof THREE !== 'undefined' && typeof THREE.OrbitControls === 'function' ? THREE.OrbitControls : null;
  }
  function loadOrbitControls() {
    if (orbitControlsPromise) {
      return orbitControlsPromise;
    }
    orbitControlsPromise = (async () => {
      const globalControls = getGlobalOrbitControls();
      if (globalControls) {
        return globalControls;
      }
      const scriptStatus = await ensureOrbitControlsScript();
      const scriptedControls = getGlobalOrbitControls();
      if (scriptedControls) {
        return scriptedControls;
      }
      if (scriptStatus === 'failed') {
        try {
          const module = await import(ORBIT_CONTROLS_MODULE_URL);
          if (module && typeof module.OrbitControls === 'function') {
            THREE.OrbitControls = module.OrbitControls;
            return module.OrbitControls;
          }
          console.warn('Fant ikke OrbitControls-modulen.');
        } catch (error) {
          console.warn('Klarte ikke laste OrbitControls-modulen.', error);
        }
      }
      return getGlobalOrbitControls();
    })();
    return orbitControlsPromise;
  }
  const controlsPromise = loadOrbitControls();
  function ensureHiddenHint(id, text, container) {
    if (typeof document === 'undefined') return null;
    if (typeof id !== 'string' || !id) return null;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('p');
      el.id = id;
      el.className = 'sr-only';
      el.textContent = text;
      const parent = container && typeof container.appendChild === 'function' ? container : document.body;
      parent.appendChild(el);
    }
    return el;
  }
  const SHAPE_KEYBOARD_HINT_ID = 'trefigurerKeyboardHint';
  function normalizeVectorArray(value) {
    if (!Array.isArray(value) || value.length !== 3) return null;
    const normalized = value.map(num => Number(num));
    return normalized.every(Number.isFinite) ? normalized : null;
  }
  class ShapeRenderer {
    constructor(container, options = {}) {
      this.container = container;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf6f7fb);
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(4.2, 3.6, 5.6);
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = false;
      this.container.appendChild(this.renderer.domElement);
      this.canvas = this.renderer.domElement;
      if (this.canvas && this.canvas.style) {
        this.canvas.style.touchAction = 'none';
      }
      if (this.canvas) {
        this.canvas.tabIndex = 0;
        if (typeof this.canvas.setAttribute === 'function') {
          const figureIndex = this._getFigureIndex();
          const label = Number.isInteger(figureIndex) ? `3D-figur ${figureIndex + 1}` : '3D-figur';
          this.canvas.setAttribute('role', 'application');
          this.canvas.setAttribute('aria-label', label);
          if (SHAPE_KEYBOARD_HINT_ID) {
            this.canvas.setAttribute('aria-describedby', SHAPE_KEYBOARD_HINT_ID);
          }
          this.canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown + - Home');
        }
        this._boundCanvasFocus = () => this._handleCanvasFocus();
        this._boundCanvasKeydown = event => this._handleCanvasKeydown(event);
        this.canvas.addEventListener('focus', this._boundCanvasFocus);
        this.canvas.addEventListener('keydown', this._boundCanvasKeydown);
      }
      this.controls = null;
      this.materialColorOverride = null;
      this.materialOpacity = 1;
      this.onViewChange = typeof options.onViewChange === 'function' ? options.onViewChange : null;
      controlsPromise.then(ControlsClass => {
        if (ControlsClass) {
          this._attachControls(ControlsClass);
        }
      });
      const ambient = new THREE.AmbientLight(0xffffff, 0.55);
      this.scene.add(ambient);
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
      keyLight.position.set(5, 8, 6);
      this.scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
      fillLight.position.set(-4, 4, -2);
      this.scene.add(fillLight);
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
      });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      this.scene.add(ground);
      this.ground = ground;
      this.shapeGroup = new THREE.Group();
      this.scene.add(this.shapeGroup);
      this.currentFrame = null;
      this.rotationLocked = false;
      this.isFloating = false;
      this.fitMargin = 1.2;
      this._animate = this._animate.bind(this);
      this._handleResize = this._handleResize.bind(this);
      if (typeof ResizeObserver === 'function') {
        this.resizeObserver = new ResizeObserver(() => this._handleResize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener('resize', this._handleResize);
      }
      this._handleResize();
      this.renderer.setAnimationLoop(this._animate);
    }
    _getFigureIndex() {
      if (!this.container || typeof this.container.closest !== 'function') return null;
      const wrapper = this.container.closest('.figure[data-figure-index]');
      if (!wrapper) return null;
      const value = Number.parseInt(wrapper.dataset.figureIndex, 10);
      return Number.isInteger(value) ? value : null;
    }
    _handleCanvasFocus() {
      const index = this._getFigureIndex();
      if (Number.isInteger(index)) {
        setActiveViewIndex(index, { force: true });
      }
    }
    _handleCanvasKeydown(evt) {
      if (!evt || typeof evt.key !== 'string') return;
      const index = this._getFigureIndex();
      if (!Number.isInteger(index)) return;
      if (!hasFigureAtIndex(index)) return;
      setActiveViewIndex(index);
      const view = getEffectiveView(index);
      if (!view) return;
      const rotationStep = evt.shiftKey ? 4 : 12;
      const elevationStep = evt.shiftKey ? 3 : 8;
      const zoomStep = evt.shiftKey ? 6 : 12;
      let handled = false;
      const key = evt.key;
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const currentRotation = computeRotationDegreesFromView(view);
        const baseRotation = Number.isFinite(currentRotation) ? currentRotation : 0;
        const delta = key === 'ArrowLeft' ? -rotationStep : rotationStep;
        applyViewControlChanges({ rotationDeg: baseRotation + delta });
        handled = true;
      } else if (key === 'ArrowUp' || key === 'ArrowDown') {
        const currentElevation = computeElevationDegreesFromView(view);
        const baseElevation = Number.isFinite(currentElevation) ? currentElevation : 0;
        const delta = key === 'ArrowUp' ? elevationStep : -elevationStep;
        applyViewControlChanges({ elevationDeg: baseElevation + delta });
        handled = true;
      } else if (key === 'PageUp' || key === 'PageDown' || key === '+' || key === '=' || key === '-' || key === '_') {
        const currentZoom = computeZoomPercentFromView(view, this);
        const baseZoom = Number.isFinite(currentZoom) ? currentZoom : 100;
        let nextZoom = baseZoom;
        if (key === 'PageUp' || key === '+' || key === '=') {
          nextZoom = baseZoom - zoomStep;
        } else if (key === 'PageDown' || key === '-' || key === '_') {
          nextZoom = baseZoom + zoomStep;
        }
        applyViewControlChanges({ zoomPercent: nextZoom });
        handled = true;
      } else if (key === 'Home') {
        this.frameCurrentShape();
        handled = true;
      }
      if (handled) {
        evt.preventDefault();
        updateViewControlsUI(index);
      }
    }
    _attachControls(ControlsClass) {
      if (!ControlsClass || this.controls) return;
      const controls = new ControlsClass(this.camera, this.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.screenSpacePanning = true;
      controls.panSpeed = 0.7;
      controls.rotateSpeed = 0.9;
      controls.zoomSpeed = 0.9;
      controls.minDistance = 2.5;
      controls.maxDistance = 12;
      if (this.currentFrame && this.currentFrame.center) {
        controls.target.copy(this.currentFrame.center);
      } else {
        controls.target.set(0, 1.1, 0);
      }
      controls.addEventListener('start', () => {
        this.userIsInteracting = true;
      });
      controls.addEventListener('end', () => {
        this.userIsInteracting = false;
        this._syncStateFromControls();
      });
      controls.addEventListener('change', () => {
        this._syncStateFromControls();
      });
      this.controls = controls;
      if (this.rotationLocked) {
        this.controls.enableRotate = false;
      }
      if (this.currentFrame) {
        const base = this.currentFrame.baseDistance || this.currentFrame.distance;
        this._updateControlsDistances(base, this.currentFrame.distance);
        this.controls.update();
      } else {
        this.controls.update();
      }
      this._emitViewChange();
    }
    _handleResize() {
      const width = this.container.clientWidth;
      if (!width) return;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : null;
      const maxHeight = viewportHeight ? viewportHeight * 0.7 : Infinity;
      const preferred = width * 0.72;
      const height = Math.max(280, Math.min(Math.round(preferred), 560, maxHeight));
      this.container.style.height = `${height}px`;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / Math.max(height, 1);
      this.camera.updateProjectionMatrix();
      this._ensureFrameFits();
    }
    _animate() {
      if (!this.rotationLocked && !this.userIsInteracting && this.shapeGroup.children.length) {
        this.shapeGroup.rotation.y += 0.006;
      }
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
    _computeFitDistance(size) {
      if (!size) return 0;
      const halfFov = THREE.MathUtils.degToRad((this.camera.fov || 35) / 2);
      const safeHalfFov = Math.max(halfFov, 0.001);
      const aspect = this.camera.aspect || 1;
      const halfHeight = Math.max(size.y / 2, 0.01);
      const maxHorizontal = Math.max(size.x, size.z) / 2 || 0.01;
      const distanceForHeight = halfHeight / Math.tan(safeHalfFov);
      const halfHorizontalFov = Math.atan(Math.tan(safeHalfFov) * aspect);
      const safeHalfHorizontal = Math.max(halfHorizontalFov, 0.001);
      const distanceForWidth = maxHorizontal / Math.tan(safeHalfHorizontal);
      return Math.max(distanceForHeight, distanceForWidth);
    }
    _updateControlsDistances(baseDistance, currentDistance = baseDistance) {
      if (!this.controls || !(baseDistance > 0)) return;
      const minDistance = Math.max(0.6, baseDistance * 0.45);
      const maxDistance = Math.max(baseDistance * 3, currentDistance * 1.1, minDistance + 1.5);
      this.controls.minDistance = minDistance;
      this.controls.maxDistance = maxDistance;
    }
    _syncStateFromControls() {
      if (!this.controls || !this.currentFrame) return;
      if (this.currentFrame.center) {
        this.currentFrame.center.copy(this.controls.target);
      }
      this.currentFrame.distance = this.camera.position.distanceTo(this.controls.target);
      const baseDistance = this.currentFrame.baseDistance || this.currentFrame.distance || this.controls.minDistance;
      this._updateControlsDistances(baseDistance, this.currentFrame.distance);
      this._emitViewChange();
    }
    syncViewState() {
      if (this.controls && this.currentFrame) {
        this._syncStateFromControls();
        return;
      }
      this._emitViewChange();
    }
    frameCurrentShape() {
      if (!this.currentShape) return;
      this.currentShape.updateMatrixWorld(true);
      this.shapeGroup.updateMatrixWorld(true);
      const geometryBox = this._computeGeometryBoundingBox(this.currentShape);
      const fullBox = new THREE.Box3().setFromObject(this.currentShape);
      const effectiveBox = fullBox.isEmpty() ? geometryBox : fullBox;
      if (!effectiveBox || effectiveBox.isEmpty()) return;
      const size = new THREE.Vector3();
      effectiveBox.getSize(size);
      const center = geometryBox && !geometryBox.isEmpty() ? geometryBox.getCenter(new THREE.Vector3()) : effectiveBox.getCenter(new THREE.Vector3());
      const direction = this.camera.position.clone().sub(this.controls ? this.controls.target : center);
      if (!direction.lengthSq()) {
        direction.set(0, 0, 1);
      }
      const requiredDistance = Math.max(this._computeFitDistance(size) * this.fitMargin, 0.5);
      const offset = direction.normalize().multiplyScalar(requiredDistance);
      const newPosition = center.clone().add(offset);
      this.camera.position.copy(newPosition);
      if (this.controls) {
        this.controls.target.copy(center);
        this._updateControlsDistances(requiredDistance, requiredDistance);
        this.controls.update();
      } else {
        this.camera.lookAt(center);
      }
      this.currentFrame = {
        center: center.clone(),
        size: size.clone(),
        baseDistance: requiredDistance,
        distance: requiredDistance
      };
      this.camera.updateProjectionMatrix();
      this._emitViewChange();
    }
    _ensureFrameFits() {
      if (!this.currentFrame) return;
      const center = this.currentFrame.center;
      const desiredDistance = Math.max(this._computeFitDistance(this.currentFrame.size) * this.fitMargin, 0.5);
      this.currentFrame.baseDistance = desiredDistance;
      const toCamera = this.camera.position.clone().sub(center);
      if (!toCamera.lengthSq()) {
        toCamera.set(0, 0, 1);
      }
      const currentDistance = toCamera.length();
      if (currentDistance + 1e-4 < desiredDistance) {
        const adjusted = toCamera.normalize().multiplyScalar(desiredDistance);
        const newPosition = center.clone().add(adjusted);
        this.camera.position.copy(newPosition);
        if (this.controls) {
          this.controls.update();
        } else {
          this.camera.lookAt(center);
        }
      }
      this.currentFrame.distance = this.camera.position.distanceTo(center);
      this._updateControlsDistances(this.currentFrame.baseDistance, this.currentFrame.distance);
      this._emitViewChange();
    }
    _computeGeometryBoundingBox(object) {
      if (!object) return null;
      object.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const tempBox = new THREE.Box3();
      let hasBox = false;
      object.traverse(node => {
        if (!node.visible) return;
        if (node.userData && node.userData.isMeasurement) return;
        const geometry = node.geometry;
        if (!geometry) return;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox) return;
        tempBox.copy(geometry.boundingBox);
        tempBox.applyMatrix4(node.matrixWorld);
        if (!hasBox) {
          box.copy(tempBox);
          hasBox = true;
        } else {
          box.union(tempBox);
        }
      });
      return hasBox ? box : null;
    }
    _applyFloatingOffset() {
      if (!this.currentShape) return;
      this.currentShape.position.set(0, 0, 0);
      this.currentShape.updateMatrixWorld(true);
      if (this.isFloating) {
        const geometryBox = this._computeGeometryBoundingBox(this.currentShape);
        if (geometryBox && !geometryBox.isEmpty()) {
          const center = new THREE.Vector3();
          geometryBox.getCenter(center);
          this.currentShape.position.copy(center.multiplyScalar(-1));
          this.currentShape.updateMatrixWorld(true);
        }
      }
      this.shapeGroup.updateMatrixWorld(true);
    }
    setFloating(isFloating) {
      const shouldFloat = Boolean(isFloating);
      const changed = this.isFloating !== shouldFloat;
      this.isFloating = shouldFloat;
      if (this.ground) {
        this.ground.visible = !this.isFloating;
      }
      if (!changed) {
        return;
      }
      this._applyFloatingOffset();
      this.frameCurrentShape();
    }
    setRotationLocked(isLocked) {
      this.rotationLocked = Boolean(isLocked);
      if (this.rotationLocked) {
        this.userIsInteracting = false;
      }
      if (this.controls) {
        this.controls.enableRotate = !this.rotationLocked;
        this.controls.update();
      }
    }
    disposeCurrentShape() {
      if (!this.currentShape) return;
      this.shapeGroup.remove(this.currentShape);
      this.currentShape.traverse(obj => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach(mat => {
            if (mat && mat.map && typeof mat.map.dispose === 'function') {
              mat.map.dispose();
            }
            if (mat && typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
        }
      });
      this.currentShape = null;
      this.shapeGroup.rotation.set(0, 0, 0);
      this.currentFrame = null;
    }
    _emitViewChange() {
      if (typeof this.onViewChange !== 'function') return;
      if (!this.camera) return;
      const position = this.camera.position;
      const targetVec = this.controls ? this.controls.target : this.currentFrame && this.currentFrame.center;
      if (!position || !targetVec) return;
      const positionArray = [position.x, position.y, position.z];
      const targetArray = [targetVec.x, targetVec.y, targetVec.z];
      if (!positionArray.every(Number.isFinite) || !targetArray.every(Number.isFinite)) return;
      const viewData = {
        position: positionArray,
        target: targetArray
      };
      const currentDistance = this.currentFrame && typeof this.currentFrame.distance === 'number' ? this.currentFrame.distance : position.distanceTo(targetVec);
      if (Number.isFinite(currentDistance)) {
        viewData.distance = currentDistance;
      }
      const baseDistance = this.currentFrame && typeof this.currentFrame.baseDistance === 'number' ? this.currentFrame.baseDistance : undefined;
      if (Number.isFinite(baseDistance)) {
        viewData.baseDistance = baseDistance;
      }
      this.onViewChange(viewData);
    }
    applyViewState(view) {
      if (!view || typeof view !== 'object') return;
      const positionArray = normalizeVectorArray(view.position);
      const targetArray = normalizeVectorArray(view.target);
      if (!positionArray && !targetArray) return;
      if (positionArray) {
        this.camera.position.set(positionArray[0], positionArray[1], positionArray[2]);
      }
      let targetVector = null;
      if (targetArray) {
        targetVector = new THREE.Vector3(targetArray[0], targetArray[1], targetArray[2]);
        if (this.controls) {
          this.controls.target.copy(targetVector);
        }
        if (!this.currentFrame) this.currentFrame = {};
        if (this.currentFrame.center) {
          this.currentFrame.center.copy(targetVector);
        } else {
          this.currentFrame.center = targetVector.clone();
        }
        this.camera.lookAt(targetVector);
      } else if (this.currentFrame && this.currentFrame.center) {
        targetVector = this.currentFrame.center.clone();
      }
      if (!this.currentFrame) {
        this.currentFrame = {
          center: targetVector ? targetVector.clone() : null
        };
      }
      const providedDistance = Number.isFinite(view.distance) ? Number(view.distance) : null;
      if (providedDistance != null) {
        this.currentFrame.distance = providedDistance;
      } else if (targetVector) {
        this.currentFrame.distance = this.camera.position.distanceTo(targetVector);
      }
      const providedBase = Number.isFinite(view.baseDistance) ? Number(view.baseDistance) : null;
      if (providedBase != null) {
        this.currentFrame.baseDistance = providedBase;
      } else if (this.currentFrame.distance != null && !Number.isFinite(this.currentFrame.baseDistance)) {
        this.currentFrame.baseDistance = this.currentFrame.distance;
      }
      const base = this.currentFrame && Number.isFinite(this.currentFrame.baseDistance) ? this.currentFrame.baseDistance : this.currentFrame && Number.isFinite(this.currentFrame.distance) ? this.currentFrame.distance : undefined;
      this._updateControlsDistances(base, this.currentFrame ? this.currentFrame.distance : undefined);
      if (this.controls) {
        this.controls.update();
      } else if (targetVector) {
        this.camera.lookAt(targetVector);
      }
      this._emitViewChange();
    }
    setViewChangeCallback(callback) {
      this.onViewChange = typeof callback === 'function' ? callback : null;
      this._emitViewChange();
    }
    _applyMaterialAppearance() {
      if (!this.currentShape) return;
      const override = this.materialColorOverride;
      const opacity = THREE.MathUtils.clamp(this.materialOpacity, 0.05, 1);
      this.currentShape.traverse(node => {
        const matRef = node.material;
        if (!matRef) return;
        const materials = Array.isArray(matRef) ? matRef : [matRef];
        materials.forEach(material => {
          if (!material || !material.userData || !material.userData.isShapeMaterial) return;
          const baseColor = material.userData.baseColor;
          const target = override !== null && override !== void 0 ? override : baseColor;
          if (typeof target === 'number' && material.color) {
            material.color.setHex(target);
          }
          material.opacity = opacity;
          material.transparent = opacity < 0.999;
          material.depthWrite = opacity >= 0.98;
          material.needsUpdate = true;
        });
      });
    }
    setMaterialColorOverride(color) {
      if (color == null) {
        this.materialColorOverride = null;
      } else if (typeof color === 'number' && Number.isFinite(color)) {
        this.materialColorOverride = color;
      } else {
        return;
      }
      this._applyMaterialAppearance();
    }
    setMaterialOpacity(opacity) {
      if (!(opacity > 0)) {
        this.materialOpacity = 0.05;
      } else {
        this.materialOpacity = Math.min(Math.max(opacity, 0.05), 1);
      }
      this._applyMaterialAppearance();
    }
    getBackgroundColorHex() {
      if (this.scene && this.scene.background && typeof this.scene.background.getHexString === 'function') {
        return `#${this.scene.background.getHexString()}`;
      }
      return '#ffffff';
    }
    captureSnapshot() {
      if (!this.renderer || !this.renderer.domElement) return null;
      const sourceCanvas = this.renderer.domElement;
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      if (!(width > 0 && height > 0)) return null;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = width;
      exportCanvas.height = height;
      const context = exportCanvas.getContext('2d');
      if (!context) return null;
      const exportColorHex = '#ffffff';
      const exportColorValue = 0xffffff;
      const originalBackground = this.scene ? this.scene.background : null;
      const hasSetClearColor = this.renderer && typeof this.renderer.setClearColor === 'function';
      const originalClearColorValue = typeof this.renderer.getClearColor === 'function'
        ? this.renderer.getClearColor(new THREE.Color()).getHex()
        : null;
      const originalClearAlpha = typeof this.renderer.getClearAlpha === 'function'
        ? this.renderer.getClearAlpha()
        : null;
      if (this.scene) {
        this.scene.background = new THREE.Color(exportColorValue);
      }
      if (hasSetClearColor) {
        this.renderer.setClearColor(exportColorValue, 1);
      }
      let background = exportColorHex;
      let result = null;
      try {
        const detectedBackground = this.getBackgroundColorHex();
        if (typeof detectedBackground === 'string' && detectedBackground.trim()) {
          background = detectedBackground.trim();
        }
        this.renderer.render(this.scene, this.camera);
        context.save();
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.restore();
        context.drawImage(sourceCanvas, 0, 0, width, height);
        result = {
          canvas: exportCanvas,
          width,
          height,
          background
        };
      } finally {
        if (this.scene) {
          if (originalBackground === undefined) {
            this.scene.background = null;
          } else {
            this.scene.background = originalBackground;
          }
        }
        if (hasSetClearColor && originalClearColorValue !== null) {
          const alpha = typeof originalClearAlpha === 'number' ? originalClearAlpha : 1;
          this.renderer.setClearColor(originalClearColorValue, alpha);
        }
      }
      return result;
    }
    createMaterial(color) {
      const override = this.materialColorOverride;
      const opacity = THREE.MathUtils.clamp(this.materialOpacity, 0.05, 1);
      const finalColor = typeof override === 'number' ? override : color;
      const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        metalness: 0,
        roughness: 0.36,
        flatShading: true,
        transparent: opacity < 0.999,
        opacity,
        depthWrite: opacity >= 0.98
      });
      material.userData.baseColor = color;
      material.userData.isShapeMaterial = true;
      return material;
    }
    createEdges(geometry, color = 0x1f2937) {
      return new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({
        color
      }));
    }
    createLabelSprite(text) {
      if (typeof text !== 'string') return null;
      const trimmed = text.trim();
      if (!trimmed) return null;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      const fontSize = 48;
      const paddingX = 26;
      const paddingY = 18;
      context.font = `${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      const metrics = context.measureText(trimmed);
      const rawWidth = metrics.width + paddingX * 2;
      const rawHeight = fontSize + paddingY * 2;
      const deviceRatio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const ratio = Math.min(Math.max(deviceRatio, 1), 2);
      canvas.width = Math.ceil(rawWidth * ratio);
      canvas.height = Math.ceil(rawHeight * ratio);
      context.scale(ratio, ratio);
      context.font = `${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const width = rawWidth;
      const height = rawHeight;
      const borderRadius = Math.min(18, Math.min(width, height) / 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.96)';
      context.strokeStyle = 'rgba(148, 163, 184, 0.85)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(borderRadius, 0);
      context.lineTo(width - borderRadius, 0);
      context.quadraticCurveTo(width, 0, width, borderRadius);
      context.lineTo(width, height - borderRadius);
      context.quadraticCurveTo(width, height, width - borderRadius, height);
      context.lineTo(borderRadius, height);
      context.quadraticCurveTo(0, height, 0, height - borderRadius);
      context.lineTo(0, borderRadius);
      context.quadraticCurveTo(0, 0, borderRadius, 0);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#111827';
      context.fillText(trimmed, width / 2, height / 2 + 2);
      const texture = new THREE.CanvasTexture(canvas);
      if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(material);
      const worldScale = 0.0052;
      sprite.scale.set(width * worldScale, height * worldScale, 1);
      sprite.renderOrder = 10;
      sprite.userData.isMeasurement = true;
      return sprite;
    }
    createThickSegmentMesh(start, end, thickness, material) {
      if (!start || !end || !material) return null;
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (!(length > 1e-4)) return null;
      const geometry = new THREE.BoxGeometry(thickness, length, thickness);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
      const up = new THREE.Vector3(0, 1, 0);
      const normalizedDirection = direction.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normalizedDirection);
      mesh.setRotationFromQuaternion(quaternion);
      mesh.renderOrder = 10;
      mesh.userData.isMeasurement = true;
      return mesh;
    }
    addMeasurementLine(targetGroup, start, end, options = {}) {
      var _options$color;
      if (!targetGroup || !start || !end) return;
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (!(length > 1e-4)) return;
      const color = (_options$color = options.color) !== null && _options$color !== void 0 ? _options$color : 0x111827;
      const thickness = typeof options.thickness === 'number' && options.thickness > 0 ? options.thickness : 0.028;
      const lineMaterial = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      });
      lineMaterial.polygonOffset = true;
      lineMaterial.polygonOffsetFactor = -1;
      lineMaterial.polygonOffsetUnits = -1;
      const measurementGroup = new THREE.Group();
      measurementGroup.userData.isMeasurement = true;
      const mainMesh = this.createThickSegmentMesh(start, end, thickness, lineMaterial);
      if (mainMesh) {
        measurementGroup.add(mainMesh);
      }
      const markerLength = options.markerLength && options.markerLength > 0 ? options.markerLength : Math.min(Math.max(length * 0.25, 0.16), 0.35);
      const normalizedDirection = direction.clone().normalize();
      const tempVector = new THREE.Vector3(0, 1, 0);
      let markerDirection = new THREE.Vector3().crossVectors(normalizedDirection, tempVector);
      if (markerDirection.lengthSq() < 1e-6) {
        markerDirection.crossVectors(normalizedDirection, new THREE.Vector3(1, 0, 0));
      }
      if (markerDirection.lengthSq() < 1e-6) {
        markerDirection.crossVectors(normalizedDirection, new THREE.Vector3(0, 0, 1));
      }
      if (markerDirection.lengthSq() < 1e-6) {
        markerDirection = new THREE.Vector3(1, 0, 0);
      }
      markerDirection.normalize().multiplyScalar(markerLength / 2);
      const markerPoints = [start.clone().add(markerDirection), start.clone().sub(markerDirection), end.clone().add(markerDirection), end.clone().sub(markerDirection)];
      for (let i = 0; i < markerPoints.length; i += 2) {
        const markerMesh = this.createThickSegmentMesh(markerPoints[i], markerPoints[i + 1], thickness, lineMaterial);
        if (markerMesh) {
          measurementGroup.add(markerMesh);
        }
      }
      targetGroup.add(measurementGroup);
      const labelText = typeof options.label === 'string' ? options.label.trim() : '';
      if (labelText.length) {
        const sprite = this.createLabelSprite(labelText);
        if (sprite) {
          sprite.userData.isMeasurement = true;
          if (options.labelPosition) {
            sprite.position.copy(options.labelPosition.clone());
          } else {
            const mid = start.clone().add(end).multiplyScalar(0.5);
            if (options.labelOffset) {
              mid.add(options.labelOffset.clone());
            }
            sprite.position.copy(mid);
          }
          measurementGroup.add(sprite);
        }
      }
    }
    addRadiusMeasurement(targetGroup, dims, spec, type) {
      const radiusValue = typeof dims.radius === 'number' && Number.isFinite(dims.radius) ? dims.radius : null;
      if (!(radiusValue > 0)) return;
      const label = typeof (spec === null || spec === void 0 ? void 0 : spec.label) === 'string' ? spec.label : '';
      const hasLabel = label.trim().length > 0;
      let start;
      let end;
      let labelOffset = null;
      if (type === 'sphere') {
        start = new THREE.Vector3(0, radiusValue, 0);
        end = new THREE.Vector3(radiusValue, radiusValue, 0);
        if (hasLabel) {
          labelOffset = new THREE.Vector3(0, 0.24, 0);
        }
      } else {
        const heightValue = typeof dims.height === 'number' && Number.isFinite(dims.height) ? dims.height : null;
        let baseY;
        if (type === 'cone') {
          const minLift = 0.02;
          const ratioLift = heightValue && heightValue > 0 ? heightValue * 0.005 : minLift;
          baseY = Math.max(ratioLift, minLift);
          if (heightValue && heightValue > minLift) {
            const maxAllowed = heightValue - 0.15;
            if (maxAllowed > minLift) {
              baseY = Math.min(baseY, maxAllowed);
            }
          }
        } else {
          baseY = 0.2;
          if (heightValue && heightValue > 0.2) {
            baseY = Math.min(Math.max(heightValue * 0.12, 0.15), heightValue - 0.15);
          }
        }
        start = new THREE.Vector3(0, baseY, 0);
        end = new THREE.Vector3(radiusValue, baseY, 0);
        if (hasLabel) {
          labelOffset = new THREE.Vector3(0, 0.22, 0);
        }
      }
      const options = {
        color: 0xef4444,
        label
      };
      if (labelOffset) options.labelOffset = labelOffset;
      this.addMeasurementLine(targetGroup, start, end, options);
    }
    addHeightMeasurement(targetGroup, dims, spec) {
      const heightValue = typeof dims.height === 'number' && Number.isFinite(dims.height) ? dims.height : null;
      if (!(heightValue > 0)) return;
      const label = typeof (spec === null || spec === void 0 ? void 0 : spec.label) === 'string' ? spec.label : '';
      const radiusValue = typeof dims.radius === 'number' && Number.isFinite(dims.radius) ? dims.radius : null;
      const halfWidth = typeof dims.width === 'number' && Number.isFinite(dims.width) ? dims.width / 2 : null;
      const halfDepth = typeof dims.depth === 'number' && Number.isFinite(dims.depth) ? dims.depth / 2 : null;
      let offset = radiusValue;
      if (!(offset > 0)) {
        const extent = Math.max(halfWidth || 0, halfDepth || 0);
        offset = extent;
      }
      if (!(offset > 0)) offset = 1.2;
      const margin = 0.35;
      const lineX = offset + margin;
      const start = new THREE.Vector3(lineX, 0, 0);
      const end = new THREE.Vector3(lineX, heightValue, 0);
      let labelPosition = null;
      if (label.trim().length) {
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const center = new THREE.Vector3(0, heightValue / 2, 0);
        const away = start.clone().sub(center);
        away.y = 0;
        if (!away.lengthSq()) {
          away.set(0.3, 0, 0);
        } else {
          away.setLength(0.35);
        }
        away.y = 0.18;
        labelPosition = midpoint.add(away);
      }
      const options = {
        color: 0xf97316,
        label
      };
      if (labelPosition) options.labelPosition = labelPosition;
      this.addMeasurementLine(targetGroup, start, end, options);
    }
    applyMeasurements(group, spec, dims, type) {
      if (!group || !spec || typeof spec !== 'object') return;
      const dimensionSpec = spec.dimensions;
      if (!dimensionSpec) return;
      const measurementGroup = new THREE.Group();
      measurementGroup.name = 'measurements';
      measurementGroup.userData.isMeasurement = true;
      if (dimensionSpec.radius && dimensionSpec.radius.requested) {
        this.addRadiusMeasurement(measurementGroup, dims, dimensionSpec.radius, type);
      }
      if (dimensionSpec.height && dimensionSpec.height.requested) {
        this.addHeightMeasurement(measurementGroup, dims, dimensionSpec.height, type);
      }
      if (measurementGroup.children.length) {
        group.add(measurementGroup);
      }
    }
    createShape(spec) {
      const resolvedType = spec && typeof spec === 'object' && spec.type ? spec.type : spec;
      const type = typeof resolvedType === 'string' ? resolvedType : 'prism';
      const group = new THREE.Group();
      const dims = {
        radius: null,
        height: null,
        width: null,
        depth: null
      };
      let geometry;
      let rotationY = 0;
      let materialColor = 0x3b82f6;
      const dimensionSpec = spec && typeof spec === 'object' && spec.dimensions && typeof spec.dimensions === 'object' ? spec.dimensions : null;
      const extractDimensionValue = key => {
        if (!dimensionSpec || typeof key !== 'string') return null;
        const entry = dimensionSpec[key];
        if (!entry || typeof entry !== 'object') return null;
        if (typeof entry.value === 'number' && Number.isFinite(entry.value)) {
          return entry.value;
        }
        if (typeof entry.label === 'string') {
          const normalized = entry.label.replace(/,/g, '.');
          const matchNumber = normalized.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
          if (matchNumber) {
            const parsed = Number.parseFloat(matchNumber[0]);
            if (Number.isFinite(parsed)) {
              return parsed;
            }
          }
        }
        return null;
      };
      const resolvePositive = (value, fallback) => {
        if (Number.isFinite(value) && value > 0) return value;
        return fallback;
      };
      switch (type) {
        case 'sphere':
          {
            const radius = resolvePositive(extractDimensionValue('radius'), 1.35);
            geometry = new THREE.SphereGeometry(radius, 40, 32);
            geometry.translate(0, radius, 0);
            materialColor = 0x6366f1;
            dims.radius = radius;
            dims.height = radius * 2;
            break;
          }
        case 'pyramid':
          {
            const height = resolvePositive(extractDimensionValue('height'), 2.8);
            const radius = resolvePositive(extractDimensionValue('radius'), 1.7);
            geometry = new THREE.ConeGeometry(radius, height, 4, 1);
            geometry.translate(0, height / 2, 0);
            rotationY = Math.PI / 4;
            materialColor = 0xf59e0b;
            dims.radius = radius;
            dims.height = height;
            const baseWidth = Math.sqrt(2) * radius;
            dims.width = baseWidth;
            dims.depth = baseWidth;
            break;
          }
        case 'cone':
          {
            const height = resolvePositive(extractDimensionValue('height'), 3);
            const radius = resolvePositive(extractDimensionValue('radius'), 1.5);
            geometry = new THREE.ConeGeometry(radius, height, 48, 1);
            geometry.translate(0, height / 2, 0);
            materialColor = 0xf97316;
            dims.radius = radius;
            dims.height = height;
            const diameter = radius * 2;
            dims.width = diameter;
            dims.depth = diameter;
            break;
          }
        case 'triangular-cylinder':
          {
            const height = resolvePositive(extractDimensionValue('height'), 3);
            const radius = resolvePositive(extractDimensionValue('radius'), 1.6);
            geometry = new THREE.CylinderGeometry(radius, radius, height, 3, 1, false);
            geometry.translate(0, height / 2, 0);
            rotationY = Math.PI / 6;
            materialColor = 0x0ea5e9;
            dims.radius = radius;
            dims.height = height;
            dims.width = radius * 2;
            dims.depth = radius * 2;
            break;
          }
        case 'square-cylinder':
          {
            const height = resolvePositive(extractDimensionValue('height'), 3.2);
            const radius = resolvePositive(extractDimensionValue('radius'), 1.55);
            geometry = new THREE.CylinderGeometry(radius, radius, height, 4, 1, false);
            geometry.translate(0, height / 2, 0);
            rotationY = Math.PI / 4;
            materialColor = 0x10b981;
            dims.radius = radius;
            dims.height = height;
            dims.width = radius * 2;
            dims.depth = radius * 2;
            break;
          }
        case 'cylinder':
          {
            const height = resolvePositive(extractDimensionValue('height'), 3.2);
            const radius = resolvePositive(extractDimensionValue('radius'), 1.6);
            geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, false);
            geometry.translate(0, height / 2, 0);
            materialColor = 0x0ea5e9;
            dims.radius = radius;
            dims.height = height;
            dims.width = radius * 2;
            dims.depth = radius * 2;
            break;
          }
        case 'prism':
        default:
          {
            const width = 2.6;
            const height = resolvePositive(extractDimensionValue('height'), 2.2);
            const depth = 1.8;
            geometry = new THREE.BoxGeometry(width, height, depth);
            geometry.translate(0, height / 2, 0);
            materialColor = 0x3b82f6;
            dims.height = height;
            dims.width = width;
            dims.depth = depth;
            break;
          }
      }
      const mesh = new THREE.Mesh(geometry, this.createMaterial(materialColor));
      group.add(mesh);
      if (type !== 'sphere') {
        const edges = this.createEdges(geometry);
        group.add(edges);
      }
      this.applyMeasurements(group, spec && typeof spec === 'object' ? spec : null, dims, type);
      group.rotation.y = rotationY;
      return group;
    }
    setShape(spec) {
      this.disposeCurrentShape();
      if (!spec) return;
      this.currentShape = this.createShape(spec);
      this.shapeGroup.add(this.currentShape);
      this._applyFloatingOffset();
      this._applyMaterialAppearance();
      this.frameCurrentShape();
    }
    clear() {
      this.disposeCurrentShape();
    }
  }
  const grid = document.getElementById('figureGrid');
  const shapeKeyboardHintEl = ensureHiddenHint(SHAPE_KEYBOARD_HINT_ID, 'Fokuser figuren og bruk piltastene for å rotere. Bruk Page Up eller + for å zoome inn, Page Down eller - for å zoome ut. Trykk Home for å tilbakestille visningen.', grid ? grid.parentElement : null);
  const figureWrappers = Array.from(document.querySelectorAll('#figureGrid > .figure[data-figure-index]'));
  const rendererCount = figureWrappers.length;
  if (shapeKeyboardHintEl && grid) {
    grid.setAttribute('aria-describedby', SHAPE_KEYBOARD_HINT_ID);
  }
  let activeViewIndex = 0;
  function ensureViewStateCapacity() {
    if (!window.STATE || typeof window.STATE !== 'object') {
      window.STATE = {};
    }
    if (!Array.isArray(window.STATE.views)) {
      window.STATE.views = [];
    }
    while (window.STATE.views.length < rendererCount) {
      window.STATE.views.push(null);
    }
    if (window.STATE.views.length > rendererCount) {
      window.STATE.views.length = rendererCount;
    }
    let storedIndex = Number(window.STATE.lastViewIndex);
    if (!Number.isInteger(storedIndex)) {
      storedIndex = sanitizeViewIndex(activeViewIndex);
    } else {
      storedIndex = sanitizeViewIndex(storedIndex);
    }
    activeViewIndex = storedIndex;
    window.STATE.lastViewIndex = storedIndex;
  }
  function storeViewState(index, view) {
    ensureViewStateCapacity();
    const targetIndex = sanitizeViewIndex(index);
    if (!view || typeof view !== 'object') {
      window.STATE.views[index] = null;
      if (targetIndex === getActiveViewIndex()) {
        updateViewControlsUI(targetIndex);
      }
      return;
    }
    const position = normalizeVectorArray(view.position);
    const target = normalizeVectorArray(view.target);
    if (!position && !target) {
      window.STATE.views[index] = null;
      if (targetIndex === getActiveViewIndex()) {
        updateViewControlsUI(targetIndex);
      }
      return;
    }
    const stored = {};
    if (position) stored.position = position;
    if (target) stored.target = target;
    if (Number.isFinite(view.distance)) stored.distance = Number(view.distance);
    if (Number.isFinite(view.baseDistance)) stored.baseDistance = Number(view.baseDistance);
    window.STATE.views[index] = stored;
    if (targetIndex === getActiveViewIndex()) {
      updateViewControlsUI(targetIndex);
    }
  }
  const renderers = figureWrappers.map((wrapper, index) => {
    const canvasWrap = wrapper.querySelector('.figureCanvas');
    return new ShapeRenderer(canvasWrap, {
      onViewChange: view => storeViewState(index, view)
    });
  });
  figureWrappers.forEach((wrapper, index) => {
    wrapper.addEventListener('pointerdown', () => {
      setActiveViewIndex(index);
    });
  });
  function syncAllViewStates() {
    renderers.forEach(renderer => {
      if (renderer && typeof renderer.syncViewState === 'function') {
        renderer.syncViewState();
      }
    });
  }
  const handleExamplesLoaded = () => {
    ensureStateDefaults();
    syncControlsFromState();
    refreshAltText('examples-loaded');
  };
  function getStoredView(index) {
    ensureViewStateCapacity();
    const stored = window.STATE.views[index];
    if (!stored || typeof stored !== 'object') return null;
    const position = normalizeVectorArray(stored.position);
    const target = normalizeVectorArray(stored.target);
    if (!position && !target) return null;
    const view = {};
    if (position) view.position = position;
    if (target) view.target = target;
    if (Number.isFinite(stored.distance)) view.distance = Number(stored.distance);
    if (Number.isFinite(stored.baseDistance)) view.baseDistance = Number(stored.baseDistance);
    return view;
  }
  function applyStoredView(index) {
    const renderer = renderers[index];
    if (!renderer || typeof renderer.applyViewState !== 'function') return;
    const view = getStoredView(index);
    if (!view) return;
    renderer.applyViewState(view);
  }
  const textarea = document.getElementById('inpSpecs');
  const drawBtn = document.getElementById('btnDraw');
  const lockRotationCheckbox = document.getElementById('chkLockRotation');
  const freeFigureCheckbox = document.getElementById('chkFreeFigure');
  const fillColorPicker = document.querySelector('[data-fill-color-picker]');
  const colorInput = document.getElementById('inpColor');
  const colorResetBtn = document.getElementById('btnResetColor');
  const rotationRange = document.getElementById('rngViewRotation');
  const rotationLabel = document.getElementById('lblViewRotation');
  const elevationRange = document.getElementById('rngViewElevation');
  const elevationLabel = document.getElementById('lblViewElevation');
  const zoomRange = document.getElementById('rngViewZoom');
  const zoomLabel = document.getElementById('lblViewZoom');
  const viewFigureLabels = Array.from(document.querySelectorAll('[data-view-figure-label]'));
  const transparencyRange = document.getElementById('rngTransparency');
  const transparencyLabel = document.getElementById('lblTransparency');
  const exportCard = document.getElementById('exportCard');
  const exportRows = Array.from(document.querySelectorAll('[data-export-index]'));
  const exportButtons = Array.from(document.querySelectorAll('[data-export-button]'));
  const svgExportHelper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  let altTextManager = null;
  let altTextAnchor = null;
  function clampTransparency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.min(Math.max(num, 0), 95);
  }
  function parseColorHex(value) {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
    if (!match) return null;
    return parseInt(match[1], 16);
  }
  function getColorPickerHelper() {
    const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    if (scope && scope.MathVisualsColorPickerHelper) {
      return scope.MathVisualsColorPickerHelper;
    }
    if (typeof require === 'function') {
      try {
        return require('./colorpicker-helper.js');
      } catch (_) {}
    }
    return null;
  }
  const FALLBACK_COLOR_OPTIONS = ['#3b82f6', '#f97316', '#10b981', '#ef4444', '#6366f1', '#0ea5e9'];
  const DEFAULT_GRAFTEGNER_COLOR_ROLES = [
    { fillIndex: 5, lineIndex: 4 },
    { fillIndex: 7, lineIndex: 6 },
    { fillIndex: 9, lineIndex: 8 },
    { fillIndex: 10, lineIndex: 11 },
    { fillIndex: 12, lineIndex: 13 },
    { fillIndex: 14, lineIndex: 15 }
  ];
  const colorPickerHelper = getColorPickerHelper();
  function getPaletteApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsPalette;
    return api && typeof api.getGroupPalette === 'function' ? api : null;
  }
  function resolvePaletteConfig() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const config = scope.MathVisualsPaletteConfig;
      if (config && typeof config === 'object') {
        return config;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/palette-config.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }
  let paletteConfigResolved = false;
  let paletteConfigCache = null;
  function getPaletteConfig() {
    if (!paletteConfigResolved) {
      paletteConfigResolved = true;
      paletteConfigCache = resolvePaletteConfig();
    }
    return paletteConfigCache;
  }
  function normalizeHexColor(color) {
    if (typeof color !== 'string') return null;
    const trimmed = color.trim();
    if (!trimmed) return null;
    const hex = trimmed.replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return '#' + hex.split('').map(ch => ch + ch).join('').toLowerCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return '#' + hex.toLowerCase();
    }
    return null;
  }
  function isValidColor(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }
  function getGraftegnerRoleSlotPairs() {
    const config = getPaletteConfig();
    if (colorPickerHelper && typeof colorPickerHelper.resolveRoleSlotPairs === 'function') {
      return colorPickerHelper.resolveRoleSlotPairs(config, 'graftegner', DEFAULT_GRAFTEGNER_COLOR_ROLES);
    }
    const pairs = [];
    for (let index = 0; index < FALLBACK_COLOR_OPTIONS.length; index += 1) {
      pairs.push({
        fillSlotIndex: index * 2,
        lineSlotIndex: index * 2 + 1
      });
    }
    return pairs;
  }
  function getLineFillPalettes() {
    const paletteApi = getPaletteApi();
    let colors = [];
    if (paletteApi) {
      try {
        colors = paletteApi.getGroupPalette('graftegner', { count: 12 });
      } catch (_) {
        colors = [];
      }
    }
    const sanitized = Array.isArray(colors) ? colors.filter(isValidColor) : [];
    const fillColors = [];
    const lineColors = [];
    const roleSlots = getGraftegnerRoleSlotPairs();
    if (sanitized.length && roleSlots.length) {
      roleSlots.forEach(role => {
        const fill = sanitized[role.fillSlotIndex];
        const line = sanitized[role.lineSlotIndex];
        fillColors.push(fill || line || FALLBACK_COLOR_OPTIONS[0]);
        lineColors.push(line || fill || '#000');
      });
    } else if (sanitized.length >= 2) {
      for (let index = 0; index < sanitized.length; index += 2) {
        const fill = sanitized[index];
        const line = sanitized[index + 1];
        fillColors.push(fill || line || FALLBACK_COLOR_OPTIONS[0]);
        lineColors.push(line || fill || '#000');
      }
    }
    let filtered = fillColors.length ? fillColors : FALLBACK_COLOR_OPTIONS.slice();
    const unique = [];
    const seen = new Set();
    filtered.forEach(color => {
      const normalized = normalizeHexColor(color) || color;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(color);
      }
    });
    const finalFillColors = unique.length ? unique : FALLBACK_COLOR_OPTIONS.slice();
    const finalLineColors = lineColors.length ? lineColors : finalFillColors.map(() => '#000');
    return { fillColors: finalFillColors, lineColors: finalLineColors };
  }
  function getFillPalette() {
    return getLineFillPalettes().fillColors;
  }
  function getLinePalette() {
    return getLineFillPalettes().lineColors;
  }
  function applyPairSwatch(element, fillColors, lineColors, index) {
    if (!element) return;
    const fillColor = fillColors[index - 1] || fillColors[0] || '#fff';
    const lineColor = lineColors[index - 1] || lineColors[0] || '#000';
    if (colorPickerHelper && typeof colorPickerHelper.renderColorPairSwatch === 'function') {
      colorPickerHelper.renderColorPairSwatch({
        element,
        fillIndex: index,
        lineIndex: index,
        fillColors,
        lineColors,
        fallbackFill: '#fff',
        fallbackLine: '#000'
      });
      return;
    }
    element.style.backgroundColor = fillColor;
    element.style.borderColor = lineColor;
  }
  function updateFillColorPickerActive() {
    if (!fillColorPicker) return;
    const activeButton = fillColorPicker.querySelector('.color-swatch--active');
    if (!activeButton) return;
    const current = colorInput && typeof colorInput.value === 'string' && colorInput.value ? colorInput.value : '#3b82f6';
    if (colorPickerHelper && typeof colorPickerHelper.applyColorPairSwatch === 'function') {
      colorPickerHelper.applyColorPairSwatch(activeButton, current, current);
    } else {
      activeButton.style.backgroundColor = current;
      activeButton.style.borderColor = current;
    }
  }
  function renderFillColorPicker() {
    if (!fillColorPicker) return;
    const activeButton = fillColorPicker.querySelector('.color-swatch--active');
    const optionsPanel = fillColorPicker.querySelector('.color-options');
    if (!activeButton || !optionsPanel) return;
    const paletteData = getLineFillPalettes();
    const palette = paletteData.fillColors;
    const linePalette = paletteData.lineColors;
    optionsPanel.innerHTML = '';
    palette.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-option-btn';
      applyPairSwatch(btn, palette, linePalette, index + 1);
      btn.dataset.color = color;
      btn.setAttribute('aria-label', `Velg farge ${index + 1}`);
      optionsPanel.appendChild(btn);
    });
    updateFillColorPickerActive();
    if (!fillColorPicker.dataset.bound) {
      fillColorPicker.dataset.bound = 'true';
      activeButton.addEventListener('click', () => {
        optionsPanel.hidden = !optionsPanel.hidden;
      });
      optionsPanel.addEventListener('click', evt => {
        const target = evt.target.closest('.color-option-btn');
        if (!target) return;
        const selected = target.dataset.color;
        if (selected) {
          if (colorInput) {
            colorInput.value = selected;
          }
          window.STATE.customColor = selected;
          window.STATE.useCustomColor = true;
          applyColor(true, selected);
          updateFillColorPickerActive();
        }
        optionsPanel.hidden = true;
      });
      document.addEventListener('click', event => {
        if (!fillColorPicker.contains(event.target)) {
          optionsPanel.hidden = true;
        }
      });
    }
  }
  function updateTransparencyLabel(value) {
    if (!transparencyLabel) return;
    const clamped = clampTransparency(value);
    transparencyLabel.textContent = `${clamped}%`;
  }
  const ELEVATION_MIN_DEGREES = -80;
  const ELEVATION_MAX_DEGREES = 80;
  function clampElevationDegrees(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num < ELEVATION_MIN_DEGREES) return ELEVATION_MIN_DEGREES;
    if (num > ELEVATION_MAX_DEGREES) return ELEVATION_MAX_DEGREES;
    return num;
  }
  function updateElevationLabel(value) {
    if (!elevationLabel) return;
    if (!Number.isFinite(value)) {
      elevationLabel.textContent = '–°';
      return;
    }
    const clamped = clampElevationDegrees(value);
    elevationLabel.textContent = `${Math.round(clamped)}°`;
  }
  function clampRotation(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    let normalized = num % 360;
    if (normalized < 0) normalized += 360;
    if (normalized < 0) normalized = 0;
    return normalized;
  }
  function updateRotationLabel(value) {
    if (!rotationLabel) return;
    if (!Number.isFinite(value)) {
      rotationLabel.textContent = '–°';
      return;
    }
    const normalized = clampRotation(value);
    rotationLabel.textContent = `${Math.round(normalized)}°`;
  }
  function clampZoomPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 100;
    return Math.min(Math.max(num, 40), 250);
  }
  function updateZoomLabel(value) {
    if (!zoomLabel) return;
    if (!Number.isFinite(value)) {
      zoomLabel.textContent = '–%';
      return;
    }
    const clamped = clampZoomPercent(value);
    zoomLabel.textContent = `${Math.round(clamped)}%`;
  }
  function updateViewFigureLabelText(index) {
    if (!viewFigureLabels.length) return;
    const hasIndex = Number.isInteger(index) && index >= 0;
    const labelText = hasIndex ? `Figur ${index + 1}` : 'Ingen figur';
    viewFigureLabels.forEach(node => {
      node.textContent = labelText;
    });
  }
  function sanitizeViewIndex(index) {
    if (!Number.isInteger(index)) return 0;
    if (index < 0) return 0;
    if (index >= rendererCount) {
      return rendererCount > 0 ? rendererCount - 1 : 0;
    }
    return index;
  }
  function hasFigureAtIndex(index) {
    const figures = getCurrentFigures();
    if (!Array.isArray(figures)) return false;
    return Boolean(figures[index]);
  }
  function findFirstVisibleFigureIndex() {
    const figures = getCurrentFigures();
    if (!Array.isArray(figures)) return null;
    for (let i = 0; i < figures.length; i += 1) {
      if (figures[i]) return i;
    }
    return null;
  }
  function getActiveViewIndex() {
    return sanitizeViewIndex(activeViewIndex);
  }
  function setActiveViewIndex(index, options = {}) {
    let target = sanitizeViewIndex(index);
    if (!hasFigureAtIndex(target)) {
      const first = findFirstVisibleFigureIndex();
      if (Number.isInteger(first)) {
        target = sanitizeViewIndex(first);
      }
    }
    const changed = target !== activeViewIndex;
    activeViewIndex = target;
    if (window.STATE && typeof window.STATE === 'object') {
      window.STATE.lastViewIndex = target;
    }
    if (options.force || changed) {
      updateViewControlsUI(target);
    }
  }
  function getRendererCameraView(index) {
    const renderer = renderers[index];
    if (!renderer || !renderer.camera) return null;
    const cameraPosition = renderer.camera.position;
    const targetVec = renderer.controls ? renderer.controls.target : renderer.currentFrame && renderer.currentFrame.center ? renderer.currentFrame.center : null;
    if (!targetVec) return null;
    const position = [cameraPosition.x, cameraPosition.y, cameraPosition.z];
    const target = [targetVec.x, targetVec.y, targetVec.z];
    const dx = position[0] - target[0];
    const dy = position[1] - target[1];
    const dz = position[2] - target[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    let baseDistance = renderer.currentFrame && Number.isFinite(renderer.currentFrame.baseDistance) ? renderer.currentFrame.baseDistance : distance;
    if (!(baseDistance > 0)) {
      baseDistance = distance > 0 ? distance : 1;
    }
    return {
      position,
      target,
      distance,
      baseDistance
    };
  }
  function getEffectiveView(index) {
    return getStoredView(index) || getRendererCameraView(index);
  }
  function computeRotationDegreesFromView(view) {
    if (!view) return null;
    const position = normalizeVectorArray(view.position);
    const target = normalizeVectorArray(view.target);
    if (!position || !target) return null;
    const dx = position[0] - target[0];
    const dz = position[2] - target[2];
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return 0;
    let angle = Math.atan2(dx, dz);
    if (!Number.isFinite(angle)) return 0;
    let degrees = THREE.MathUtils.radToDeg(angle);
    if (!Number.isFinite(degrees)) return 0;
    degrees %= 360;
    if (degrees < 0) degrees += 360;
    if (degrees < 0) degrees = 0;
    return degrees;
  }
  function computeZoomPercentFromView(view, renderer) {
    if (!view) return null;
    const distance = Number.isFinite(view.distance) ? Number(view.distance) : null;
    let base = Number.isFinite(view.baseDistance) ? Number(view.baseDistance) : null;
    if (!(base > 0) && renderer && renderer.currentFrame && Number.isFinite(renderer.currentFrame.baseDistance)) {
      base = renderer.currentFrame.baseDistance;
    }
    if (!(base > 0)) {
      if (distance && distance > 0) return 100;
      return null;
    }
    const effectiveDistance = distance && distance > 0 ? distance : base;
    return effectiveDistance / base * 100;
  }
  function computeElevationFromView(view) {
    if (!view) return 0;
    const position = normalizeVectorArray(view.position);
    const target = normalizeVectorArray(view.target);
    if (!position || !target) return 0;
    const dx = position[0] - target[0];
    const dy = position[1] - target[1];
    const dz = position[2] - target[2];
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    if (horizontal < 1e-6 && Math.abs(dy) < 1e-6) return 0;
    const angle = Math.atan2(dy, horizontal);
    if (!Number.isFinite(angle)) return 0;
    return angle;
  }
  function computeElevationDegreesFromView(view) {
    const radians = computeElevationFromView(view);
    if (!Number.isFinite(radians)) return 0;
    return THREE.MathUtils.radToDeg(radians);
  }
  function applyViewControlChanges(options = {}) {
    const index = getActiveViewIndex();
    const renderer = renderers[index];
    if (!renderer || !renderer.camera) return;
    if (!hasFigureAtIndex(index) || !renderer.currentShape) return;
    const view = getEffectiveView(index);
    if (!view) return;
    const target = normalizeVectorArray(view.target);
    const position = normalizeVectorArray(view.position);
    if (!target || !position) return;
    const rotationDeg = options.rotationDeg != null ? options.rotationDeg : computeRotationDegreesFromView(view);
    const zoomPercent = options.zoomPercent != null ? options.zoomPercent : computeZoomPercentFromView(view, renderer);
    const clampedRotation = clampRotation(rotationDeg);
    const clampedZoom = clampZoomPercent(zoomPercent);
    let baseDistance = Number.isFinite(view.baseDistance) ? Number(view.baseDistance) : null;
    if (!(baseDistance > 0) && renderer.currentFrame && Number.isFinite(renderer.currentFrame.baseDistance)) {
      baseDistance = renderer.currentFrame.baseDistance;
    }
    if (!(baseDistance > 0)) {
      const dx = position[0] - target[0];
      const dy = position[1] - target[1];
      const dz = position[2] - target[2];
      const fallback = Math.sqrt(dx * dx + dy * dy + dz * dz);
      baseDistance = fallback > 0 ? fallback : 3;
    }
    const baseElevationDeg = computeElevationDegreesFromView(view);
    const requestedElevationDeg = options.elevationDeg != null ? options.elevationDeg : baseElevationDeg;
    const clampedElevationDeg = clampElevationDegrees(Number.isFinite(requestedElevationDeg) ? requestedElevationDeg : 0);
    const elevation = THREE.MathUtils.degToRad(clampedElevationDeg);
    const distance = Math.max(baseDistance * (clampedZoom / 100), 0.2);
    const horizontal = Math.cos(elevation) * distance;
    const yaw = THREE.MathUtils.degToRad(clampedRotation);
    const newPosition = [target[0] + Math.sin(yaw) * horizontal, target[1] + Math.sin(elevation) * distance, target[2] + Math.cos(yaw) * horizontal];
    const newView = {
      position: newPosition,
      target: target.slice(),
      distance,
      baseDistance
    };
    renderer.applyViewState(newView);
  }
  function updateViewControlsUI(index) {
    const target = sanitizeViewIndex(index);
    const renderer = renderers[target];
    const figureExists = hasFigureAtIndex(target);
    updateViewFigureLabelText(figureExists ? target : null);
    const hasRenderable = figureExists && renderer && renderer.currentShape;
    if (rotationRange) {
      rotationRange.disabled = !hasRenderable;
    }
    if (elevationRange) {
      elevationRange.disabled = !hasRenderable;
    }
    if (zoomRange) {
      zoomRange.disabled = !hasRenderable;
    }
    if (!hasRenderable) {
      updateRotationLabel(Number.NaN);
      updateElevationLabel(Number.NaN);
      updateZoomLabel(Number.NaN);
      return;
    }
    const view = getEffectiveView(target);
    if (!view) {
      updateRotationLabel(Number.NaN);
      updateElevationLabel(Number.NaN);
      updateZoomLabel(Number.NaN);
      return;
    }
    const rotation = computeRotationDegreesFromView(view);
    const zoomPercent = computeZoomPercentFromView(view, renderer);
    const elevationDeg = computeElevationDegreesFromView(view);
    const rotationValue = Number.isFinite(rotation) ? rotation : 0;
    const elevationValue = Number.isFinite(elevationDeg) ? elevationDeg : 0;
    const zoomValue = Number.isFinite(zoomPercent) ? zoomPercent : 100;
    if (rotationRange) {
      const normalized = clampRotation(rotationValue);
      rotationRange.value = String(Math.round(normalized));
      updateRotationLabel(normalized);
    } else {
      updateRotationLabel(rotationValue);
    }
    if (elevationRange) {
      const clampedElevation = clampElevationDegrees(elevationValue);
      elevationRange.value = String(Math.round(clampedElevation));
      updateElevationLabel(clampedElevation);
    } else {
      updateElevationLabel(elevationValue);
    }
    if (zoomRange) {
      const clampedZoom = clampZoomPercent(zoomValue);
      zoomRange.value = String(Math.round(clampedZoom));
      updateZoomLabel(clampedZoom);
    } else {
      updateZoomLabel(zoomValue);
    }
  }
  function formatTypeLabel(type) {
    if (typeof type !== 'string' || !type) return '';
    switch (type) {
      case 'sphere':
        return 'kule';
      case 'pyramid':
        return 'pyramide';
      case 'cone':
        return 'kjegle';
      case 'triangular-cylinder':
        return 'trekantet sylinder';
      case 'square-cylinder':
        return 'firkantet sylinder';
      case 'cylinder':
        return 'sylinder';
      case 'prism':
        return 'prisme';
      default:
        return type.replace(/[-_]+/g, ' ');
    }
  }
  function getCurrentFigures() {
    if (window.STATE && Array.isArray(window.STATE.figures)) {
      return window.STATE.figures;
    }
    return [];
  }
  function getFigureDisplayLabel(info, index) {
    if (!info) return `Figur ${index + 1}`;
    const rawInput = typeof info.input === 'string' ? info.input.trim() : '';
    if (rawInput) {
      return `Figur ${index + 1}: ${rawInput}`;
    }
    const typeLabel = formatTypeLabel(info.type);
    if (typeLabel) {
      return `Figur ${index + 1}: ${typeLabel}`;
    }
    return `Figur ${index + 1}`;
  }
  function getExportFileBase(info, index) {
    if (!info) {
      return `figur-${index + 1}`;
    }
    const rawInput = typeof info.input === 'string' ? info.input.trim() : '';
    if (rawInput) {
      return rawInput;
    }
    const typeLabel = formatTypeLabel(info.type);
    if (typeLabel) {
      return typeLabel;
    }
    return `figur-${index + 1}`;
  }
  function toSafeFileName(parts) {
    const usable = parts.filter(part => typeof part === 'string' && part.trim().length).map(part => part.trim());
    if (!usable.length) {
      return 'figur';
    }
    let combined = usable.join('-');
    if (typeof combined.normalize === 'function') {
      combined = combined.normalize('NFKD');
    }
    combined = combined.replace(/[\u0300-\u036f]/g, '');
    const sanitized = combined.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return sanitized || 'figur';
  }
  function getExportFileName(index, format) {
    const figures = getCurrentFigures();
    const info = figures[index];
    const base = getExportFileBase(info, index);
    const identifier = `figur-${index + 1}`;
    const parts = base && base.toLowerCase() === identifier ? [identifier] : [identifier, base];
    const safe = toSafeFileName(parts);
    const extension = typeof format === 'string' ? format.toLowerCase() : 'png';
    return `${safe}.${extension}`;
  }
  function canvasToBlob(canvas) {
    return new Promise(resolve => {
      if (!canvas) {
        resolve(null);
        return;
      }
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(blob => {
          resolve(blob || null);
        }, 'image/png');
        return;
      }
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const commaIndex = dataUrl.indexOf(',');
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], {
          type: 'image/png'
        }));
      } catch (error) {
        console.warn('Klarte ikke konvertere canvas til PNG.', error);
        resolve(null);
      }
    });
  }
  function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'figur.png';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    requestAnimationFrame(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }
  function createSvgFromImage(pngDataUrl, width, height, background) {
    if (typeof pngDataUrl !== 'string' || !pngDataUrl) return null;
    if (!(width > 0) || !(height > 0)) return null;
    const safeBackground = typeof background === 'string' && background.trim() ? background.trim() : '#ffffff';
    return `<?xml version="1.0" encoding="UTF-8"?>\n` + `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` + `  <rect width="100%" height="100%" fill="${safeBackground}" />\n` + `  <image width="${width}" height="${height}" href="${pngDataUrl}" xlink:href="${pngDataUrl}" preserveAspectRatio="none" />\n` + `</svg>`;
  }

  function buildFigureExportMeta(info, index) {
    const fallbackFileName = getExportFileName(index, 'svg');
    const fallbackBase = typeof fallbackFileName === 'string'
      ? fallbackFileName.replace(/\.svg$/i, '')
      : `figur-${index + 1}`;
    const label = getFigureDisplayLabel(info, index);
    const typeLabel = formatTypeLabel(info && info.type);
    const slugSourceParts = ['trefigurer'];
    if (label) slugSourceParts.push(label);
    if (typeLabel) slugSourceParts.push(typeLabel);
    const slugSource = slugSourceParts.join(' ').trim() || fallbackBase;
    const defaultBaseName = svgExportHelper && typeof svgExportHelper.slugify === 'function'
      ? svgExportHelper.slugify(slugSource, fallbackBase || `figur-${index + 1}`)
      : (slugSource || `figur-${index + 1}`).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || `figur-${index + 1}`;
    const description = describeFigure(info) || (label ? `${label}.` : '3D-figur.');
    const transparencyValue = Number(window.STATE && window.STATE.transparency);
    const summary = {
      index: index + 1,
      type: info && typeof info.type === 'string' ? info.type : null,
      input: info && typeof info.input === 'string' ? info.input : null,
      dimensions: info && info.dimensions ? {
        radius: info.dimensions.radius || null,
        height: info.dimensions.height || null
      } : null,
      floating: Boolean(window.STATE && window.STATE.freeFigure),
      rotationLocked: Boolean(window.STATE && window.STATE.rotationLocked),
      transparency: Number.isFinite(transparencyValue) ? transparencyValue : null,
      useCustomColor: Boolean(window.STATE && window.STATE.useCustomColor),
      customColor: window.STATE && window.STATE.useCustomColor ? window.STATE.customColor || null : null
    };
    return {
      description,
      defaultBaseName,
      summary,
      title: label || `Figur ${index + 1}`
    };
  }
  function updateExportControls(figures) {
    if (!exportCard) return;
    const hasAny = Array.isArray(figures) && figures.some(item => Boolean(item));
    exportCard.style.display = hasAny ? '' : 'none';
    exportRows.forEach(row => {
      const index = Number(row.dataset.exportIndex);
      const info = Array.isArray(figures) ? figures[index] : undefined;
      const labelEl = row.querySelector('[data-export-label]');
      const buttons = Array.from(row.querySelectorAll('[data-export-button]'));
      if (info) {
        row.classList.remove('is-hidden');
        if (labelEl) {
          labelEl.textContent = getFigureDisplayLabel(info, index);
        }
        buttons.forEach(btn => {
          btn.disabled = false;
        });
      } else {
        row.classList.add('is-hidden');
        if (labelEl) {
          labelEl.textContent = `Figur ${index + 1}`;
        }
        buttons.forEach(btn => {
          btn.disabled = true;
        });
      }
    });
  }

  const numberFormatter = typeof Intl === 'object' && typeof Intl.NumberFormat === 'function' ? new Intl.NumberFormat('no-NO', {
    maximumFractionDigits: 2
  }) : null;

  function formatDimensionNumber(value) {
    if (!Number.isFinite(value)) return '';
    const formatted = numberFormatter ? numberFormatter.format(value) : String(value);
    return formatted.replace(/\s+/g, '\u00a0');
  }

  function describeDimensionEntry(kind, entry) {
    if (!entry || typeof entry !== 'object') return '';
    const dimensionName = kind === 'radius' ? 'radius' : 'høyde';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const hasLabel = Boolean(label);
    const value = Number.isFinite(entry.value) ? entry.value : null;
    const formattedValue = value != null ? formatDimensionNumber(value) : '';
    if (formattedValue && hasLabel && label !== formattedValue) {
      if (/^[a-zA-ZæøåÆØÅ]$/.test(label)) {
        return `${dimensionName} merket ${label} (${formattedValue})`;
      }
      return `${dimensionName} ${label} (${formattedValue})`;
    }
    if (formattedValue) {
      return `${dimensionName} ${formattedValue}`;
    }
    if (hasLabel) {
      if (/^[a-zA-ZæøåÆØÅ]$/.test(label)) {
        return `${dimensionName} merket ${label}`;
      }
      return `${dimensionName} ${label}`;
    }
    return dimensionName;
  }

  function describeDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== 'object') return '';
    const parts = [];
    if (dimensions.radius) {
      const radiusText = describeDimensionEntry('radius', dimensions.radius);
      if (radiusText) parts.push(radiusText);
    }
    if (dimensions.height) {
      const heightText = describeDimensionEntry('height', dimensions.height);
      if (heightText) parts.push(heightText);
    }
    if (!parts.length) return '';
    if (parts.length === 1) return `med ${parts[0]}`;
    if (parts.length === 2) return `med ${parts[0]} og ${parts[1]}`;
    return `med ${parts.join(', ')}`;
  }

  function getFigureArticle(typeLabel) {
    if (typeLabel === 'prisme') return 'et';
    return 'en';
  }

  function describeFigure(info) {
    const typeLabel = formatTypeLabel(info && info.type) || 'romfigur';
    const article = getFigureArticle(typeLabel);
    const dimensionText = describeDimensions(info && info.dimensions);
    const base = `${article} ${typeLabel}`.trim();
    const capitalized = base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
    if (dimensionText) {
      return `${capitalized} ${dimensionText}.`;
    }
    return capitalized ? `${capitalized}.` : '';
  }

  function getTrefigurerTitle() {
    const baseTitle = typeof document !== 'undefined' && document && document.title ? document.title : 'Trefigurer';
    const figures = getCurrentFigures();
    const count = Array.isArray(figures) ? figures.filter(Boolean).length : 0;
    if (count <= 0) return baseTitle;
    const suffix = count === 1 ? '1 figur' : `${count} figurer`;
    return `${baseTitle} – ${suffix}`;
  }

  function buildTrefigurerAltText() {
    const figures = getCurrentFigures();
    const list = Array.isArray(figures) ? figures : [];
    const visibleCount = list.filter(Boolean).length;
    if (!visibleCount) {
      return 'Ingen modeller.';
    }
    const sentences = [];
    list.forEach(info => {
      if (!info) return;
      const sentence = describeFigure(info);
      if (sentence) {
        sentences.push(sentence);
      }
    });
    if (window.STATE && window.STATE.freeFigure) {
      sentences.push('Fri flytting.');
    }
    if (window.STATE && window.STATE.rotationLocked) {
      sentences.push('Rotasjon låst.');
    }
    return sentences.join(' ');
  }

  function ensureAltTextAnchor() {
    if (typeof document === 'undefined') {
      return altTextAnchor;
    }
    if (altTextAnchor && document.body.contains(altTextAnchor)) {
      return altTextAnchor;
    }
    altTextAnchor = document.getElementById('trefigurer-alt-anchor');
    if (!altTextAnchor) {
      altTextAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      altTextAnchor.setAttribute('id', 'trefigurer-alt-anchor');
      altTextAnchor.setAttribute('width', '0');
      altTextAnchor.setAttribute('height', '0');
      altTextAnchor.style.position = 'absolute';
      altTextAnchor.style.left = '-9999px';
      altTextAnchor.style.width = '0';
      altTextAnchor.style.height = '0';
      document.body.appendChild(altTextAnchor);
    }
    return altTextAnchor;
  }

  function syncFigureGridA11y() {
    if (!grid || !window.MathVisAltText) return;
    const anchor = ensureAltTextAnchor();
    const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
    grid.setAttribute('role', 'img');
    const title = getTrefigurerTitle();
    if (title) {
      grid.setAttribute('aria-label', title);
    }
    if (nodes.titleEl && nodes.titleEl.id) {
      grid.setAttribute('aria-labelledby', nodes.titleEl.id);
    }
    if (nodes.descEl && nodes.descEl.id) {
      grid.setAttribute('aria-describedby', nodes.descEl.id);
    }
  }

  function refreshAltText(reason) {
    const signature = buildTrefigurerAltText();
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
      altTextManager.notifyFigureChange(signature);
    }
  }

  function initAltTextManager() {
    if (!window.MathVisAltText || !exportCard) return;
    const anchor = ensureAltTextAnchor();
    altTextManager = window.MathVisAltText.create({
      svg: () => anchor,
      container: exportCard,
      getTitle: getTrefigurerTitle,
      getState: () => ({
        text: window.STATE && typeof window.STATE.altText === 'string' ? window.STATE.altText : '',
        source: window.STATE && window.STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        if (!window.STATE || typeof window.STATE !== 'object') {
          window.STATE = {};
        }
        window.STATE.altText = text;
        window.STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
        syncFigureGridA11y();
      },
      generate: () => buildTrefigurerAltText(),
      getSignature: () => buildTrefigurerAltText(),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    syncFigureGridA11y();
    if (altTextManager) {
      altTextManager.applyCurrent();
      syncFigureGridA11y();
    }
  }
  async function exportFigure(index, format) {
    const renderer = renderers[index];
    if (!renderer || typeof renderer.captureSnapshot !== 'function') return;
    const snapshot = renderer.captureSnapshot();
    if (!snapshot || !snapshot.canvas) return;
    const figures = getCurrentFigures();
    const info = Array.isArray(figures) ? figures[index] : null;
    if (format === 'png') {
      const blob = await canvasToBlob(snapshot.canvas);
      if (!blob) return;
      const filename = getExportFileName(index, 'png');
      downloadBlob(blob, filename);
      return;
    }
    if (format === 'svg') {
      const pngDataUrl = snapshot.canvas.toDataURL('image/png');
      const svgContent = createSvgFromImage(pngDataUrl, snapshot.width, snapshot.height, snapshot.background);
      if (!svgContent) return;
      const blob = new Blob([svgContent], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const filename = getExportFileName(index, 'svg');
      const helper = svgExportHelper;
      if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function' && typeof document !== 'undefined') {
        try {
          const exportSvg = document.createElementNS(SVG_NS, 'svg');
          const width = Number.isFinite(snapshot.width) ? snapshot.width : snapshot.canvas.width;
          const height = Number.isFinite(snapshot.height) ? snapshot.height : snapshot.canvas.height;
          if (Number.isFinite(width) && Number.isFinite(height)) {
            exportSvg.setAttribute('width', String(width));
            exportSvg.setAttribute('height', String(height));
            exportSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
          const meta = buildFigureExportMeta(info, index);
          const htmlTarget =
            (Array.isArray(figureWrappers) && figureWrappers[index]) ||
            (snapshot && snapshot.canvas) ||
            exportSvg;
          await helper.exportGraphicWithArchiveWithFallback({
            svgElement: exportSvg,
            htmlTarget,
            suggestedName: filename,
            toolId: 'trefigurer',
            svgString: svgContent,
            description: meta.description,
            defaultBaseName: meta.defaultBaseName,
            summary: meta.summary,
            title: meta.title
          });
          return;
        } catch (error) {
          console.error('Klarte ikke eksportere via arkivet.', error);
        }
      }
      if (helper && typeof helper.exportSvgWithArchive === 'function' && typeof document !== 'undefined') {
        try {
          const exportSvg = document.createElementNS(SVG_NS, 'svg');
          const width = Number.isFinite(snapshot.width) ? snapshot.width : snapshot.canvas.width;
          const height = Number.isFinite(snapshot.height) ? snapshot.height : snapshot.canvas.height;
          if (Number.isFinite(width) && Number.isFinite(height)) {
            exportSvg.setAttribute('width', String(width));
            exportSvg.setAttribute('height', String(height));
            exportSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
          const meta = buildFigureExportMeta(info, index);
          await helper.exportSvgWithArchive(exportSvg, filename, 'trefigurer', {
            svgString: svgContent,
            description: meta.description,
            defaultBaseName: meta.defaultBaseName,
            summary: meta.summary,
            title: meta.title
          });
          return;
        } catch (error) {
          console.error('Klarte ikke eksportere via arkivet.', error);
        }
      }
      downloadBlob(blob, filename);
    }
  }
  function applyColor(useCustom, hex) {
    const parsed = useCustom ? parseColorHex(hex) : null;
    renderers.forEach(renderer => renderer.setMaterialColorOverride(parsed));
    if (colorInput) {
      colorInput.classList.toggle('is-auto', !useCustom);
    }
    if (colorResetBtn) {
      colorResetBtn.disabled = !useCustom;
    }
    updateFillColorPickerActive();
  }
  function applyTransparency(value) {
    const clamped = clampTransparency(value);
    const opacity = 1 - clamped / 100;
    if (transparencyRange && String(clamped) !== transparencyRange.value) {
      transparencyRange.value = String(clamped);
    }
    renderers.forEach(renderer => renderer.setMaterialOpacity(opacity));
    window.STATE.transparency = clamped;
    updateTransparencyLabel(clamped);
  }
  const defaultInput = textarea ? textarea.value : 'kjegle radius: r høyde: h';
  function ensureStateDefaults() {
    window.STATE = window.STATE || {};
    ensureViewStateCapacity();
    if (typeof window.STATE.rawInput !== 'string') {
      window.STATE.rawInput = defaultInput;
    }
    if (!Array.isArray(window.STATE.figures)) {
      window.STATE.figures = [];
    }
    if (typeof window.STATE.rotationLocked !== 'boolean') {
      window.STATE.rotationLocked = lockRotationCheckbox ? Boolean(lockRotationCheckbox.checked) : false;
    }
    if (typeof window.STATE.freeFigure !== 'boolean') {
      window.STATE.freeFigure = freeFigureCheckbox ? Boolean(freeFigureCheckbox.checked) : false;
    }
    const fallbackColor = colorInput && typeof colorInput.value === 'string' && colorInput.value ? colorInput.value : '#3b82f6';
    if (typeof window.STATE.customColor !== 'string' || !parseColorHex(window.STATE.customColor)) {
      window.STATE.customColor = fallbackColor;
    }
    if (typeof window.STATE.useCustomColor !== 'boolean') {
      window.STATE.useCustomColor = window.STATE.useCustomColor === 'true';
    }
    const clampedTransparency = clampTransparency(window.STATE.transparency);
    window.STATE.transparency = clampedTransparency;
    if (typeof window.STATE.altText !== 'string') {
      window.STATE.altText = '';
    }
    if (window.STATE.altTextSource !== 'manual') {
      window.STATE.altTextSource = 'auto';
    }
  }
  const applyRotationLock = locked => {
    renderers.forEach(renderer => renderer.setRotationLocked(Boolean(locked)));
  };
  const applyFloating = floating => {
    renderers.forEach(renderer => renderer.setFloating(Boolean(floating)));
  };
  function sanitizeFigureEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const cleaned = {
      input: typeof entry.input === 'string' ? entry.input : ''
    };
    if (typeof entry.type === 'string') {
      cleaned.type = entry.type;
    }
    if (entry.dimensions && typeof entry.dimensions === 'object') {
      const dims = {};
      Object.keys(entry.dimensions).forEach(key => {
        const source = entry.dimensions[key];
        if (!source || typeof source !== 'object') return;
        const dim = {};
        if (typeof source.label === 'string') dim.label = source.label;
        if (Number.isFinite(source.value)) dim.value = Number(source.value);
        if (source.requested != null) dim.requested = Boolean(source.requested);
        if (Object.keys(dim).length) {
          dims[key] = dim;
        }
      });
      if (Object.keys(dims).length) {
        cleaned.dimensions = dims;
      }
    }
    return cleaned;
  }
  function sanitizeViewEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const position = normalizeVectorArray(entry.position);
    const target = normalizeVectorArray(entry.target);
    const sanitized = {};
    if (position) sanitized.position = position.slice();
    if (target) sanitized.target = target.slice();
    if (Number.isFinite(entry.distance)) sanitized.distance = Number(entry.distance);
    if (Number.isFinite(entry.baseDistance)) sanitized.baseDistance = Number(entry.baseDistance);
    return Object.keys(sanitized).length ? sanitized : null;
  }
  function createCleanState(meta) {
    ensureStateDefaults();
    syncAllViewStates();
    const figures = getCurrentFigures();
    const cleanFigures = Array.isArray(figures)
      ? figures.map(sanitizeFigureEntry).filter(Boolean)
      : [];
    const cleanViews = Array.isArray(window.STATE && window.STATE.views)
      ? window.STATE.views.map(sanitizeViewEntry)
      : [];
    const cleanState = {
      v: 1,
      input: typeof window.STATE.rawInput === 'string' ? window.STATE.rawInput : defaultInput,
      figures: cleanFigures,
      rotationLocked: Boolean(window.STATE.rotationLocked),
      freeFigure: Boolean(window.STATE.freeFigure),
      useCustomColor: Boolean(window.STATE.useCustomColor),
      customColor: typeof window.STATE.customColor === 'string' ? window.STATE.customColor : undefined,
      transparency: clampTransparency(window.STATE.transparency),
      views: cleanViews
    };
    if (!cleanState.customColor) delete cleanState.customColor;
    if (meta && typeof meta === 'object') {
      cleanState.meta = { ...meta };
    }
    return cleanState;
  }
  function loadCleanState(rawState) {
    if (!rawState || typeof rawState !== 'object') return false;
    if (Number(rawState.v) !== 1) return false;
    const nextState = {};
    const input = typeof rawState.input === 'string' ? rawState.input : defaultInput;
    nextState.rawInput = input;
    if (Array.isArray(rawState.figures)) {
      nextState.figures = rawState.figures.map(sanitizeFigureEntry).filter(Boolean);
    }
    const transparency = clampTransparency(rawState.transparency);
    nextState.transparency = transparency;
    if (typeof rawState.rotationLocked === 'boolean') {
      nextState.rotationLocked = rawState.rotationLocked;
    }
    if (typeof rawState.freeFigure === 'boolean') {
      nextState.freeFigure = rawState.freeFigure;
    }
    if (typeof rawState.useCustomColor === 'boolean') {
      nextState.useCustomColor = rawState.useCustomColor;
    }
    if (typeof rawState.customColor === 'string') {
      nextState.customColor = rawState.customColor;
    }
    if (Array.isArray(rawState.views)) {
      nextState.views = rawState.views.map(sanitizeViewEntry);
    }
    window.STATE = nextState;
    ensureStateDefaults();
    syncControlsFromState();
    draw();
    refreshAltText('load-clean-state');
    return true;
  }
  function syncControlsFromState() {
    if (!window.STATE || typeof window.STATE !== 'object') return;
    if (lockRotationCheckbox) {
      lockRotationCheckbox.checked = Boolean(window.STATE.rotationLocked);
    }
    if (freeFigureCheckbox) {
      freeFigureCheckbox.checked = Boolean(window.STATE.freeFigure);
    }
    if (colorInput && typeof window.STATE.customColor === 'string') {
      colorInput.value = window.STATE.customColor;
    }
    const transparencyValue = clampTransparency(window.STATE.transparency);
    if (transparencyRange) {
      transparencyRange.value = String(transparencyValue);
    }
    applyRotationLock(window.STATE.rotationLocked);
    applyFloating(window.STATE.freeFigure);
    applyColor(Boolean(window.STATE.useCustomColor), window.STATE.customColor);
    applyTransparency(transparencyValue);
    renderFillColorPicker();
  }
  ensureStateDefaults();
  syncControlsFromState();
  updateViewControlsUI(getActiveViewIndex());
  function detectType(line) {
    const normalized = line.toLowerCase();
    if (normalized.includes('kjegl') || normalized.includes('konus') || normalized.includes('konisk') || normalized.includes('cone')) return 'cone';
    if (normalized.includes('kule')) return 'sphere';
    if (normalized.includes('pyram')) return 'pyramid';
    if (normalized.includes('trekant') && normalized.includes('sylinder')) return 'triangular-cylinder';
    if (normalized.includes('firkant') && normalized.includes('sylinder')) return 'square-cylinder';
    if (normalized.includes('kvadrat') && normalized.includes('sylinder')) return 'square-cylinder';
    if (normalized.includes('sylinder')) return 'cylinder';
    if (normalized.includes('prism')) return 'prism';
    return 'prism';
  }
  function parseDimensions(line) {
    const result = {};
    if (!line) return result;
    const segments = line.split(/(?=\b(?:radius|rad|høyde|hoyde)\b)/i);
    for (const segment of segments) {
      const match = segment.match(/^\s*\b(radius|rad|høyde|hoyde)\b/i);
      if (!match) continue;
      const keyword = match[1].toLowerCase();
      const normalized = keyword.startsWith('r') ? 'radius' : 'height';
      let remainder = segment.slice(match[0].length);
      let hadSeparator = false;
      const sepMatch = remainder.match(/^\s*([:=])/);
      if (sepMatch) {
        hadSeparator = true;
        remainder = remainder.slice(sepMatch[0].length);
      }
      let label = remainder.trim();
      if (label.startsWith('"') && label.endsWith('"') && label.length >= 2) {
        label = label.slice(1, -1);
      } else if (label.startsWith("'") && label.endsWith("'") && label.length >= 2) {
        label = label.slice(1, -1);
      } else if (label.startsWith('(') && label.endsWith(')') && label.length >= 2) {
        label = label.slice(1, -1).trim();
      } else if (label.startsWith('[') && label.endsWith(']') && label.length >= 2) {
        label = label.slice(1, -1).trim();
      }
      label = label.replace(/[,;|]+$/g, '').replace(/\s{2,}/g, ' ').trim();
      let finalLabel = label;
      if (!finalLabel) {
        finalLabel = hadSeparator ? '' : normalized === 'radius' ? 'r' : 'h';
      }
      if (!result[normalized]) {
        const entry = {
          requested: true,
          label: finalLabel
        };
        const numericSource = typeof finalLabel === 'string' ? finalLabel.replace(/,/g, '.').trim() : '';
        if (numericSource) {
          const matchNumber = numericSource.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
          if (matchNumber) {
            const parsed = Number.parseFloat(matchNumber[0]);
            if (Number.isFinite(parsed)) {
              entry.value = parsed;
            }
          }
        }
        result[normalized] = entry;
      }
    }
    return result;
  }
  function parseInput(rawInput) {
    const lines = rawInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const figures = [];
    for (const line of lines) {
      const type = detectType(line);
      const dimensions = parseDimensions(line);
      figures.push({
        input: line,
        type,
        dimensions
      });
      if (figures.length >= renderers.length) break;
    }
    return figures;
  }
  function updateForm(rawInput) {
    if (textarea && textarea.value !== rawInput) {
      textarea.value = rawInput;
    }
  }
  function updateFigures(figures) {
    ensureViewStateCapacity();
    const count = Math.max(figures.length, 1);
    if (grid) {
      grid.dataset.figures = String(count);
    }
    figureWrappers.forEach((wrapper, index) => {
      const renderer = renderers[index];
      const info = figures[index];
      if (info) {
        wrapper.classList.remove('is-hidden');
        const storedView = getStoredView(index);
        renderer.setShape(info);
        if (typeof renderer._handleResize === 'function') {
          renderer._handleResize();
        }
        if (storedView) {
          renderer.applyViewState(storedView);
        } else {
          applyStoredView(index);
        }
      } else {
        renderer.clear();
        wrapper.classList.add('is-hidden');
      }
    });
    updateExportControls(figures);
    if (!Array.isArray(figures) || !figures.some(Boolean)) {
      setActiveViewIndex(0, {
        force: true
      });
    } else {
      const active = getActiveViewIndex();
      if (figures[active]) {
        setActiveViewIndex(active, {
          force: true
        });
      } else {
        const first = figures.findIndex(info => Boolean(info));
        if (first !== -1) {
          setActiveViewIndex(first, {
            force: true
          });
        } else {
          setActiveViewIndex(0, {
            force: true
          });
        }
      }
    }
    refreshAltText('figures');
  }
  function draw() {
    const rawInput = typeof window.STATE.rawInput === 'string' ? window.STATE.rawInput : defaultInput;
    const figures = parseInput(rawInput);
    window.STATE.rawInput = rawInput;
    window.STATE.figures = figures;
    updateForm(rawInput);
    updateFigures(figures);
  }
  exportButtons.forEach(button => {
    button.addEventListener('click', async evt => {
      evt.preventDefault();
      const format = button.dataset.exportFormat;
      const index = Number(button.dataset.figureIndex);
      if (!Number.isFinite(index)) return;
      if (format !== 'png' && format !== 'svg') return;
      const figures = getCurrentFigures();
      if (!figures[index]) return;
      const parentRow = button.closest('.export-row');
      button.disabled = true;
      try {
        await exportFigure(index, format);
      } catch (error) {
        console.error('Klarte ikke eksportere figuren.', error);
      } finally {
        if (!parentRow || !parentRow.classList.contains('is-hidden')) {
          button.disabled = false;
        }
      }
    });
  });
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      window.STATE.rawInput = textarea ? textarea.value : '';
      draw();
    });
  }
  if (lockRotationCheckbox) {
    lockRotationCheckbox.addEventListener('change', evt => {
      const locked = Boolean(evt.target.checked);
      window.STATE.rotationLocked = locked;
      applyRotationLock(locked);
      refreshAltText('view-settings');
    });
  }
  if (freeFigureCheckbox) {
    freeFigureCheckbox.addEventListener('change', evt => {
      const floating = Boolean(evt.target.checked);
      window.STATE.freeFigure = floating;
      applyFloating(floating);
      refreshAltText('view-settings');
    });
  }
  if (colorInput) {
    colorInput.addEventListener('input', evt => {
      const newValue = typeof evt.target.value === 'string' && evt.target.value ? evt.target.value : '#3b82f6';
      window.STATE.customColor = newValue;
      window.STATE.useCustomColor = true;
      applyColor(true, newValue);
      updateFillColorPickerActive();
    });
  }
  if (colorResetBtn) {
    colorResetBtn.addEventListener('click', () => {
      window.STATE.useCustomColor = false;
      applyColor(false, window.STATE.customColor);
    });
  }
  if (rotationRange) {
    rotationRange.addEventListener('input', evt => {
      const value = clampRotation(evt.target.value);
      if (String(Math.round(value)) !== evt.target.value) {
        evt.target.value = String(Math.round(value));
      }
      updateRotationLabel(value);
      applyViewControlChanges({
        rotationDeg: value
      });
    });
  }
  if (elevationRange) {
    elevationRange.addEventListener('input', evt => {
      const value = clampElevationDegrees(evt.target.value);
      if (String(Math.round(value)) !== evt.target.value) {
        evt.target.value = String(Math.round(value));
      }
      updateElevationLabel(value);
      applyViewControlChanges({
        elevationDeg: value
      });
    });
  }
  if (zoomRange) {
    zoomRange.addEventListener('input', evt => {
      const value = clampZoomPercent(evt.target.value);
      if (String(Math.round(value)) !== evt.target.value) {
        evt.target.value = String(Math.round(value));
      }
      updateZoomLabel(value);
      applyViewControlChanges({
        zoomPercent: value
      });
    });
  }
  if (transparencyRange) {
    transparencyRange.addEventListener('input', evt => {
      const value = clampTransparency(evt.target.value);
      window.STATE.transparency = value;
      applyTransparency(value);
    });
  }
  if (textarea) {
    textarea.addEventListener('input', () => {
      if (!window.STATE || typeof window.STATE !== 'object') return;
      window.STATE.rawInput = textarea.value;
    });
    textarea.addEventListener('keydown', evt => {
      if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
        evt.preventDefault();
        window.STATE.rawInput = textarea.value;
        draw();
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.loadCleanState = loadCleanState;
    window.trefigurerApi = {
      createCleanState: (...args) => createCleanState(...args),
      loadCleanState: (...args) => loadCleanState(...args),
      onExampleCollect: () => syncAllViewStates(),
      onExampleLoaded: handleExamplesLoaded
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window.trefigurerApi;
    window.mathVisuals = mv;
  }
  window.draw = draw;
  initAltTextManager();
  draw();
  refreshAltText('init');
})();
