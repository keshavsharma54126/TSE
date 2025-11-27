import { gl } from "./gl";

export class Shader{
    private _name: string;
    private _program!: WebGLProgram;
    public constructor(name:string,vertexSource: string, frangementSource: string) {
        this._name = name
        let vertexShader = this.load_shader(vertexSource, gl.VERTEX_SHADER);
        let fragmentShader = this.load_shader(frangementSource, gl.FRAGMENT_SHADER)
        this.createProgram(vertexShader,fragmentShader)
    }   

    public getName() {
        return this._name
    }

    public use():void {
        gl.useProgram(this._program)
    }

    public getAttributeLocation(name: string): number {
        return gl.getAttribLocation(this._program, name);
    }

    public getUniformLocation(name: string): WebGLUniformLocation {
        return gl.getUniformLocation(this._program, name) as WebGLUniformLocation;
    }

    private load_shader(shaderSource:string,shaderType:number): WebGLShader{
        let shader = gl.createShader(shaderType) as WebGLShader 
        gl.shaderSource( shader,shaderSource)
        gl.compileShader(shader)
        let error = gl.getShaderInfoLog(shader)
        if (error !== "") {
            throw new Error(`An error occured while compiling shader ${this._name} ,error=${error}`)
        }
        return shader
    }

    private createProgram(vertexShader:WebGLShader,fragmentShader:WebGLShader): void{
        this._program = gl.createProgram();
        gl.attachShader(this._program, vertexShader)
        gl.attachShader(this._program, fragmentShader)
        gl.linkProgram(this._program)

        let error = gl.getProgramInfoLog(this._program)
        if (error !== "") {
            throw new Error(`An error occured while linkingprogram for shader ${this._name} ,error=${error}`)
        }
    }


}
