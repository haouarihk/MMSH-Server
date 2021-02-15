<script lang="ts">
    export let url = "";

    window.location.href = url;
</script>

<div id="main" class="fof">
    <div id="text">Finished compiling!</div>
    <div id="text2">Your download will start soon..</div>
    <div id="text3">
        Incase it didn't, click <a href={url}>here</a>
    </div>
    <br />
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
    @keyframes type {
        from {
            box-shadow: inset -3px 0px 0px #888;
        }

        to {
            box-shadow: inset -3px 0px 0px transparent;
        }
    }
</style>
