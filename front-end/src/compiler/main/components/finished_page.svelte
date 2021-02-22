<script lang="ts">
    export let url = "";

    window.location.href = url;
</script>

<div id="main" class="fof">
    <div id="text">Finished compiling!</div>
    <div id="text2">Your download will start soon..</div>
    <div id="text3">
        Incase it didn't, click <a href={`./${url}`}>here</a>
    </div>

    <form action="https://www.overleaf.com/docs" method="post" target="_blank">
        <input type="text" name="snip_uri" value={location.href + url} hidden />
        <input class="openInOverleaf" type="submit" value="Open in Overleaf" />
    </form>
    <br />
    <!-- svelte-ignore a11y-invalid-attribute -->
    <a href=""> go Back?</a>
</div>

<style>
    * {
        transition: all 0.4s;
        font-size: 7vh;
    }

    #text2 {
        font-size: 5vh;
    }
    #text3,
    a {
        font-size: 4vh;
    }

    #main {
        width: 100%;
        margin-top: 20vw;
        text-align: center;
    }

    .openInOverleaf {
        padding: 4px 10px 5px;
        font-size: 14px;
        line-height: 1.5;
        border-radius: 9999px;
        color: #fff;
        background-color: #138a07;
        border-color: transparent;
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
