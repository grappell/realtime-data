<script>
    import { PUBLIC_ADMIN_PASSWORD } from '$env/static/public';
    import { onMount } from 'svelte';

    let { data, children } = $props();
    let isLoggedIn = $state(false);
    let passwordInput = $state('');
    let errorMessage = $state('');

    onMount(() => {

        const stored = sessionStorage.getItem('adminLoggedIn');
        if (stored === 'true') {
            isLoggedIn = true;
        }

        const handleKeyDown = (e) => {
            if (e.altKey && e.key === 'q') {
                handleLogout();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    });

    function handleLogin(e) {
        e.preventDefault();
        if (passwordInput === PUBLIC_ADMIN_PASSWORD) {
            isLoggedIn = true;
            sessionStorage.setItem('adminLoggedIn', 'true');
            passwordInput = '';
            errorMessage = '';
        } else {
            errorMessage = 'Incorrect password';
            passwordInput = '';
        }
    }

    function handleLogout() {
        isLoggedIn = false;
        sessionStorage.removeItem('adminLoggedIn');
        passwordInput = '';
        errorMessage = '';
    }
</script>

{#if isLoggedIn}
    {@render children()}
{:else}
    <div class="max-w-dvw min-h-dvh bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div class="w-full max-w-md">
            <div class="bg-slate-700 rounded-lg p-8 shadow-lg">
                <h1 class="text-3xl font-bold mb-8 text-center text-white">Admin Login</h1>
                <form onsubmit={handleLogin} class="space-y-6">
                    <div>
                        <label for="password" class="block text-sm font-semibold mb-2 text-white">Password</label>
                        <input
                            id="password"
                            type="password"
                            bind:value={passwordInput}
                            placeholder="Enter admin password"
                            class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
                        />
                    </div>
                    {#if errorMessage}
                        <div class="bg-red-600 text-white p-3 rounded text-center text-sm">
                            {errorMessage}
                        </div>
                    {/if}
                    <button
                        type="submit"
                        class="w-full bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-semibold text-white transition"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    </div>
{/if}
<style>
    :global(html, body) {
        background: linear-gradient(to bottom right, rgb(15, 23, 42), rgb(30, 41, 59));
    }
</style>