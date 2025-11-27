import { gl, GlUtilities } from './gl/gl';
import { Shader } from './gl/shader';

export class Engine {

    private _canvas!: HTMLCanvasElement;
    private _shader!: Shader;
    private _buffer!: WebGLBuffer;
    private _startTime!: number;
    
    // Camera Variables
    private _mouseX: number = 0.0;
    private _mouseY: number = 0.0;
    
    // Smooth Camera State (Heavy Inertia)
    private _cameraX: number = 0.0;
    private _cameraY: number = 0.0;
    private _targetCameraX: number = 0.0;
    private _targetCameraY: number = 0.0; 

    // Zoom State
    private _zoom: number = 1.0;
    private _targetZoom: number = 1.0;
    
    // Interaction State
    private _isDragging: boolean = false;
    private _lastMouseX: number = 0;
    private _lastMouseY: number = 0;

    public constructor() {
        console.log("Engine initialized: Photorealistic Simulation");
    }

    public start(): void {
        this._canvas = GlUtilities.initialize();
        // Deep space is not black, it's very dark blue-grey due to cosmic background radiation/noise
        gl?.clearColor(0.005, 0.005, 0.008, 1);
        this.loadShaders();
        this._shader.use();

        const vertices = [
            -1.0, -1.0, 1.0, -1.0, -1.0,  1.0,
            -1.0,  1.0, 1.0, -1.0, 1.0,  1.0,
        ];
        
        this._buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        const positionAttribute = this._shader.getAttributeLocation('a_position');
        gl.enableVertexAttribArray(positionAttribute);
        gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);
        
        this.setupInputs();
        this.resize();
        
        this._startTime = Date.now();
        this.loop();
    }

    private setupInputs(): void {
        this._canvas.addEventListener('mousedown', (e: MouseEvent) => {
            this._isDragging = true;
            this._lastMouseX = e.clientX;
            this._lastMouseY = e.clientY;
            this._canvas.style.cursor = "grabbing";
        });
        
        window.addEventListener('mouseup', () => {
            this._isDragging = false;
            this._canvas.style.cursor = "default";
        });
        
        this._canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = this._canvas.getBoundingClientRect();
            // Normalized for shader use
            this._mouseX = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
            this._mouseY = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
            
            if(this._isDragging) {
                // SUTTLE MOVEMENT: Very low sensitivity for "heavy telescope" feel
                // The more you zoom, the finer the control needs to be.
                const sensitivity = 0.8 / Math.max(this._zoom, 0.5);
                
                const deltaX = (e.clientX - this._lastMouseX) / rect.width * sensitivity;
                const deltaY = (e.clientY - this._lastMouseY) / rect.height * sensitivity;
                
                this._targetCameraX -= deltaX;
                this._targetCameraY += deltaY; 
                
                this._lastMouseX = e.clientX;
                this._lastMouseY = e.clientY;
            }
        });
        
        this._canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const zoomSpeed = 0.0015;
            this._targetZoom *= (1.0 - e.deltaY * zoomSpeed);
            // Cap zoom to prevent floating point jitter at extreme scales
            this._targetZoom = Math.max(0.4, Math.min(this._targetZoom, 200.0));
        }, { passive: false });

        window.addEventListener('resize', () => this.resize());
    }
    
    public loop(): void{
        // Heavy Damping: 0.05 makes the camera feel massive and smooth
        const damp = 0.05;
        this._zoom += (this._targetZoom - this._zoom) * damp;
        this._cameraX += (this._targetCameraX - this._cameraX) * damp;
        this._cameraY += (this._targetCameraY - this._cameraY) * damp;

        gl.uniform2f(this._shader.getUniformLocation('u_resolution'), 
            this._canvas.width, this._canvas.height);
        gl.uniform1f(this._shader.getUniformLocation('u_time'), 
            (Date.now() - this._startTime) / 1000.0);
        gl.uniform2f(this._shader.getUniformLocation('u_mouse'), 
            this._mouseX, this._mouseY);
        gl.uniform1f(this._shader.getUniformLocation('u_zoom'), this._zoom);
        gl.uniform2f(this._shader.getUniformLocation('u_camera'), 
            this._cameraX, this._cameraY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(this.loop.bind(this));
    }
    
    public resize(): void {
        if (this._canvas) {
            // Force 2x pixel ratio for retina sharpness
            const dpr = Math.min(window.devicePixelRatio, 2.0); 
            this._canvas.width  = window.innerWidth * dpr;
            this._canvas.height = window.innerHeight * dpr;
            this._canvas.style.width = window.innerWidth + "px";
            this._canvas.style.height = window.innerHeight + "px";
            gl.viewport(0, 0, this._canvas.width, this._canvas.height);
        }
    }

    private loadShaders(): void{
        let vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
        `;
        
        let fragmentShaderSource = `
        precision highp float;
        
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec2 u_camera;
        uniform float u_zoom;

        #define PI 3.14159265359

        // === REALISTIC NOISE ===
        
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // High Quality FBM for Gas details
        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            mat2 m = rot(0.5); 
            for (int i = 0; i < 6; i++) {
                v += a * noise(p);
                p = m * p * 2.01;
                a *= 0.5;
            }
            return v;
        }
        
        // Domain Warping: Makes the noise look like swirling liquid/plasma
        float warpedNoise(vec2 p) {
            vec2 q = vec2(
                fbm(p + vec2(0.0, 0.0)),
                fbm(p + vec2(5.2, 1.3))
            );
            vec2 r = vec2(
                fbm(p + 4.0 * q + vec2(1.7, 9.2)),
                fbm(p + 4.0 * q + vec2(8.3, 2.8))
            );
            return fbm(p + 4.0 * r);
        }

        // === PHYSICS ===
        
        // Temperature to Color (Kelvin approx normalized 0-1)
        vec3 blackbody(float t) {
            // Physics based color ramp
            // 0.0 = Cold (Deep Red/Infrared)
            // 0.5 = Warm (Orange/Gold)
            // 1.0 = Hot (White/Blue)
            
            vec3 col = vec3(0.0);
            col += vec3(0.5, 0.0, 0.0) * smoothstep(0.0, 0.1, t); // Deep Red
            col += vec3(0.8, 0.3, 0.0) * smoothstep(0.05, 0.4, t); // Orange
            col += vec3(1.0, 0.8, 0.4) * smoothstep(0.3, 0.8, t); // Gold
            col += vec3(1.0, 1.0, 1.0) * smoothstep(0.7, 1.0, t); // White
            col += vec3(0.5, 0.7, 1.0) * smoothstep(0.95, 1.2, t); // Blue tint
            return col;
        }

        vec3 renderBlackHole(vec2 p) {
            float r = length(p);
            float rs = 0.25; // Schwarzschild Radius
            
            // --- 1. OPTICS: GRAVITATIONAL LENSING ---
            // Einstein deflection angle ~ 1/r
            // We distort the coordinate system "pulling" the background inwards
            float distortion = 0.085 / (r + 0.001);
            vec2 lensedUV = p - normalize(p) * distortion;
            
            // --- 2. ACCRETION DISK ---
            // The disk is a 3D object projected onto this distorted space
            vec3 col = vec3(0.0);
            
            // Simulate inclination (tilt) by squashing Y
            vec2 diskUV = lensedUV;
            diskUV.y *= 4.0; 
            
            float dr = length(diskUV);
            float da = atan(diskUV.y, diskUV.x);
            
            float inner = rs * 2.2;
            float outer = rs * 8.0;
            
            if(dr > inner && dr < outer) {
                // Keplerian velocity: V ~ r^-0.5
                float speed = 3.5 / sqrt(dr);
                float angle = da - u_time * speed;
                
                // Fine detail noise
                float zoomFactor = log(u_zoom + 1.0) * 0.4;
                float plasma = warpedNoise(vec2(dr * (5.0 + zoomFactor), angle * 2.0));
                
                // Add flow lines
                plasma += fbm(vec2(dr * 15.0, angle * 8.0)) * 0.3;
                
                // Relativistic Beaming (Doppler)
                // Asymmetry in brightness AND color
                float beaming = sin(da + 0.2); // Rotation axis offset
                float doppler = 1.0 + 0.6 * beaming;
                
                // Temperature Gradient
                // Hotter inside, cooler outside
                float temp = 1.0 - (dr - inner) / (outer - inner);
                temp = pow(temp, 1.2); 
                
                // Apply Doppler Shift to Temperature
                // Matter moving towards us appears hotter (Bluer)
                float shiftTemp = temp * doppler;
                
                // Get Color
                vec3 diskColor = blackbody(shiftTemp);
                
                // Intensity (Beaming to power of 4 for relativity)
                float intensity = pow(doppler, 4.0);
                
                // Soft edges
                float alpha = smoothstep(outer, outer - 2.0, dr);
                alpha *= smoothstep(inner, inner + 0.15, dr);
                
                // Final Disk Composite
                col += diskColor * intensity * (0.5 + 0.8 * plasma) * alpha * 3.0;
            }
            
            // --- 3. PHOTON SPHERE ---
            // The thin ring of light at the edge of the shadow
            float prPos = rs * 1.55; 
            // Constant width in screen space regardless of zoom (to a degree)
            float prWidth = 0.003 / u_zoom;
            prWidth = max(prWidth, 0.0005);
            
            float ring = 1.0 - smoothstep(0.0, prWidth, abs(r - prPos));
            col += vec3(1.2, 1.1, 1.0) * ring * 6.0;

            // --- 4. EVENT HORIZON ---
            // The Shadow. It must strictly occlude everything behind it.
            float shadow = smoothstep(rs + 0.005, rs, r);
            col = mix(col, vec3(0.0), shadow);
            
            return col;
        }

        // Simple starfield to act as background
        vec3 renderStars(vec2 uv) {
            float s = hash(uv * 20.0);
            vec3 c = vec3(0.0);
            if(s > 0.992) {
                float intensity = (s - 0.992) * 100.0;
                // Subtle twinkle
                intensity *= (0.8 + 0.2 * sin(u_time * 2.0 + s * 100.0));
                // Varying star temperatures (Red/Blue/White)
                vec3 tint = mix(vec3(1.0, 0.8, 0.6), vec3(0.6, 0.8, 1.0), hash(uv));
                c = vec3(intensity) * tint;
            }
            return c;
        }

        void main() {
            // Coordinates
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
            vec2 p = (uv / u_zoom) + u_camera;
            
            // 1. Background Stars (Lensed)
            // Lensing calculation duplicated here for the background layer
            float r = length(p);
            float dist = 0.085 / (r + 0.001);
            vec2 lensedUV = p - normalize(p) * dist;
            vec3 bg = renderStars(lensedUV * 4.0);
            
            // 2. Black Hole
            vec3 fg = renderBlackHole(p);
            
            // Composite: Add foreground to background
            // Note: renderBlackHole already handles the shadow (returning 0.0)
            // But we need to make sure the shadow blocks the stars.
            float rs = 0.25;
            float shadowMask = smoothstep(rs, rs - 0.01, r); 
            // If in shadow, mask BG
            vec3 col = bg * (1.0 - shadowMask) + fg;

            // === OPTICAL POST-PROCESSING ===
            
            // 1. Chromatic Aberration
            // Simulate lens refracting colors differently at edges
            // We gently offset the color channels based on distance from center
            float ca = length(uv) * 0.003;
            // Simple tint approximation to avoid 3x re-render
            col.r += ca;
            col.b -= ca;
            
            // 2. Bloom / Glow
            // Extract bright parts
            vec3 bright = max(vec3(0.0), col - 1.0);
            // Add soft glow (simulated)
            col += bright * 0.4;
            
            // 3. Film Grain
            // High ISO noise simulation
            float grain = hash(uv * 5.0 + u_time) * 0.04;
            col += grain;
            
            // 4. Tone Mapping (Reinhard)
            // Handles the HDR brightness (values > 1.0)
            col = vec3(1.0) - exp(-col * 1.2);
            
            // 5. Vignette
            // Darken corners naturally
            float vig = 1.0 - length(uv) * 0.5;
            vig = smoothstep(0.0, 1.0, vig);
            col *= vig;

            gl_FragColor = vec4(col, 1.0);
        }
        `;
        
        this._shader = new Shader("photoreal", vertexShaderSource, fragmentShaderSource);
    }
}