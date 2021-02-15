<script lang="ts">
    import PluginItem from "./components/pluginItem.svelte";
    // @ts-ignore
    let pluginItems = globalData.plugins;
</script>

<div class="container">
    <div class="row">
        <div class="gallery col-lg-12 col-md-12 col-sm-12 col-xs-12">
            <h1 class="gallery-title">Features</h1>

            {#if pluginItems.length <= 0}
                Sorry there are no Features installed to this website
            {/if}
        </div>

        {#each pluginItems as _p}
            <PluginItem {..._p} />
        {/each}
    </div>
</div>

<style>
    .gallery-title {
        font-size: 36px;
        color: #42b32f;
        text-align: center;
        font-weight: 500;
        margin-bottom: 70px;
    }
    .gallery-title:after {
        content: "";
        position: absolute;
        width: 7.5%;
        left: 46.5%;
        height: 45px;
        border-bottom: 1px solid #5e5e5e;
    }
    .filter-button {
        font-size: 18px;
        border: 1px solid #42b32f;
        border-radius: 5px;
        text-align: center;
        color: #42b32f;
        margin-bottom: 30px;
    }
    .filter-button:hover {
        font-size: 18px;
        border: 1px solid #42b32f;
        border-radius: 5px;
        text-align: center;
        color: #ffffff;
        background-color: #42b32f;
    }
    .btn-default:active .filter-button:active {
        background-color: #42b32f;
        color: white;
    }

    .port-image {
        width: 100%;
    }

    .gallery_product {
        margin-bottom: 30px;
    }
</style>
