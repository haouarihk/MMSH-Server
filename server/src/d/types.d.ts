export interface compiler {
    name: string;
    commander: string;
    CompilerPath: string;
    command: string;
    outputT: string;
    whitelistInputs: string[];
}



export interface Page {
    name: string;
    dir: string;
}

export interface Pages {
    [key: string]: Page
}


export interface Dirs {
    maindir: string;
    front_end: string;
    back_end: string;
}



declare module data {

    export interface Input {
        file: string;
    }

    export interface Output {
        file: string;
    }

    export interface Config {
        [key: string]: [any: any]
    }

    export interface Plugin {
        name: string;
        discription: string;
        maindir: string;
        input: Input;
        output: Output;
        config: Config;
        routerConfig: any;
    }

    export interface Settings {
        port: number;
        front_end_div_dir: string;
        front_end_out_dir: string;
        plugins: Plugin[];

        // from .env
        recaptchaKey: string;
    }

}
