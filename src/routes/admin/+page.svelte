<svelte:options runes={false} />
<script>
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase.js';
  import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
	import { faker } from '@faker-js/faker';
	import { capitalize, checkIfExists, formatDate, slugify } from '$lib/utils';

  let sessionCode = '';
  let isInSession = false;
  let newQuestionText = '';
  let newOptions = '';
  let questions = [];
  let responses = [];
  let isCreating = false;
  let questionsUnsubscribe;
  let responsesUnsubscribe;
  let sessionUnsubscribe;

  let existingSessions = {};
  let questionType = "labeled";

  onMount(() => {

    handleHomepageStart();
    console.log(sessionCode)
    
    return () => {
      if (questionsUnsubscribe) questionsUnsubscribe();
      if (responsesUnsubscribe) responsesUnsubscribe();
      if (sessionUnsubscribe) sessionUnsubscribe();
    };
  });

  function handleHomepageStart() {
    let ssId = sessionStorage.getItem("sessionId");
    if(ssId) {
      setSession(ssId);
    } else {
      getSessions();
    }
  }

  function getSessions() {
    const sessionsRef  = collection(db, "sessions")
    const sessionQuery = query(sessionsRef, orderBy("timestamp", "desc"))
    sessionUnsubscribe = onSnapshot(sessionQuery, (snapshot) => {
      existingSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });
  }

  async function createSession() {
    try {
      let ref = collection(db, 'sessions');
      let docRef = await addDoc(ref, {
        timestamp: new Date(),
        createdAt: new Date().toISOString(),
        editedAt: new Date().toISOString(),
        sessionName: await createSessionTitle(),
        activeQuestion: "",
      });
        console.log(docRef)
        console.log(docRef.id)
        setSession(docRef.id)
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session');
    } finally {
      isCreating = false;
    }
  }

  function setSession(id) {
    console.log("sessionID Set", id)
    sessionStorage.setItem('sessionId', id);
    sessionCode = id;
    isInSession = true;
    loadData(id);
  }

  async function deleteSession(id) {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const sessionRef = doc(db, 'sessions', id);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }

  }

  async function loadData(id) {

    const questionsRef = collection(db, 'sessions/' + id + "/questions");
    const questionsQuery = query(questionsRef, orderBy('timestamp', 'desc'));
    questionsUnsubscribe = onSnapshot(questionsQuery, (snapshot) => {
      questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });

    // Listen to responses
    const responsesRef = collection(db, 'sessions/' + id + '/responses');
    const responsesQuery = query(responsesRef);
    responsesUnsubscribe = onSnapshot(responsesQuery, (snapshot) => {
      responses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });

  }

  async function createSessionTitle() {
    let guess = slugify(faker.word.words(3));
    if(!(await checkIfExists(db, "sessions", 'sessionName', guess))) return guess;
    return createSessionTitle();
  }

  async function createQuestion() {

    let options;
    isCreating = true;

    let checkEmptyAndFillOptions = () => {
      switch (questionType) {
        case "labeled":
          options = newOptions.split(',').map(opt => capitalize(opt.trim())).filter(opt => opt);
          return !newQuestionText.trim() || !newOptions.trim()
          break;
      
        case "yesno":
          options = ["Yes / No"]
          return !newQuestionText.trim()
          break;
         
        case "rating":
          options = ["1-10"]
          return !newQuestionText.trim()
          break;
          
        default:
          return !newQuestionText.trim()
          break;
      }
    }

    if (checkEmptyAndFillOptions()) {
      alert('Please fill in all fields');
      isCreating = false;
      return;
    }

    try {
      console.log("sessions/" + sessionCode + "/questions")
      if(!sessionCode || sessionCode === "") throw new Error("No session code")
      const questionsRef = collection(db, 'sessions', sessionCode, "questions");
      await addDoc(questionsRef, {
        text: newQuestionText,
        options,
        questionType,
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

  function getYesNoStats(questionId) {
    const qResponses = responses.filter(r => r.questionId === questionId);
    console.log(responses, qResponses)
    let yesAnswers = 0;
    let noAnswers = 0;
    qResponses.forEach(r => {
      console.log(r)
      if(r.val === "yes") yesAnswers++;
      if(r.val === "no") noAnswers++;
    });
    return { yes: yesAnswers, no: noAnswers, total: qResponses.length };
  }

  async function handleExit() {
    sessionStorage.removeItem("sessionId");
    await updateDoc(doc(db, 'sessions', sessionCode), {
      editedAt: new Date().toISOString()
    })
    isInSession = false;
    sessionCode = "";
    handleHomepageStart();
  }
</script>

<div class="w-dvw min-h-dvh bg-linear-to-br from-slate-900 to-slate-800 p-10 text-white">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl font-bold mb-10 text-center">Survey Admin Dashboard</h1>

    {#if !isInSession || sessionCode === ""}
      <div class="w-[50vw] m-auto flex flex-col justify-center">
        <span class="m-auto">
          <button onclick={createSession} class="bg-green-600 hover:bg-green-500 px-24 py-4 rounded font-semibold transition">Create Session</button>
        </span>
        <hr class="mx-3 my-10 "/>
        <div class="w-full mx-auto bg-slate-700 rounded-lg p-8">
          <h2 class="text-2xl font-semibold mb-4 py-5">Existing Sessions</h2>
          <div class="flex flex-col gap-3">
            {#each existingSessions as session}
              <div class="flex flex-col w-[90%] mx-auto justify-around bg-slate-800 text-white py-10 rounded h-full p-10">
                <p class="font-semibold my-auto pt-4">Session: <span class="text-xl">{session.sessionName}</span></p>
                <p class="my-auto pb-4">Edited: <span class="text-xl">{formatDate(session.editedAt)}</span></p>
                <button class="p-4 m-2 bg-green-600 rounded-2xl hover:cursor-pointer" onclick={() => setSession(session.id)}> Edit </button>
                <button class="p-4 m-2 bg-red-900 rounded-2xl hover:cursor-pointer" onclick={() => deleteSession(session.id)}> Delete </button>
              </div>
            {/each}
          </div>
        </div>
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
            name="new question"
          ></textarea>

          <hr class="px-3 pt-5"/>

          <select class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white mb-4 focus:outline-none focus:border-blue-400" bind:value={questionType}>
            <option value="labeled">Labeled</option>
            <option value="rating">Rating</option>
            <option value="yesno">Yes / No</option>
          </select>

          {#if questionType === "labeled"}
            <textarea
              placeholder="Enter options separated by commas (e.g., Yes, No, Maybe)"
              bind:value={newOptions}
              class="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 mb-4 focus:outline-none focus:border-blue-400"
              rows="2"
            ></textarea>
          {:else if questionType === "rating"}
            <div class="question-explainer">
              <p> Students will see a slider, from 1-10</p>
            </div>
          {:else if questionType === "yesno"}
            <div class="question-explainer">
              <p> Students will see a Yes and No option </p>
            </div>
          {/if}

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
            {@const totalResponses = responses.filter(r => r.questionId === question.id).length}
            <div class="bg-slate-600 p-4 rounded">
              <p class="font-semibold mb-2">{question.text}</p>
              <p class="text-sm text-slate-300 mb-3">Total Responses: {totalResponses}</p>
              {#if question.questionType === "rating"}
                <div class="space-y-1 text-sm">
                  <p>See rankings</p>
                </div>
              {:else if question.questionType === "labeled"}
                {@const stats = getResponseStats(question.id)}
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
              {:else if question.questionType === "yesno"}
                {@const stats = getYesNoStats(question.id)}
                {@const yesPercentage = stats.total > 0 ? (stats.yes / stats.total) * 100 : 0}
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between text-slate-300 mb-1">
                    <span>Yes: {stats.yes}</span>
                    <span>No: {stats.no}</span>
                  </div>
                  <div class="w-full h-4 bg-slate-500 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-green-500 transition-all"
                      style={`width: ${yesPercentage}%`}
                    ></div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <button
        onclick={handleExit}
        class="mt-8 block mx-auto bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition"
      >Exit</button>
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }

  .question-explainer {
    padding: 10px;
    background-color: var(--color-slate-800);
    border: 1px solid var(--color-slate-600);
    border-radius: 0.25rem;
    margin-bottom: 20px;
  }
</style>
