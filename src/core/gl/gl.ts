
export var gl : WebGL2RenderingContext 

export class GlUtilities{
        public static initialize(elementId?: string) {
            let canvas:HTMLCanvasElement
            if (elementId !== undefined) {
                canvas = document.getElementById(elementId) as HTMLCanvasElement
                if (canvas == undefined) {
                    throw new Error("cannot find the html cnavas element")
                }
            } else {
                canvas = document.createElement("canvas") as HTMLCanvasElement
                document.body.appendChild(canvas)

            }
            gl= canvas.getContext('webgl2') as WebGL2RenderingContext
            if (gl == undefined) {
                throw new Error("unable to initialize webgl2")
            }

            return canvas

        }
    }
