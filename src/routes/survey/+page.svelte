<svelte:options runes={false} />
<script>
  import { goto } from '$app/navigation';
	import { db } from '$lib/firebase';
	import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
  import { onMount } from 'svelte';

  let sessionGuess = '';
  let checking = false;
  let validSession = true;

  async function checkAndNavigate() {

    console.log("running")
    if (!sessionGuess) return;
    validSession = true;
    checking = true;
    
    try {
      console.log("try")
      let docs = await getDocs(query(collection(db, "sessions"), where("sessionName", "==", sessionGuess)))
      if(docs.empty){
        validSession = false;
        return;
      }
      await goto("/survey/" + docs.docs[0].id);
    } catch (e) {
      console.error(e);
      alert('Error checking session');
    } finally {
      checking = false;
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') checkAndNavigate();
  }
</script>

<div class="bg-slate-700 flex flex-col justify-center h-dvh w-dvw">
  <div class="max-w-[60%] m-auto text-white flex flex-col justify-around w-full gap-7">
    <label for="session" style="font-weight: 600" class="text-xl">Join with code</label>
    <input
      id="session"
      type="text"
      bind:value={sessionGuess}
      on:keydown={onKey}
      style="padding: 0.75rem 1rem; border: 1px solid rgba(0, 0, 0, 0.2); border-radius: 0.5rem; color: inherit; outline: none; width: 100%; box-sizing: border-box;"
      class="bg-slate-900"
    />
    <div>
      <button
        on:click={checkAndNavigate}
        disabled={checking || !sessionGuess}
        style="padding: 0.75rem 1rem; border: 1px solid {validSession ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.8)'}; border-radius: 0.5rem; background: {validSession ? 'rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.4)'}; color: inherit; font: inherit; cursor: pointer; opacity: {checking || !sessionGuess ? 0.6 : 1};"
        class="w-full"
      >
        {checking ? 'Checking...' : 'Go'}
      </button>
      <p class="text-red-500 mt-3 text-center font-stretch-95% {validSession ? 'opacity-0': 'opacity-100'}">Invalid code. Please try again</p>
    </div>
  </div>
</div>
