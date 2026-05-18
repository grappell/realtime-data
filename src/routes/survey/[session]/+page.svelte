<svelte:options runes={false} />
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth, db } from '$lib/firebase.js';
  import { collection, onSnapshot, addDoc, query, where, orderBy, limit, doc } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { getRedirectResult, GoogleAuthProvider } from 'firebase/auth';
	import { checkIfExists, checkIfMany } from '$lib/utils';
	import { fa } from '@faker-js/faker';

  $: sessionId = $page.params.session;

  // let currentQuestion = null;
  let selectedAnswer = '';
  let loading = true;
  let submitted = false;
  let userCode = '';
  let isAnswering = false;
  let questionsUnsubscribe;
  let sessionUnsubscribe;

  let questions = [];
  let activeQuestionId = "";
  let currentQuestion = null;
  let sessionName = "";
  let alreadyAnswered;
  
  onMount(() => {

    userCode = sessionStorage.getItem("username");

    // // Real-time listener for the latest active question
    const questionsRef = collection(db, 'sessions', sessionId, 'questions');
    const qQuery = query(questionsRef);
    
    questionsUnsubscribe = onSnapshot(qQuery, (snapshot) => {
      questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      loading = false;

      if (currentQuestion?.questionType === "rating" && !selectedAnswer) {
        selectedAnswer = '1';
      }

    });

    const sessionRef = doc(db, "sessions",  sessionId)
    sessionUnsubscribe = onSnapshot(query(sessionRef), async (snap) => {

      let data = snap.data();
      sessionName = data.sessionName;
      alreadyAnswered = await checkIfMany(db, "sessions/" + sessionId + "/responses", "questionId", data.activeQuestion, "userCode", userCode)
      activeQuestionId = data.activeQuestion;
      currentQuestion = questions.find(q => q.id === activeQuestionId)
      submitted = false;

      if (currentQuestion?.questionType === "rating") {
        selectedAnswer = selectedAnswer || '1';
      }

      if(!userCode) {
        sessionStorage.setItem("sessionGuess", sessionName);
        goto("/survey")
      }

    })

    return () => {
      if (questionsUnsubscribe) questionsUnsubscribe();
      if(sessionUnsubscribe) sessionUnsubscribe();
    };
  });

  async function submitAnswer() {
    if (!selectedAnswer || !userCode) {
      alert('Please select an answer');
      return;
    }

    isAnswering = true;

    try {
      const responsesRef = collection(db, "sessions", sessionId, 'responses');
      await addDoc(responsesRef, {
        questionId: activeQuestionId,
        answer: currentQuestion?.questionType === "rating" ? Number(selectedAnswer) : selectedAnswer,
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

  async function exitSession() {
    sessionStorage.setItem("sessionGuess", "");
    await goto("/survey")
  }
</script>

<div class="w-dvw min-h-dvh bg-linear-to-br from-slate-900 to-slate-800 p-10 text-white">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-4xl font-bold mb-8 text-center">Live Survey - {sessionName}</h1>

    {#if loading}
      <div class="text-center py-20">
        <p class="text-lg">Loading question...</p>
      </div>
    {:else if !userCode}
      <div class="text-center py-20 bg-slate-700 rounded-lg">
        <p class="text-lg">Please follow through the normal sign-in flow</p>
        <a class="text-lg text-blue-300 underline" href="/survey">Click here to return</a>
      </div>
    {:else if !currentQuestion}
      <div class="text-center py-20 bg-slate-700 rounded-lg">
        <!-- <p class="text-lg">No active questions at the moment</p> -->
        <p class="text-lg"> 👀 Eyes Up! 👀 <br /> No active questions at the moment</p>
      </div>
    {:else}
      <div class="bg-slate-700 rounded-lg p-8 shadow-lg">
        <!-- Question Display -->
        <div class="mb-8">
          <h2 class="text-2xl font-semibold mb-6">{currentQuestion.text}</h2>

          {#if submitted || alreadyAnswered}
            <div class="bg-green-600 p-4 rounded text-center font-semibold mb-6">
              ✓ Response {alreadyAnswered ? "already recorded" : "submitted successfully!"}
            </div>
          {/if}

          {#if currentQuestion.questionType === "labeled"}
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
                    disabled={submitted || alreadyAnswered}
                  />
                  <span class="text-lg">{option}</span>
                </label>
              {/each}
            </div>
          {:else if currentQuestion.questionType === "rating"}
            <div class="mb-6 space-y-4 rounded-lg bg-slate-600 p-5">
              <div class="flex items-center justify-between text-sm text-slate-300">
                <span>1</span>
                <span class="font-semibold text-white">{selectedAnswer}</span>
                <span>10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                bind:value={selectedAnswer}
                class="w-full accent-green-500"
                disabled={submitted || alreadyAnswered}
              />
              <p class="text-center text-sm text-slate-300">Select a rating between 1 and 10</p>
            </div>
          {:else if currentQuestion.questionType === "yesno"}
            <div class="mb-6 flex flex-row w-full justify-center gap-3 not-sm:flex-col">
              {#each currentQuestion.options || [] as option (option)}
                <label class="flex w-full items-center p-4 bg-slate-600 hover:bg-slate-500 rounded cursor-pointer transition">
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    bind:group={selectedAnswer}
                    class="w-4 h-4 mr-3"
                    disabled={submitted || alreadyAnswered}
                  />
                  <span class="text-lg">{option}</span>
              </label>
              {/each}
            </div>
          {/if}

          <!-- User Code Input -->
          <!-- <div class="mb-6">
            <label class="block text-sm font-semibold mb-2">Your Code:</label>
            <input
              type="text"
              placeholder="Enter your participant code"
              bind:value={userCode}
              disabled={submitted}
              class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div> -->

          <!-- Submit Button -->
          <button
            onclick={submitAnswer}
            disabled={isAnswering || submitted || !selectedAnswer || alreadyAnswered}
            class="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed px-6 py-3 rounded font-semibold transition cursor-pointer"
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
    <button
      onclick={exitSession}
      class="mt-8 block mx-auto bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition w-full cursor-pointer"
    >Exit</button>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
