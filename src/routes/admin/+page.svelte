<svelte:options runes={false} />
<script>
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase.js';
  import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

  let sessionCode = '';
  let isAuthenticated = false;
  let newQuestionText = '';
  let newOptions = '';
  let questions = [];
  let responses = [];
  let isCreating = false;
  let questionsUnsubscribe;
  let responsesUnsubscribe;

  const ADMIN_CODE = 'admin123'; // Change this to a secure code

  onMount(() => {
    return () => {
      if (questionsUnsubscribe) questionsUnsubscribe();
      if (responsesUnsubscribe) responsesUnsubscribe();
    };
  });

  function setSession() {
    if (sessionCode === ADMIN_CODE) {
      isAuthenticated = true;
      loadData();
    } else {
      alert('Invalid admin code');
    }
  }

  function loadData() {
    // Listen to questions
    const questionsRef = collection(db, 'questions');
    const questionsQuery = query(questionsRef, orderBy('timestamp', 'desc'));
    questionsUnsubscribe = onSnapshot(questionsQuery, (snapshot) => {
      questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });

    // Listen to responses
    const responsesRef = collection(db, 'responses');
    const responsesQuery = query(responsesRef, orderBy('timestamp', 'desc'));
    responsesUnsubscribe = onSnapshot(responsesQuery, (snapshot) => {
      responses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });
  }

  async function createQuestion() {
    console.log("create-question ran")
    if (!newQuestionText.trim() || !newOptions.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const options = newOptions.split(',').map(opt => opt.trim()).filter(opt => opt);
    isCreating = true;

    try {
      const questionsRef = collection(db, 'questions');
      await addDoc(questionsRef, {
        text: newQuestionText,
        options: options,
        timestamp: new Date(),
        createdAt: new Date().toISOString()
      });
      newQuestionText = '';
      newOptions = '';
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Failed to create question');
    } finally {
      isCreating = false;
    }
  }

  function getResponseStats(questionId) {
    const qResponses = responses.filter(r => r.questionId === questionId);
    const stats = {};
    qResponses.forEach(r => {
      stats[r.answer] = (stats[r.answer] || 0) + 1;
    });
    return stats;
  }
</script>

<div class="w-dvw min-h-dvh bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl font-bold mb-8 text-center">Survey Admin Dashboard</h1>

    {#if !isAuthenticated}
      <div class="max-w-md mx-auto bg-slate-700 rounded-lg p-8">
        <h2 class="text-2xl font-semibold mb-4">Admin Access</h2>
        <input
          type="password"
          placeholder="Join Existing Session"
          bind:value={sessionCode}
          class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-blue-400"
        />
        <button
          onclick={{authenticate: setSession}}
          class="w-full bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-semibold transition"
        >
          Join
        </button>
        <hr class="mx-3 my-5 "/>
        <button onclick={createSession} class="w-full bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-semibold transition">Create Session</button>
      </div>
    {:else}
      <div class="grid md:grid-cols-2 gap-8">
        <!-- Create Question Section -->
        <div class="bg-slate-700 rounded-lg p-6">
          <h2 class="text-2xl font-semibold mb-4">Create New Question</h2>
          <textarea
            placeholder="Enter question text"
            bind:value={newQuestionText}
            class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 mb-3 focus:outline-none focus:border-blue-400"
            rows="3"
          />
          <textarea
            placeholder="Enter options separated by commas (e.g., Yes, No, Maybe)"
            bind:value={newOptions}
            class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-blue-400"
            rows="2"
          />
          <button
            onclick={createQuestion}
            disabled={isCreating}
            class="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-500 px-6 py-2 rounded font-semibold transition"
          >
            {isCreating ? 'Creating...' : 'Create Question'}
          </button>
        </div>

        <!-- Recent Questions Section -->
        <div class="bg-slate-700 rounded-lg p-6">
          <h2 class="text-2xl font-semibold mb-4">Recent Questions</h2>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            {#each questions.slice(0, 10) as question (question.id)}
              <div class="bg-slate-600 p-3 rounded">
                <p class="font-semibold">{question.text}</p>
                <p class="text-sm text-slate-300">Options: {question.options?.join(', ')}</p>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Responses Section -->
      <div class="mt-8 bg-slate-700 rounded-lg p-6">
        <h2 class="text-2xl font-semibold mb-4">Responses Summary</h2>
        <div class="space-y-4 max-h-96 overflow-y-auto">
          {#each questions.slice(0, 5) as question (question.id)}
            {@const stats = getResponseStats(question.id)}
            {@const totalResponses = responses.filter(r => r.questionId === question.id).length}
            <div class="bg-slate-600 p-4 rounded">
              <p class="font-semibold mb-2">{question.text}</p>
              <p class="text-sm text-slate-300 mb-3">Total Responses: {totalResponses}</p>
              <div class="space-y-1 text-sm">
                {#each question.options || [] as option}
                  {@const count = stats[option] || 0}
                  {@const percentage = totalResponses > 0 ? ((count / totalResponses) * 100).toFixed(1) : 0}
                  <div class="flex justify-between">
                    <span>{option}: {count}</span>
                    <span class="text-slate-400">{percentage}%</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <button
        onclick={() => (isAuthenticated = false)}
        class="mt-8 block mx-auto bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition"
      >
        Logout
      </button>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
