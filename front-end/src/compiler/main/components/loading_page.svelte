<script lang="ts">
    export let token: string;
    export let downloadTheFile: (url: string) => void;
    let log: string = "compiling";

    $: {
        console.log(token);
        if (token) {
            // @ts-ignore
            const socket = io();
            socket.on("url", downloadTheFile);
            socket.on("log", function (_log) {
                log = _log;
            });

            socket.emit("takeMyToken", token);
        }
    }
</script>

<div id="main" class="fof">
    <h1 id="text">In Progress..</h1>
    <h4 id="text">{log}</h4>
    <!-- svelte-ignore a11y-missing-attribute -->
    <img src="https://i.gifer.com/ZZ5H.gif" height="100px" width="100px" />
</div>

<style>
    * {
        transition: all 0.4s;
        font-size: 7vw;
    }

    #main {
        display: table;
        width: 100%;
        margin-top: 20vw;
        text-align: center;
    }
    .fof {
        height: 100%;
        vertical-align: middle;
        font-size: 50px;
        display: inline-block;
        padding-right: 12px;
        animation: type 0.5s alternate infinite;
    }

    @keyframes type {
        from {
            box-shadow: inset -3px 0px 0px #888;
        }

        to {
            box-shadow: inset -3px 0px 0px transparent;
        }
    }
</style>
