<script lang="ts">
    let highlighted: boolean = false;
    export let handleDrop: (e: any) => void;
    export let onHover: (e: any) => void = () => {};
    export let onExit: (e: any) => void = () => {};
    function _handleDrop(e) {
        handleDrop(e);
        unhighlight(e);
    }

    function highlight(e) {
        onHover(e);
        highlighted = true;
    }

    function unhighlight(_e) {
        onExit(_e);
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
        transition: all 0.1s;
    }

    .highlight {
        color: rgba(255, 255, 255, 0.678);
        border: 0vh dashed rgb(251, 244, 244) !important;
        background: #ff9d4d;
        transition: all 0.2s;
    }
</style>
