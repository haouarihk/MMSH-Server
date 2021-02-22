<script lang="ts">
    import pdh from "param-handler";

    export let setToken: (_token: string) => void;

    export let errorMessage: Function;
    export let vmod: number;
    let directSubmitting: boolean = false,
        highlighted: boolean = false,
        typesVisible: boolean = true,
        submitBTNVisible: boolean = true,
        inputVisible: boolean = false;

    const ph = new pdh.QParamer(window);

    const paramChecker = (prm, oud, reverse: boolean = false) => {
        return prm === undefined
            ? oud
            : prm === null || prm
            ? !reverse
            : reverse;
    };

    let maintype = paramChecker(ph.get("type"), 0);

    console.log(typesVisible, ph.get("hidetypes"));

    typesVisible = paramChecker(ph.get("hidetypes"), typesVisible, true);

    inputVisible = !paramChecker(ph.get("hideinput"), inputVisible, true);

    let selectedType: number = maintype;

    if (paramChecker(ph.get("hideinput"), false)) {
        submitBTNVisible = false;
        directSubmitting = ph.get("direct");
    }

    if (paramChecker(ph.get("portable"), false)) {
        directSubmitting = true;
        typesVisible = false;
        inputVisible = false;
        submitBTNVisible = false;
    }

    function highlight(e) {
        highlighted = true;
    }

    function unhighlight(e) {
        highlighted = false;
    }

    //@ts-ignore
    let _globalData = globalData;
    let compilers: { name: string }[] = Object.keys(_globalData.compilers).map(
        (key) => _globalData.compilers[key]
    );

    let files: any = [];
    let dataTransfer: { files: any } = { files: [] };

    let input: any = dataTransfer;

    function handleDrop(e) {
        dataTransfer = e.dataTransfer;
        input.files = dataTransfer.files;
        files = input.files;

        unhighlight(e);

        if (directSubmitting) {
            clickSubmit();
        }
    }

    let submitable: boolean = false;

    $: {
        submitable = files.length == 0;
    }

    function clickSubmit() {
        grecaptcha.ready(() => {
            grecaptcha
                .execute(process.env.SITEKEY, { action: "submit" })
                .then(submitit);
        });
    }

    async function submitit(token: string) {
        var data = new FormData();

        // the file
        data.append("file", input.files[0]);

        // the compiler type
        data.append("type", "" + selectedType);

        // the user captcha token
        data.append("g-recaptcha", token);

        // changing the view mode to "in progress.."
        vmod = 1;

        const result = await fetch("./upload", {
            method: "POST",
            body: data,
        });

        switch (result.status) {
            case 200:
                setToken(await result.text());
                break;

            default:
                errorMessage((await result.json()).message);
                break;
        }
    }
</script>

<svelte:head>
    <script src="/captcha"></script>
</svelte:head>


<div
    id="main"
    class={highlighted ? "highlight" : ""}
    on:dragenter|preventDefault={highlight}
    on:dragover|preventDefault={highlight}
    on:dragleave|preventDefault={unhighlight}
    on:drop|preventDefault={handleDrop}
>
    <div>Drag and Drop</div>

    <div
        class="g-recaptcha"
        data-sitekey={process.env.SITEKEY}
        data-callback="verifyUser"
    />

    {#if submitBTNVisible}
        <input
            type="button"
            on:click={clickSubmit}
            value="submit"
            disabled={!compilers || submitable}
        /><br />
    {/if}

    {#if typesVisible}
        <div style="padding:10px 10px;">
            <h3>
                compile with
                <select name="type" default={false} bind:value={selectedType}>
                    {#each compilers as option}
                        <option value={option.name}>{option.name}</option>
                    {/each}
                </select>
            </h3>
        </div>
    {/if}
</div>

<style>
    * {
        transition: all 0.4s;
        font-size: 5vw;
    }

    #main {
        padding: 5vw;
        position: fixed;
        width: 100%;
        height: 100%;
        text-align: center;
        border: 10vh dashed #c3d3d8;
    }

    .highlight {
        color: white;
        border: 10vh solid rgb(251, 244, 244) !important;
        background: #4dd5ff;
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
