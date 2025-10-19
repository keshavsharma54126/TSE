
export class Engine {

    private _count:number = 0
    public constructor() {
        console.log("engine initialized")
    }

    public start(): void {
        this.loop
    }
    public loop(): void{
        this._count += 1;
        document.title = this._count.toString()
        requestAnimationFrame(this.loop.bind(this))
    }
}
window.onload = function () {
    var e = new Engine();
    e.start()
    console.log(e);
    document.body.innerHTML += "foo";
}

