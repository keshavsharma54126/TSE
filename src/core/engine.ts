import { gl, GlUtilities } from './gl/gl';
import { Shader } from './gl/shader';

export class Engine {

    private _canvas!: HTMLCanvasElement;
    private _shader!: Shader;
    private _buffer!: WebGLBuffer;
    private _startTime!: number;
    
    private _mouseX: number = 0.0;
    private _mouseY: number = 0.0;
    private _cameraX: number = 0.0;
    private _cameraY: number = 0.0;
    private _targetCameraX: number = 0.0;
    private _targetCameraY: number = 0.0; 

    private _zoom: number = 0.35; 
    private _targetZoom: number = 0.35;
    

    private _isDragging: boolean = false;
    private _lastX: number = 0;
    private _lastY: number = 0;
    private _initialPinchDist: number = 0;
    private _isPinching: boolean = false;

    public constructor() {
        console.log("Engine initialized: Fractal Singularity");
    }

    public start(): void {
        this._canvas = GlUtilities.initialize();
        gl?.clearColor(0.0, 0.0, 0.0, 1);
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
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            this._canvas.style.cursor = "grabbing";
        });
        window.addEventListener('mouseup', () => {
            this._isDragging = false;
            this._canvas.style.cursor = "default";
        });
        this._canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = this._canvas.getBoundingClientRect();
            this._mouseX = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
            this._mouseY = -(((e.clientY - rect.top) / rect.height) * 2.0 - 1.0);
            if(this._isDragging) this.handlePan(e.clientX, e.clientY, rect.width, rect.height);
        });
        this._canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            this.handleZoom(e.deltaY * 0.002);
        }, { passive: false });

        this._canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if(e.target === this._canvas) e.preventDefault();
            if (e.touches.length === 1) {
                this._isDragging = true;
                this._isPinching = false;
                this._lastX = e.touches[0].clientX;
                this._lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                this._isDragging = false;
                this._isPinching = true;
                this._initialPinchDist = this.getPinchDist(e);
            }
        }, { passive: false });

        this._canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if(e.target === this._canvas) e.preventDefault();
            const rect = this._canvas.getBoundingClientRect();
            if (this._isDragging && e.touches.length === 1) {
                this.handlePan(e.touches[0].clientX, e.touches[0].clientY, rect.width, rect.height);
            } else if (this._isPinching && e.touches.length === 2) {
                const dist = this.getPinchDist(e);
                const delta = (1.0 - (dist / this._initialPinchDist)) * 0.15; 
                this.handleZoom(delta);
                this._initialPinchDist = dist; 
            }
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this._isDragging = false;
            this._isPinching = false;
        });
        window.addEventListener('resize', () => this.resize());
    }

    private getPinchDist(e: TouchEvent): number {
        return Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }

    private handlePan(x: number, y: number, w: number, h: number): void {
        const sens = 1.0 / Math.max(this._zoom, 0.2);
        this._targetCameraX -= (x - this._lastX) / w * sens;
        this._targetCameraY += (y - this._lastY) / h * sens; 
        this._lastX = x; this._lastY = y;
    }

    private handleZoom(delta: number): void {
        this._targetZoom = Math.max(0.05, Math.min(this._targetZoom * (1.0 - delta), 500.0));
    }
    
    public loop(): void{
        const d = 0.08;
        this._zoom += (this._targetZoom - this._zoom) * d;
        this._cameraX += (this._targetCameraX - this._cameraX) * d;
        this._cameraY += (this._targetCameraY - this._cameraY) * d;

        gl.uniform2f(this._shader.getUniformLocation('u_resolution'), this._canvas.width, this._canvas.height);
        gl.uniform1f(this._shader.getUniformLocation('u_time'), (Date.now() - this._startTime) / 1000.0);
        gl.uniform2f(this._shader.getUniformLocation('u_mouse'), this._mouseX, this._mouseY);
        gl.uniform1f(this._shader.getUniformLocation('u_zoom'), this._zoom);
        gl.uniform2f(this._shader.getUniformLocation('u_camera'), this._cameraX, this._cameraY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(this.loop.bind(this));
    }
    
    public resize(): void {
        if (this._canvas) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2.0); 
            this._canvas.width = window.innerWidth * dpr;
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

        // === FRACTAL NOISE ===
        
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        mat2 rot(float a) {
            float s = sin(a), c = cos(a);
            return mat2(c, -s, s, c);
        }

        // FBM with Detail Scaling
        // We pass 'octaves' or 'scale' roughly via the coords themselves
        float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            mat2 m = rot(0.5); 
            for (int i = 0; i < 6; i++) {
                v += a * noise(p);
                p = m * p * 2.02;
                a *= 0.5;
            }
            return v;
        }

        float warpedNoise(vec2 p) {
            vec2 q = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
            vec2 r = vec2(fbm(p + 4.0*q + vec2(1.7, 9.2)), fbm(p + 4.0*q + vec2(8.3, 2.8)));
            return fbm(p + 4.0*r);
        }

        // === HDR COLORS ===
        vec3 blackbody(float t) {
            // High Dynamic Range Colors
            // t goes from 0.0 to >1.0
            vec3 col = vec3(0.0);
            col += vec3(0.2, 0.0, 0.01) * smoothstep(0.0, 0.15, t); // Void Red
            col += vec3(0.8, 0.3, 0.0) * smoothstep(0.1, 0.4, t); // Magma
            col += vec3(1.2, 0.9, 0.3) * smoothstep(0.35, 0.8, t); // Bright Gold
            col += vec3(1.0, 1.0, 1.0) * smoothstep(0.7, 1.2, t); // Core White
            col += vec3(0.6, 0.8, 1.0) * smoothstep(1.1, 1.6, t); // Blue Shift (Extreme energy)
            return col;
        }

        vec3 renderBlackHole(vec2 p) {
            float r = length(p);
            float rs = 0.25; 
            
            // 1. GRAVITATIONAL LENSING
            float distortion = 0.13 / (r + 0.005);
            vec2 lensedUV = p - normalize(p) * distortion;
            
            // 2. DISK PROJECTION
            vec2 diskUV = lensedUV;
            diskUV.y *= 3.8; // High inclination tilt
            
            float dr = length(diskUV);
            float da = atan(diskUV.y, diskUV.x);
            
            float inner = rs * 2.4;
            float outer = rs * 8.5;
            
            vec3 diskColor = vec3(0.0);
            
            if(dr > inner && dr < outer) {
                // Rotation
                float speed = 3.5 / sqrt(dr);
                float angle = da - u_time * speed;
                
                // --- FRACTAL DETAIL SCALING ---
                // As u_zoom increases, we multiply the coordinate scale.
                // Logarithmic scaling prevents it from becoming noise-soup too fast.
                float detailZoom = 1.0 + log(u_zoom + 1.0) * 0.8;
                
                // Turbulent Plasma
                float plasma = warpedNoise(vec2(dr * 6.0 * detailZoom, angle * 2.0));
                
                // Add fine grit/particles
                float grit = fbm(vec2(dr * 20.0 * detailZoom, angle * 8.0));
                
                // Doppler Beaming
                float beaming = sin(da + 0.3);
                float doppler = 1.0 + 0.6 * beaming;
                
                // Temp Gradient
                float temp = 1.0 - (dr - inner) / (outer - inner);
                temp = pow(temp, 1.3);
                
                // Infinite Redshift Fade
                // Softens the inner edge but keeps it tight
                float redshift = smoothstep(inner - 0.05, inner + 0.6, dr);
                float outerFade = smoothstep(outer, outer - 2.0, dr);
                
                // Final Intensity
                float combinedDensity = (0.4 + 0.6 * plasma) * (0.8 + 0.2 * grit);
                float totalIntensity = temp * doppler;
                
                // HDR Color calc
                vec3 baseColor = blackbody(totalIntensity * 1.2); // Boost brightness
                
                // Beam intensity power law
                float beamPower = pow(doppler, 3.5);
                
                diskColor = baseColor * beamPower * combinedDensity * redshift * outerFade * 3.5;
            }
            
            // 3. PHOTON RING (Caustic Glow)
            float prPos = rs * 1.52;
            // Width scales with zoom so it remains a sharp line
            float prWidth = 0.004 / u_zoom;
            prWidth = max(prWidth, 0.0005);
            
            // Gaussian profile for the ring
            float ringShape = exp(-pow((r - prPos) / prWidth, 2.0));
            
            // Ring asymmetry
            float ringDoppler = smoothstep(-1.0, 1.0, -p.x * 3.0);
            vec3 ringCol = vec3(1.5, 1.3, 1.1) * ringShape * 10.0 * ringDoppler;

            // 4. SHADOW & COMPOSITING (The "Nothing Inside" Fix)
            
            // Shadow Mask: 1.0 = Shadow, 0.0 = Clear
            // Harder edge than before for "Nothing inside" look
            float shadowMask = smoothstep(rs + 0.01, rs - 0.005, r);
            
            // Depth Check for Accretion Disk
            // y < 0 is "Front" (roughly)
            float zFront = smoothstep(-0.05, 0.05, -diskUV.y);
            
            // LOGIC:
            // 1. Back Disk: Obscured by Shadow.
            // 2. Shadow: Obscures Background.
            // 3. Front Disk: Obscures Shadow.
            
            vec3 final = vec3(0.0);
            
            // Draw Back Disk (where not shadowed)
            // (1.0 - zFront) is 1.0 at back.
            final += diskColor * (1.0 - zFront) * (1.0 - shadowMask);
            
            // Draw Front Disk
            // zFront is 1.0 at front.
            final += diskColor * zFront;
            
            // Draw Photon Ring (always on top of shadow edge)
            final += ringCol;
            
            return final;
        }

        vec3 renderStars(vec2 uv) {
            float s = hash(uv * 20.0);
            vec3 c = vec3(0.0);
            if(s > 0.995) {
                float i = (s - 0.995) * 250.0;
                // Twinkle
                i *= (0.6 + 0.4 * sin(u_time * 2.0 + s * 50.0));
                c = vec3(i);
            }
            return c;
        }

        void main() {
            // Mobile Aspect Ratio Fix
            float minDim = min(u_resolution.x, u_resolution.y);
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / minDim;
            
            vec2 p = (uv / u_zoom) + u_camera;
            float r = length(p);
            
            // Background Stars
            float dist = 0.13 / (r + 0.01);
            vec2 lensedUV = p - normalize(p) * dist;
            vec3 bg = renderStars(lensedUV * 2.5);
            
            // Foreground Black Hole
            vec3 fg = renderBlackHole(p);
            
            // --- STRICT SHADOW COMPOSITING ---
            // If we are in the shadow radius...
            float rs = 0.25;
            float shadowEdge = smoothstep(rs + 0.005, rs - 0.005, r);
            
            // Calculate if the FRONT disk covers this pixel
            // We need to approximate the alpha of the front disk at this pixel.
            // Re-calculating full noise is expensive, but we can use the Z-depth logic from renderBlackHole.
            // Simplified: If 'fg' is bright, it means the disk (front or back) is there.
            // But 'fg' already cut the back disk with shadow.
            // So if 'fg' is bright, we show 'fg'.
            // If 'fg' is dark, AND we are in shadow, we show BLACK.
            // If 'fg' is dark, AND we are NOT in shadow, we show Stars.
            
            vec3 col = bg * (1.0 - shadowEdge) + fg;
            
            // Post Processing
            
            // Bloom / Glow
            // Allow bright pixels to bleed (simulated by boosting base brightness)
            col += max(vec3(0.0), col - 0.5) * 0.2;
            
            // Tone Mapping (Reinhard)
            col = vec3(1.0) - exp(-col * 1.3);
            
            // Contrast curve
            col = pow(col, vec3(1.1));
            
            // Subtle Grain
            col += (hash(uv * 10.0 + u_time) - 0.5) * 0.02;

            gl_FragColor = vec4(col, 1.0);
        }
        `;
        
        this._shader = new Shader("hd-singularity", vertexShaderSource, fragmentShaderSource);
    }
}