<script lang="ts">
    export let name: string = "default";
    export let discription: string = "no discription avaliable";
    export let maindir: string = "/defualt";
</script>

<div class="gallery_product col-lg-4 col-md-4 col-sm-4 col-xs-6 filter hdpe">
    <div class="card" style="width: 18rem;">
        <div class="card-body">
            <h5 class="card-title">{name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">{maindir}</h6>
            <p class="card-text">
                {discription}
            </p>
            <a href={maindir} class="card-link">Open</a>
        </div>
    </div>
</div>

<style>
    .card-link {
        color: brown;
        border: burlywood;
        transition: color 0.5s;
    }
    .card-link:hover {
        color: rgb(235, 148, 148);
        transition: color 0.5s;
    }
</style>
