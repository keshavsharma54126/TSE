import {gl,GlUtilities} from './gl/gl';
import { Shader } from './gl/shader';

export class Engine {

    private _canvas!: HTMLCanvasElement;
    private _shader!:Shader
    public constructor() {
        console.log("engine initialized")
    }

    public start(): void {

        this._canvas = GlUtilities.initialize()
        gl?.clearColor(0, 0, 0, 1)
        this.loadShaders()
        this._shader.use()
        this.loop()

    }
    public loop(): void{
        gl?.clear(gl.COLOR_BUFFER_BIT)
        requestAnimationFrame(this.loop.bind(this));
    }
    public resize(): void{
        if (this._canvas != undefined) {
            this._canvas.width = window.innerHeight
            this._canvas.height = window.innerWidth
        }
    }

    private loadShaders(): void{
        let vertexShaderSource = `
        attribute vec2 a_position;

        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
        `
        let frangementShaderSource = `
        precision highp float;
        uniform vec2 u_resolution;
        uniform float u_time;

        // Black hole constants
        const float MASS = 0.8;
        const float EVENT_HORIZON = 0.3;
        const int MAX_ITERATIONS = 40;

        // Star field
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float starField(vec2 uv) {
            float star_density = 0.998;
            float star = step(star_density, random(floor(uv * 100.0) / 100.0));
            return star * (sin(u_time * 0.5 + uv.x * 20.0) * 0.5 + 0.5);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
            vec2 center = vec2(0.0);
            float dist = length(uv - center);

            if (dist < EVENT_HORIZON) {
                // Inside the event horizon, it's black
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }
            
            vec2 deflection = normalize(center - uv) * MASS / (dist * dist);
            uv += deflection * 0.2;

            // Swirling accretion disk
            float angle = atan(uv.y, uv.x);
            float radius = length(uv);
            float swirl = radius * 10.0 - u_time * 2.0;
            float color = (sin(swirl) + cos(angle * 3.0)) * 0.5;

            vec3 accretion_disk_color = vec3(color * 1.5, color, color * 2.0) * (1.0 - smoothstep(EVENT_HORIZON - 0.05, EVENT_HORIZON + 0.1, radius));
            
            // Stars in the background, warped by the black hole
            float stars = starField(uv * 3.0);
            
            vec3 final_color = accretion_disk_color + vec3(stars);

            gl_FragColor = vec4(final_color, 1.0);
        }
        `
        
        this._shader = new Shader("basic", vertexShaderSource, frangementShaderSource)

    }
}
