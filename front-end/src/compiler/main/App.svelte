<script lang="ts">
    import Message from "../message/message.svelte";
    import FinishedPage from "./components/finished_page.svelte";
    import LoadingPage from "./components/loading_page.svelte";
    import SubmitingPage from "./components/submiting_page.svelte";

    let vmod: number = 0;

    let message: string = "";
    const errorMessage = (_mesage: string): void => {
        message = _mesage;
        vmod = 3;
        console.log(message);
    };

    let url: string = "";
    const downloadTheFile = (_url: string): void => {
        url = _url;
        vmod = 2;
    };
</script>

<link src="https://www.google.com/recaptcha/api.js" />

{#if vmod == 1}
    <LoadingPage />
{:else if vmod == 2}
    <FinishedPage {url} />
{:else if vmod == 3}
    <Message {message} />
{:else}
    <SubmitingPage bind:vmod {errorMessage} {downloadTheFile} />
{/if}

<footer
    class="powerdby"
    style="top:{document.documentElement.scrollTop +
        (document.documentElement.clientHeight - this.offsetHeight)}"
>
    Powerd By <a href="http://www.Word2Latex.net">Word2Latex.net</a> Team
</footer>

<style>
    html {
        position: fixed;
        height: 100%;
    }

    body {
        position: fixed;
        font-family: "Lato", sans-serif;
        color: #888;
        margin: 0;
        height: 100%;
    }

    footer {
        bottom: 0;
        position: fixed;
        z-index: 150;
        height: 35px;
        opacity: 0.5;
    }
</style>
