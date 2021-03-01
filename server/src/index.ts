import type { data } from "./d/types";
import { forEachSync, setupConfig, get } from './components/utils';

//importing the server
import Server from "./components/server"
//



//- importing settings
const settings: data.Settings = setupConfig('/shared/config/settings.json');

//- setting up the main server
let sr = new Server(settings);





//- importing plugins

//-- compiler
const chCofig = get("compiler", './config.json')
import * as Conv from "converter-toless-plugin"




//- setting up each plugin
(async () => {
    await sr.start();
    //- awaits for each plugin to be ready
    await forEachSync(settings.plugins, async (plug: any) => {
        switch (plug.maindir) {
            case "compiler":
                let _plugin = new Conv.default({ debug: false })
                await sr.use(_plugin, { ...plug, ...chCofig })

        }
    });
})()



