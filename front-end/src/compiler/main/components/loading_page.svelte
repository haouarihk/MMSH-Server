<script lang="ts">
</script>

<div id="main" class="fof">
    <h1 id="text">In Progress..</h1>
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
