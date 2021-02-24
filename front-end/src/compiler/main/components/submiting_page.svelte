<script lang="ts">
    import pdh from "param-handler";
    import DropArea from "./dropArea.svelte";

    export let setToken: (_token: string) => void;

    export let errorMessage: Function;
    export let vmod: number;
    let hoverViewingAllOptions: boolean = true,
        directSubmitting: boolean = false,
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

    const maintype = paramChecker(ph.get("type"), 0);

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
        hoverViewingAllOptions = false;
        typesVisible = false;
        inputVisible = false;
        submitBTNVisible = false;
    }

    //@ts-ignore
    const _globalData = globalData;
    const compilers: { name: string }[] = Object.keys(
        _globalData.compilers
    ).map((key) => _globalData.compilers[key]);

    let input;
    let files: any = [];

    function onHover(_e) {
        hoverViewingAllOptions = false;
    }

    function onExit(_e) {
        hoverViewingAllOptions = true;
    }

    function handleDrop(e) {
        files = e.dataTransfer.files;

        if (directSubmitting) {
            clickSubmit();
        }
    }

    let submitable: boolean = false;

    $: {
        submitable = files > 0;
    }

    // captcha checking
    function clickSubmit() {
        grecaptcha.ready(() => {
            grecaptcha
                .execute(process.env.SITEKEY, { action: "submit" })
                .then(submitit);
        });
    }

    // submiting the form
    async function submitit(token: string) {
        var data = new FormData();

        // the file
        data.append("file", files[0]);

        // the compiler type
        data.append("type", `${selectedType}`);

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

<DropArea
    {handleDrop}
    {onHover}
    {onExit}
    onClick={() => {
        if (!hoverViewingAllOptions) input.click();
    }}
>
    <div>Drag and Drop</div>

    <input type="file" name="file" bind:files bind:this={input} hidden />

    {#if hoverViewingAllOptions}
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
                    <select
                        name="type"
                        default={false}
                        bind:value={selectedType}
                    >
                        {#each compilers as option}
                            <option value={option.name}>{option.name}</option>
                        {/each}
                    </select>
                </h3>
            </div>
        {/if}
    {/if}
</DropArea>

<style>
    * {
        transition: all 0.4s;
        font-size: 5vw;
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
