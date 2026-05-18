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
