<svelte:options runes={false} />
<script>
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase.js';
  import { collection, onSnapshot, addDoc, query, where, orderBy, limit } from 'firebase/firestore';

  let currentQuestion = null;
  let selectedAnswer = '';
  let loading = true;
  let submitted = false;
  let userCode = '';
  let isAnswering = false;
  let questionsUnsubscribe;

  onMount(() => {
    // Real-time listener for the latest active question
    const questionsRef = collection(db, 'questions');
    const q = query(questionsRef, orderBy('timestamp', 'desc'), limit(1));
    
    questionsUnsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.docs.length > 0) {
        currentQuestion = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        };
        selectedAnswer = '';
        submitted = false;
      } else {
        currentQuestion = null;
      }
      loading = false;
    });

    return () => {
      if (questionsUnsubscribe) questionsUnsubscribe();
    };
  });

  async function submitAnswer() {
    if (!selectedAnswer || !userCode) {
      alert('Please enter your code and select an answer');
      return;
    }

    isAnswering = true;
    try {
      const responsesRef = collection(db, 'responses');
      await addDoc(responsesRef, {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        answer: selectedAnswer,
        userCode: userCode,
        timestamp: new Date(),
      });
      submitted = true;
      selectedAnswer = '';
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer');
    } finally {
      isAnswering = false;
    }
  }
</script>

<div class="w-dvw min-h-dvh bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-4xl font-bold mb-8 text-center">Live Survey</h1>

    {#if loading}
      <div class="text-center py-20">
        <p class="text-lg">Loading question...</p>
      </div>
    {:else if !currentQuestion}
      <div class="text-center py-20 bg-slate-700 rounded-lg">
        <p class="text-lg">No active questions at the moment</p>
      </div>
    {:else}
      <div class="bg-slate-700 rounded-lg p-8 shadow-lg">
        <!-- Question Display -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-6">{currentQuestion.text}</h2>

          {#if submitted}
            <div class="bg-green-600 p-4 rounded text-center font-semibold mb-6">
              ✓ Response submitted successfully!
            </div>
          {/if}

          <!-- Answer Options -->
          <div class="space-y-3 mb-6">
            {#each currentQuestion.options || [] as option (option)}
              <label class="flex items-center p-4 bg-slate-600 hover:bg-slate-500 rounded cursor-pointer transition">
                <input
                  type="radio"
                  name="answer"
                  value={option}
                  bind:group={selectedAnswer}
                  class="w-4 h-4 mr-3"
                  disabled={submitted}
                />
                <span class="text-lg">{option}</span>
              </label>
            {/each}
          </div>

          <!-- User Code Input -->
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-2">Your Code:</label>
            <input
              type="text"
              placeholder="Enter your participant code"
              bind:value={userCode}
              disabled={submitted}
              class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          <!-- Submit Button -->
          <button
            on:click={submitAnswer}
            disabled={isAnswering || submitted || !selectedAnswer || !userCode}
            class="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed px-6 py-3 rounded font-semibold transition"
          >
            {#if isAnswering}
              Submitting...
            {:else if submitted}
              ✓ Submitted
            {:else}
              Submit Answer
            {/if}
          </button>
        </div>

        <!-- Question Metadata -->
        <div class="text-sm text-slate-400 border-t border-slate-600 pt-4">
          <p>Question ID: {currentQuestion.id}</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
