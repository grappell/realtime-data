<svelte:options runes={false} />
<script>
  import { onMount } from 'svelte';
  import { db } from '$lib/firebase.js';
  import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
	import { fa, faker } from '@faker-js/faker';
	import { capitalize, checkIfExists, deleteCollection, formatDate, slugify } from '$lib/utils';

  let sessionCode = '';
  let sessionName = "";
  let isInSession = false;
  let newQuestionText = '';
  let newOptions = '';
  let questions = [];
  let recentQuestions = [];
  let responses = [];
  let isCreating = false;
  let questionsUnsubscribe;
  let responsesUnsubscribe;
  let sessionUnsubscribe;

  let existingSessions = {};
  let questionType = "labeled";

  let yesNoStats = {};
  let labeledStats = {};
  let statsLoaded = false;

  onMount(() => {

    handleHomepageStart();

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

    getDoc(doc(db, "sessions", sessionCode)).then(doc => {
      sessionName = doc.data().sessionName
    })
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
        stats: doc.data().questionType === "yesno" ? getYesNoStats(doc.id) : doc.data().questionType === "labeled" ? getResponseStats(doc.id) : getRatingStats(doc.id),
        ...doc.data()
      }));
      recentQuestions = [...questions].sort((a, b) => toTimeMs(b.activeLast) - toTimeMs(a.activeLast));
      statsLoaded = true;
    });

    // Listen to responses
    const responsesRef = collection(db, 'sessions/' + id + '/responses');
    const responsesQuery = query(responsesRef);
    responsesUnsubscribe = onSnapshot(responsesQuery, (snapshot) => {
      responses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      questions = questions.map(q => {
        return {
          ...q,
          stats: q.questionType === "yesno" ? getYesNoStats(q.id) : q.questionType === "labeled" ? getResponseStats(q.id) : getRatingStats(q.id),
        }
      })
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
          options = ["Yes", "No"]
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
        createdAt: new Date().toISOString(),
        activeLast: ""
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

  function getRatingStats(questionId) {
    const qResponses = responses.filter(r => r.questionId === questionId);
    const ratings = qResponses
      .map(r => Number(r.answer))
      .filter(rating => Number.isFinite(rating) && rating >= 1 && rating <= 10);

    const buckets = Array.from({ length: 10 }, (_, index) => {
      const rating = index + 1;
      return {
        rating,
        count: ratings.filter(value => value === rating).length
      };
    });

    const total = ratings.length;
    const average = total > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / total
      : 0;
    const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

    return { buckets, total, average, maxCount };
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
    let yesAnswers = 0;
    let noAnswers = 0;
    qResponses.forEach(r => {
      if(r.answer === "Yes") yesAnswers++;
      if(r.answer === "No") noAnswers++;
    });
    return { yes: yesAnswers, no: noAnswers, total: qResponses.length };
  }

  function toTimeMs(value) {
    if (!value) return 0;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      value = value.toDate();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function setActive(qid) {
    // console.log("setActive", qid)
    updateDoc(doc(db, 'sessions', sessionCode), {
      activeQuestion: qid,
    })
    if(qid != "") {
      updateDoc(doc(db, 'sessions', sessionCode, 'questions', qid), {
        activeLast: new Date().toISOString()
      })
    }
  }

  async function handleExit() {
    sessionStorage.removeItem("sessionId");
    await updateDoc(doc(db, 'sessions', sessionCode), {
      editedAt: new Date().toISOString()
    })
    isInSession = false;
    sessionCode = "";
    sessionName = "";
    handleHomepageStart();
  }

  async function clearRes() {
    await deleteCollection(db, "sessions/" + sessionCode + "/responses")
      .then(() => alert("Successfully Deleted"))
      .catch(e => console.error(e));
  }

</script>

<div class="w-dvw min-h-dvh bg-linear-to-br from-slate-900 to-slate-800 p-10 text-white">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-4xl font-bold mb-10 text-center">{sessionName ? "Dashboard: " + sessionName : "Survey Admin"}</h1>

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

          <hr class="px-3 mt-5 mb-5" />

          <button
            onclick={() => setActive("")}
            disabled={isCreating}
            class="w-full cursor-pointer bg-orange-400 hover:bg-orange -500 disabled:bg-slate-500 px-6 py-2 rounded font-semibold transition"
          >
            Clear Active
          </button>

        </div>

        <!-- Recent Questions Section -->
        <div class="bg-slate-700 rounded-lg p-6">
          <h2 class="text-2xl font-semibold mb-4">Recent Questions</h2>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            {#each recentQuestions.slice(0, 10) as question (question.id)}
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
        <div class="space-y-4 max-h-dvh overflow-y-auto">
          {#each questions as question (question.id)}
            {@const totalResponses = responses.filter(r => r.questionId === question.id).length}
            <div class="bg-slate-600 p-4 rounded">
              <p class="font-semibold mb-2">{question.text}</p>
              <p class="text-sm text-slate-300 mb-3">Total Responses: {totalResponses}</p>
              {#if question.questionType === "rating"}
                <div class="space-y-4 text-sm mb-3">
                  <div class="flex items-center justify-between text-slate-300">
                    <p>Average: {question.stats.average ? question.stats.average.toFixed(1) : '0.0'}/10</p>
                    <p>Most selected rating is highlighted</p>
                  </div>
                  <div class="space-y-2 px-3">
                    {#each question.stats.buckets || [] as bucket}
                      {@const percentage = question.stats.total > 0 ? ((bucket.count / question.stats.total) * 100).toFixed(1) : '0.0'}
                      <div class="flex items-center gap-3">
                        <span class="w-8 text-right text-slate-300">{bucket.rating}</span>
                        <div class="h-4 flex-1 rounded-full bg-slate-500 overflow-hidden">
                          <div
                            class={`h-full rounded-full transition-all ${bucket.count > 0 && bucket.count === question.stats.maxCount ? 'bg-amber-400' : 'bg-green-500'}`}
                            style={`width: ${question.stats.maxCount > 0 ? (bucket.count / question.stats.maxCount) * 100 : 0}%`}
                          ></div>
                        </div>
                        <span class="w-16 text-right text-slate-300">{bucket.count} ({percentage}%)</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if question.questionType === "labeled" && Object.keys(question.stats).length != 0}
                <div class="space-y-1 text-sm">
                  {#each question.options || [] as option}
                    {@const count = question.stats[option] || 0}
                    {@const percentage = totalResponses > 0 ? ((count / totalResponses) * 100).toFixed(1) : 0}
                    <div class="flex justify-between">
                      <span>{option}: {count}</span>
                      <span class="text-slate-400">{percentage}%</span>
                    </div>
                  {/each}
                </div>    
              {:else if question.questionType === "yesno" && Object.keys(question.stats).length != 0}
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between text-slate-300 mb-1">
                    <span>Yes: {question.stats.yes}</span>
                    <span>No: {question.stats.no}</span>
                  </div>
                  <div class="w-full h-4 bg-slate-500 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-green-500 transition-all"
                      style={`width: ${question.stats.total > 0 ? (question.stats.yes / question.stats.total) * 100 : 0}%`}
                    ></div>
                  </div>
                  <div class="flex justify-between mb-3">
                    <p>
                      {question.stats.total > 0 ? Math.round((question.stats.yes / question.stats.total) * 100) + "%" : "N/A"}
                    </p>
                    <p>
                      {question.stats.total > 0 ? Math.round((question.stats.no / question.stats.total) * 100) + "%" : "N/A"}
                    </p>
                  </div>
                </div>
              {/if}
            <button
              onclick={() => setActive(question.id)}
              class="px-4 py-2 my-3 bg-green-600 rounded hover:cursor-pointer"
            >
              Set Active
            </button>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex justify-around gap-20">
        <button
          onclick={handleExit}
          class="mt-8 w-full block mx-auto bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition"
        >Exit</button>
        <button
          onclick={clearRes}
          class="mt-8 w-full block mx-auto bg-purple-600 hover:bg-red-500 px-6 py-2 rounded font-semibold transition"
        >Clear Responses</button>
      </div>
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
