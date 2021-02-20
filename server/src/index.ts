import type { data } from "./d/types";


import { join } from 'path';



import { forEachSync, get } from './components/utils';








//importing the server
import Server from "./components/server"
//






//- importing settings
const settings: data.Settings = get('./config/settings.json');
//

//- setting up the main server
let sr = new Server(settings);

//-




//- importing plugins

//--- compiler plugin
const chCofig = get('./plugins/compiler/config.json')
const chFontMainDir = join(settings.front_end_out_dir, settings.plugins[0].maindir)

import * as CH from "converter-toless-plugin"
//---
///-






// setting up each plugin
(async () => {
    await sr.start();
    // awaits for each plugin to be ready
    await forEachSync(settings.plugins, async (plug: any) => {
        switch (plug.maindir) {
            case "compiler":

                let _plugin = new CH.default({ debug: false })
                await sr.use(_plugin, { ...plug, ...chCofig })

        }
    });
    // starting the server

})()
//


