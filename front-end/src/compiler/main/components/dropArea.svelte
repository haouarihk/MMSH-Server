<script lang="ts">
    let highlighted: boolean = false;
    export let handleDrop: (e: any) => void;
    function _handleDrop(e) {
        handleDrop(e);
        unhighlight();
    }

    function highlight() {
        highlighted = true;
    }

    function unhighlight() {
        highlighted = false;
    }
</script>

<div
    id="main"
    class={highlighted ? "highlight" : ""}
    on:dragenter|preventDefault={highlight}
    on:dragover|preventDefault={highlight}
    on:dragleave|preventDefault={unhighlight}
    on:drop|preventDefault={_handleDrop}
>
    <slot />
</div>

<style>
    #main {
        padding: 5vw;
        position: fixed;
        width: 100%;
        height: 100%;
        text-align: center;
        border: 10vh dashed #c3d3d8;
    }

    .highlight {
        color: rgba(255, 255, 255, 0.678);
        border: 5vh solid rgb(251, 244, 244) !important;
        background: #ff9d4d;
    }
</style>
