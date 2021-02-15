import { Request, Response } from "express";
import express from 'express';

import * as http from "http"
import { join } from "path";
import Router from "./router.js";

import arp from "app-root-path";
const _dirname = arp.path


import { data } from '../d/types';

import fetch from 'node-fetch';


export default class Server {
    private PORT: number;
    plugins: data.Plugin[];
    app: any;
    hoster: http.Server | undefined;
    settings: data.Settings;

    recaptchaKey: string;
    http: http.Server
    constructor(settings: data.Settings) {
        this.settings = settings;
        this.plugins = [];
        this.PORT = settings.port || 5222;

        this.app = express()

        this.http = http.createServer(this.app);

        this.recaptchaKey = settings.recaptchaKey;
    }

    async start() {

        this.app.use(express.static(join(_dirname, "front-end/public")))

        this.runMain()


        // set up the server
        this.http.listen(this.PORT, () => {
            console.log(`Server Started: http://localhost:${this.PORT}`);
        });




    }


    runMain() {
        let alldir = {
            front_end: join(_dirname, this.settings.front_end_out_dir, "public"),
            maindir: "",
            back_end: ""
        }
        let a: any = {}
        let rut = new Router({

            alldir,
            ...a
        })
        rut.pages = {
            main: {
                name: "main",
                dir: "/main"
            }
        }

        this.app.get(`/`, (_: Request, res: Response) => {
            rut.setPage(res, "main", {
                plugins: this.plugins.map((a) => {
                    return {
                        name: a.name,
                        discription: a.discription,
                        maindir: a.maindir
                    }
                })
            })
        })
    }

    async use(plugin: any, tson: data.Plugin) {
        // possible breaking path
        let alldir = {
            maindir: tson.maindir,
            front_end: join(_dirname, this.settings.front_end_out_dir, tson.maindir),
            back_end: join(_dirname, "plugins", tson.maindir)
        }


        this.plugins.push(tson);



        plugin.app = {
            ...this.app
        };

        plugin.router = new Router({
            reCaptchaCheck: (a: string, b: string) => this.reCaptchaCheck(a, b),
            ...tson.routerConfig,
            alldir
        })

        plugin.alldir = alldir;

        Object.keys(tson.config).forEach((_k: string) => {
            plugin[_k] = { ...tson.config[_k] }
        })

        plugin.start()
    }


    async reCaptchaCheck(CaptchaBody: string, remoteAddress: string) {
        const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURI(this.recaptchaKey)}&amp;response=${encodeURI(CaptchaBody)}&amp;remoteip=${encodeURI(remoteAddress)}`;


        let data = await fetch(verificationURL)
        let body: any = await data.json();

        if (body.success == undefined && !body.success) {
            return [false, "Failed captcha verification"]
        }
        return [true, "Sucess"]
    }
}