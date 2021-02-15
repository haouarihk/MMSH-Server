import type { Express, Response } from "express"
import * as fs from "fs";
import { join } from "path";
import type { Dirs, Pages } from "../d/types";

import arp from "app-root-path";
const _dirname = arp.path

import { toJs } from "./utils.js";


export default class Router {
    pages: Pages;
    app: Express;
    messagePageName: string;
    alldir: Dirs;
    paths: any;
    logdir: string;

    reCaptchaCheck: (UserToken: string, ip: string) => [stated: boolean, msg: string];
    constructor(
        props: {
            messagePageName: string, pages: Pages, paths: any, app: Express, alldir: Dirs,
            reCaptchaCheck: (UserToken: string, ip: string) => [boolean, string]
        }) {

        this.alldir = props.alldir;
        this.logdir = join(this.alldir.back_end, "logs")
        this.app = props.app;
        this.pages = props.pages;
        this.paths = props.paths;
        this.messagePageName = props.messagePageName;

        this.reCaptchaCheck = props.reCaptchaCheck || ((_: string, __: string) => {
            return [true, "its not supported on this server yet"]
        })


    }

    message(str: string) {
        return this.page(this.messagePageName || "message").replace('//${globalData}', toJs({ message: str }))
    }

    page(name: string) {
        if (!this.pages[name]) {
            throw `you don't have ${name} page`
        }
        return fs.readFileSync(join(this.alldir.front_end, "./../template.html"), "utf-8").replace(`src='./bundle.js'`, `src='${join(this.pages[name].dir, "bundle.js")}'`)
    }

    setPage(res: Response, name: string, options?: any) {
        //console.log("setPage?")
        res.send(this.page(name).replace('//${globalData}', toJs(options)))
    }

    path(name: string) {
        return join(_dirname, "plugins", this.alldir.maindir, this.paths[name])
    }

}

