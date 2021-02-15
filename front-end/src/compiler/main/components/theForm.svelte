<script lang="ts">
    export let form, input;
    export let selectedType: any;
</script>

<form
    id="fileUpload"
    class="fileupload fof"
    action="./upload"
    method="post"
    enctype="multipart/form-data"
    bind:this={form}
>
    <div>Drag and Drop</div>
    <br />
    <input type="file" name="file" bind:this={input} hidden />
    <input name="type" value={selectedType} hidden />

    <div class="g-recaptcha" data-sitekey="key" data-callback="verifyUser" />
</form>
