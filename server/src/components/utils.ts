import fs from "fs"
import { join } from "path"

import arp from "app-root-path";
import * as Socket from "socket.io"
const _dirname = arp.path

export const forEachSync = async function (that: any, cb: (element: any, index: number) => Promise<void>) {
    for (let i = 0; i < that.length; i++) {
        await cb(that[i], i)
    }
}


export function toJs(obj: any) {
    return `let globalData=${JSON.stringify(obj)};`
}

export function get(path: string) {
    return JSON.parse(fs.readFileSync(join(_dirname, path), "utf-8"));
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

    export function getIpFromSocket(socket: Socket.Socket): string {
        let ip = socket.request.connection.remoteAddress
        return ip != undefined ? ip : "";
    }

    export function canBeServed(socket: Socket.Socket, packet: any[]) {
        const ip = getIpFromSocket(socket);

        const now = Date.now();
        const disconnect = () => {
            setTimeout(() => {
                socket.disconnect(true);
            }, Sec);
        }

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
                ips[ip].blacklisted = true;
            }

            // Second layer: Calculate the time between now and the last time the user made a connection
            var diff = now - ips[ip].lastAccess;

            // Disconnect the user if the diff is too low
            if (diff < 50) {
                ips[ip].markedForDisconnect = true;
                disconnect()
                return false;
            }
        }
        ips[ip].lastAccess = now;
        return true;
    }
}

