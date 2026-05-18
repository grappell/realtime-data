<script>
	import './layout.css';
	import favicon from '$lib/assets/clock.svg';
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Realtime Survey</title>
</svelte:head>
{@render children()}
<style>
	:global(html, body) {
        background: linear-gradient(to bottom right, rgb(15, 23, 42), rgb(30, 41, 59));
    }
</style>