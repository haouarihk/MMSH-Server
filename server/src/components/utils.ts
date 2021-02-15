import fs from "fs"
import { join } from "path"

import arp from "app-root-path";
const _dirname = arp.path

export const forEachSync = async function (that: any, cb: (element: any, index: number) => Promise<void>) {
    for (let i = 0; i < that.length; i++) {
        await cb(that[i], i)
    }
}


export function toJs(obj: any) {
    let jss = ``
    let _js = `let globalData=${JSON.stringify(obj)};`
    return _js
}

export function get(path: string) {
    return JSON.parse(fs.readFileSync(join(_dirname, path), "utf-8"));
}