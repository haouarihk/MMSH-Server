<script lang="ts">
    //@ts-ignore
    export let message: string = globalData.message;
</script>

<main>
    <div id="main">
        <div class="fof">
            <h1>{message}</h1>
            <a href=""> go Back?</a>
        </div>
    </div>
</main>

<style>
    * {
        transition: all 0.6s;
        font-size: 1.5vw !important;
    }

    #main {
        width: 100%;
        margin-top: 20vw;
        text-align: center;
    }

    .fof {
        display: table-cell;
        vertical-align: middle;
    }

    .fof h1 {
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
