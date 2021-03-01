import fs from "fs"
import { join } from "path"
import { Request, Response } from "express";
import * as Socket from "socket.io"
import { data } from "../d/types";

export const forEachSync = async function (that: any, cb: (element: any, index: number) => Promise<void>) {
    for (let i = 0; i < that.length; i++) {
        await cb(that[i], i)
    }
}


export function toJs(obj: any) {
    return `let globalData=${JSON.stringify(obj)};`
}

let settings: data.Settings;
/** setup the settings variable */
export function setupConfig(path: string): data.Settings {
    return settings = JSON.parse(fs.readFileSync(path, "utf-8"));
}

/** get a file from the mainfolder */
export function get(pluginName: string, path: string) {
    return JSON.parse(fs.readFileSync(join(settings.plugins_dir, pluginName, path), "utf-8"));
}


export function find(obj: any, value: string): string {
    let result: string = ""
    Object.keys(obj).forEach((key: string) => {
        if (obj[key] == value) {
            result = key;
        }
    });
    return result
}




export namespace throttleHanding {
    interface ipData {
        firstCreated: number;
        lastAccess: number;
        accessCount: number;
        markedForDisconnect: boolean;
        blacklisted: boolean;
    }
    export const Sec = 1000;
    export const Min = Sec * 60;
    export const Hour = Min * 60;
    export const ips: any = {}
    export const defaultIpData: ipData = {
        firstCreated: 0,
        lastAccess: 0,
        accessCount: 0,
        markedForDisconnect: false,
        blacklisted: false,
    }

    export function getIpFromRequest(req: Request): string | any {
        //@ts-ignore
        return req.ip | req.ips | req.connection.remoteAddress;
    }

    export function getIpFromSocket(socket: Socket.Socket): string {
        let ip = socket.request.connection.remoteAddress
        return ip != undefined ? ip : "";
    }


    export function canBeServed(ip: string, disconnect: Function, maxDiffer: number = 50) {
        const now = Date.now();

        if (ips[ip] == undefined)
            ips[ip] = {
                ...defaultIpData, firstCreatedAt: new Date()
            }
        else {
            // add 1 to accessCount whenever a connection happen
            ips[ip].accessCount++;
            if (ips[ip].blacklisted) {
                disconnect()
                return false
            }

            // First layer: Calculate how many connections each second
            const connectionssPerSecond = (ips[ip].accessCount / (now - ips[ip].firstCreated)) / Sec;

            // if the connectionssPerSecond is too high then blacklist the Ip
            if (connectionssPerSecond > 300) {
                console.log(`ip ${ip} has been blacklisted`)
                ips[ip].blacklisted = true;
            }

            // Second layer: Calculate the time between now and the last time the user made a connection
            const diff = now - ips[ip].lastAccess;

            // Disconnect the user if the diff is too low
            if (diff < maxDiffer) {
                ips[ip].markedForDisconnect = true;
                disconnect()
                return false;
            }
        }
        ips[ip].lastAccess = now;
        return true;
    }

    export function socketCanBeServed(socket: Socket.Socket, packet: any[]) {
        return canBeServed(getIpFromSocket(socket), () => {
            setTimeout(() => {
                console.info("a socket connection has been blocked")
                socket.disconnect();
            }, Sec);
        })
    }

    export function expressCanBeServed(req: Request, res: Response, next: Function) {
        if (canBeServed(getIpFromRequest(req), () => {
            setTimeout(() => {
                console.info("an express connection has been blocked")
                res.status(503).send();
                res.end();
            }, 0.1);
        }, 0))
            next();
    }
}

