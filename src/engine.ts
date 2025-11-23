import {gl,GlUtilities} from './gl';


export class Engine {

    private _canvas!: HTMLCanvasElement;
    public constructor() {
        console.log("engine initialized")
    }

    public start(): void {

        this._canvas = GlUtilities.initialize()
        gl?.clearColor(0,0,0,1)
        this.loop()

    }
    public loop(): void{
        gl?.clear(gl.COLOR_BUFFER_BIT)
        requestAnimationFrame(this.loop.bind(this));
    }
}

