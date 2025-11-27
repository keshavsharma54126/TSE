import {Engine} from "./core/engine"

var e = new Engine()
window.onload = function () {
    e.start();

}

window.onresize = function () {
    e.resize()
}

