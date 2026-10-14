# Classroom Writing Coach

A free, browser-based writing lesson tool for teachers. It creates a model revision, explains the craft choices, and gives students a scaffold for writing their own version.

## Use the hosted app

Open the [Classroom Writing Coach](https://sumeetamin.github.io/classroom-writing-coach/). Choose **Load free model** once. The first run downloads the WebLLM runtime and model weights to the browser cache and may take several minutes; the model is then run on-device. No API key or paid model subscription is needed. A compatible browser with WebGPU and enough available GPU memory is required.

## Run locally

This static app needs to be served over HTTP (opening `index.html` directly may prevent the browser model from loading). With Node.js installed:

```powershell
node server.mjs
```

Then open <http://127.0.0.1:8766>.

## Classroom and privacy notes

- The model runs in the visitor's browser. Passage text is not sent to this site's server or saved by the app.
- The browser downloads the app runtime and model files from their upstream hosts when the model is loaded.
- Use generated revisions as transparent worked examples. Students should make their own wording choices and cite sources for borrowed ideas.
- This is not an AI-writing detector or plagiarism checker. Do not use AI detection scores to make misconduct decisions.
- Review generated text for factual accuracy, changed meaning, and citation completeness before using it in a lesson.

## Model and runtime

Inference uses WebLLM 0.2.85 and its `Llama-3.2-3B-Instruct-q4f16_1-MLC` browser model. WebLLM documents its browser setup and notes that model loading downloads artifacts on first use: <https://webllm.mlc.ai/docs/user/get_started.html>.

