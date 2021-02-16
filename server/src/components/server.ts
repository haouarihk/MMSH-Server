import { Request, Response } from "express";
import express from 'express';

import * as http from "http"
import { join } from "path";
import Router from "./router.js";

import arp from "app-root-path";
const _dirname = arp.path


import { data } from '../d/types';

import fetch from 'node-fetch';

import * as Socket from "socket.io"
import { find } from "./utils.js";


export default class Server {
    private PORT: number;
    plugins: data.Plugin[];
    app: any;
    hoster: http.Server | undefined;
    settings: data.Settings;

    recaptchaKey: string;
    http: http.Server;


    // socket stuff
    io: Socket.Server;
    users: any;
    availableTokens: string[];


    constructor(settings: data.Settings) {
        this.settings = settings;
        this.plugins = [];
        this.PORT = settings.port || 5222;

        this.app = express()

        this.http = http.createServer(this.app);

        this.io = new Socket.Server(this.http)

        this.recaptchaKey = settings.recaptchaKey;


        this.users = {};
        this.availableTokens = [];
    }

    async start() {

        this.app.use(express.static(join(_dirname, "front-end/public")))

        this.runMain()

        this.runSocket()

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

    runSocket() {
        this.io.on('connection', (socket: Socket.Socket) => {

            socket.on("disconnect", () => {
                console.log("a user disconnected")
                if (!this.users[socket.id]) return;

                const ti = this.availableTokens.indexOf(this.users[socket.id])

                if (ti > -1) {
                    delete this.users[socket.id]
                    this.availableTokens = this.availableTokens.splice(ti, 1)
                }
            })

            socket.on("takeMyToken", (token: string) => {
                console.log("a user with token->", token)
                if (this.availableTokens.indexOf(token) > -1)
                    this.users[socket.id] = token;
                else
                    socket.disconnect()
            })

            console.log('a user connected');
        });
    }

    async use(plugin: any, tson: data.Plugin) {
        // possible breaking path
        let alldir = {
            maindir: tson.maindir,
            front_end: join(_dirname, this.settings.front_end_out_dir, tson.maindir),
            back_end: join(_dirname, "plugins", tson.maindir)
        }

        this.plugins.push(tson);

        // giving the express app to the plugin
        plugin.app = {
            ...this.app
        };

        // giving router to the plugin
        plugin.router = new Router({
            // Socket stuff for logs while in proccess
            newSocketMessage: (token: string, event: string, message: any) => {
                console.log(token, event, message)
                let socketid = find(this.users, token);
                if (socketid == "") return
                this.io.to(socketid).emit(event, message)
            },

            // adding a new available token
            newSocketUser: (token: string) => { console.log(token), this.availableTokens.push(token) },

            // adding a new available token
            endSocketUser: (token: string) => {
                let socketid = find(this.users, token);
                if (socketid == "") return
                this.io.to(socketid).removeAllListeners()
                this.availableTokens.splice(this.availableTokens.indexOf(token), 1)
            },

            // for verifiying google captcha
            reCaptchaCheck: (a: string, b: string) => this.reCaptchaCheck(a, b),

            // data
            ...tson.routerConfig,

            // paths
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