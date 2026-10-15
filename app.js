const $ = (id) => document.getElementById(id);
const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const textInput = $('text');
let engine = null;
let enginePromise = null;

textInput.addEventListener('input', () => {
  $('count').textContent = `${textInput.value.length.toLocaleString()} / 20,000`;
  $('count').style.color = textInput.value.length > 20_000 ? '#9b4939' : '';
});

$('sample').addEventListener('click', () => {
  textInput.value = 'Urban trees can make neighborhoods cooler during hot weather. Their leaves provide shade, and they release water vapor into the air. However, trees do not cool every street equally: places with fewer trees often have more pavement and can remain much hotter. This means city planners should consider where trees are planted, not only how many are planted.';
  textInput.dispatchEvent(new Event('input'));
  textInput.focus();
});

function setStatus(message, state = '') {
  $('statusText').textContent = message;
  $('statusDot').className = `dot ${state}`.trim();
}

function showError(message) {
  $('error').textContent = message;
  $('error').style.display = 'block';
}

function updateModelReady() {
  $('loadModel').disabled = Boolean(engine);
  $('loadModel').textContent = engine ? 'Model ready' : 'Load free model';
  $('run').disabled = !engine;
}

function isModelNotLoaded(error) {
  return /model not loaded|ensure you have called.*reload/i.test(error?.message || '');
}

async function collectCompletionWithRecovery(localEngine, request) {
  const collect = async () => {
    const completion = await localEngine.chat.completions.create(request);
    let answer = '';
    for await (const chunk of completion) {
      answer += chunk.choices?.[0]?.delta?.content || '';
      $('output').textContent = answer;
    }
    return answer;
  };
  try {
    return await collect();
  } catch (error) {
    if (!isModelNotLoaded(error)) throw error;
    $('output').textContent = 'The browser paused the model. Reloading it now…';
    setStatus('Model paused · reloading…');
    $('modelInfo').textContent = 'The browser paused the model. Reloading it now; your passage stays on this device.';
    await localEngine.reload(MODEL_ID, {
      initProgressCallback: (progress) => {
        const message = progress?.text || 'Reloading model…';
        $('modelInfo').textContent = message;
        setStatus('Reloading model…');
      },
    });
    setStatus('Private browser model · ready', 'ok');
    $('modelInfo').textContent = 'Model ready. Your passage is processed on this device.';
    updateModelReady();
    $('output').textContent = 'The model is working in your browser…';
    return await collect();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function parseSections(raw) {
  const labels = ['MODEL REVISION', 'WHAT CHANGED', 'TRY IT YOURSELF', 'SOURCE AND CITATION CHECK'];
  const escaped = labels.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`^\\s*(?:#{1,4}\\s*|\\*\\*|__)?\\s*(${escaped})\\s*(?:\\*\\*|__)?\\s*:?\\s*$`, 'gim');
  const found = [];
  let match;
  while ((match = pattern.exec(raw)) !== null) found.push({ label: match[1].toUpperCase(), start: match.index, bodyStart: pattern.lastIndex });
  if (!found.length) return [{ label: 'TEACHING EXAMPLE', body: raw.trim(), list: false }];
  return found.map((item, index) => ({
    label: item.label,
    body: raw.slice(item.bodyStart, found[index + 1]?.start ?? raw.length).trim(),
    list: item.label === 'WHAT CHANGED' || item.label === 'TRY IT YOURSELF',
  })).filter((section) => section.body);
}

function renderResult(raw) {
  const sections = parseSections(raw);
  let html = `<div class="output-top"><span class="model-badge">Runs in your browser · ${MODEL_ID.replace('-q4f16_1-MLC', '')}</span><button class="secondary" id="copy">Copy revision</button></div>`;
  for (const section of sections) {
    let content;
    if (section.list) {
      const items = section.body.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      content = `<ul>${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    } else {
      content = `<p>${escapeHtml(section.body)}</p>`;
    }
    html += `<div class="output-section ${section.label === 'MODEL REVISION' ? 'revision' : ''}"><h3>${escapeHtml(section.label)}</h3>${content}</div>`;
  }
  html += '<div class="notice">Use this as a worked example. Invite students to explain the ideas first, then write their own version and cite the original source.</div>';
  $('output').innerHTML = html;
  $('output').style.display = 'block';
  $('empty').style.display = 'none';
  $('copy').addEventListener('click', async () => {
    const revision = sections.find((part) => part.label === 'MODEL REVISION')?.body || raw;
    try {
      await navigator.clipboard.writeText(revision);
      $('copy').textContent = 'Copied';
      setTimeout(() => { const button = $('copy'); if (button) button.textContent = 'Copy revision'; }, 1400);
    } catch { showError('Clipboard access was blocked. Select and copy the revision instead.'); }
  });
}

async function loadModel() {
  if (engine) return engine;
  if (enginePromise) return enginePromise;
  if (!navigator.gpu) throw new Error('This browser/device does not support WebGPU. Try a recent Chrome or Edge browser on a compatible device.');
  const button = $('loadModel');
  button.disabled = true;
  button.textContent = 'Loading…';
  setStatus('Preparing browser model…');
  $('modelInfo').textContent = 'Connecting to the model library. First load downloads model files and may take several minutes.';
  enginePromise = (async () => {
    const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.85');
    const instance = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        const message = progress?.text || 'Loading model…';
        $('modelInfo').textContent = message;
        setStatus(message.length > 34 ? 'Loading model…' : message);
      },
    });
    engine = instance;
    $('run').disabled = false;
    $('loadModel').textContent = 'Model ready';
    $('modelInfo').textContent = 'Model ready. Your passage is processed on this device.';
    setStatus('Private browser model · ready', 'ok');
    return engine;
  })();
  try { return await enginePromise; }
  catch (error) {
    enginePromise = null;
    button.disabled = false;
    button.textContent = 'Retry model load';
    setStatus('Model could not load', 'bad');
    $('modelInfo').textContent = 'Check your connection, available memory, and WebGPU support, then retry.';
    throw error;
  }
}

$('loadModel').addEventListener('click', async () => {
  $('error').style.display = 'none';
  try { await loadModel(); }
  catch (error) { showError(error.message || 'Could not load the browser model.'); }
});

$('run').addEventListener('click', async () => {
  $('error').style.display = 'none';
  const passage = textInput.value.trim();
  if (passage.length < 30) return showError('Paste at least 30 characters so the coach has enough context.');
  if (passage.length > 20_000) return showError('Please keep each passage under 20,000 characters.');
  $('run').disabled = true;
  $('spinner').style.display = 'inline-block';
  $('runLabel').textContent = 'Creating teaching example…';
  $('empty').style.display = 'none';
  $('output').style.display = 'block';
  $('output').textContent = 'The model is working in your browser…';
  try {
    const localEngine = await loadModel();
    const system = [
      'You are a writing teacher producing a transparent classroom example.',
      'Help explain how to express ideas clearly in a student’s own voice.',
      'Do not conceal AI use, evade detectors, or make claims about who authored a text.',
      'Preserve meaning, factual claims, names, numbers, direct quotations, and citations.',
      'Do not invent facts, sources, or citations. Flag unclear claims for verification.',
      'The revision is a teaching model, not work to submit unchanged.',
    ].join(' ');
    const prompt = `Create a classroom teaching example from the passage below.\n\nStudent level: ${$('audience').value}\nWriting goal: ${$('goal').value}\nTeacher direction: ${$('notes').value.trim() || 'None'}\n\nReturn the following exact headings on separate lines:\nMODEL REVISION\nGive one clear, natural revision that keeps the original meaning. Preserve citations and direct quotations. Do not add facts.\n\nWHAT CHANGED\nGive 3 to 5 concise bullets about specific writing choices.\n\nTRY IT YOURSELF\nGive 3 questions or steps that help a student write their own version without copying the model.\n\nSOURCE AND CITATION CHECK\nRemind the student to cite the original source when using its ideas. State whether any detail needs verification.\n\nPASSAGE:\n${passage}`;
    const request = {
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.35,
      max_tokens: 1100,
      stream: true,
    };
    const answer = await collectCompletionWithRecovery(localEngine, request);
    renderResult(answer.trim() || 'The local model returned an empty response. Try again.');
  } catch (error) {
    $('output').style.display = 'none';
    $('empty').style.display = 'grid';
    if (/model not loaded|reload/i.test(error?.message || '')) {
      engine = null;
      enginePromise = null;
      updateModelReady();
      setStatus('Model needs to be loaded again', 'bad');
      $('modelInfo').textContent = 'The browser stopped the model. Select “Load free model” to start it again.';
    }
    showError(error.message || 'The teaching example could not be created.');
  } finally {
    $('run').disabled = !engine;
    $('spinner').style.display = 'none';
    $('runLabel').textContent = 'Create teaching example';
  }
});

if (!navigator.gpu) {
  setStatus('WebGPU not available on this browser', 'bad');
  $('modelInfo').textContent = 'WebGPU is required for private in-browser generation. Try recent Chrome or Edge on a compatible device.';
} else {
  setStatus('Private browser model · not loaded');
}

