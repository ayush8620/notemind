// NoteMind – by Ayush Yadav – MIT License
import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const MODEL_F16 = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const MODEL_F32 = "Qwen2.5-0.5B-Instruct-q4f32_1-MLC";
let MODEL = MODEL_F16;
const $ = (id) => document.getElementById(id);
let engine = null, busy = false, stop = false, cloud = false;
const setCloud = (on, why) => { cloud = on; const t = $("cloudToggle"); if (t) t.checked = on; if (on) $("status").textContent = "☁️ Using cloud AI via Groq (no GPU needed)" + (why ? " – " + why : ""); };
$("cloudToggle")?.addEventListener("change", (e) => setCloud(e.target.checked));

if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const hasGPU = !!navigator.gpu;
if (!hasGPU) { $("gpuWarn").classList.remove("hidden"); setCloud(true, "WebGPU not available"); }

$("notes").addEventListener("input", () => {
  const n = $("notes").value.trim().split(/\s+/).filter(Boolean).length;
  $("count").textContent = `${n} words`;
});

$("loadBtn").onclick = async () => {
  $("loadBtn").disabled = true;
  let adapter = null;
  try { adapter = await navigator.gpu?.requestAdapter(); } catch {}
  if (!adapter) {
    $("status").textContent = "This device has no WebGPU. Open on a laptop/desktop Chrome or Edge.";
    setCloud(true, "this device has no WebGPU");
    $("gpuWarn").classList.remove("hidden");
    $("loadBtn").disabled = false;
    return;
  }
  MODEL = adapter.features.has("shader-f16") ? MODEL_F16 : MODEL_F32;
  $("status").textContent = "Loading " + MODEL + " ...";
  try {
    engine = await webllm.CreateMLCEngine(MODEL, {
      initProgressCallback: (p) => {
        $("bar").style.width = Math.round((p.progress || 0) * 100) + "%";
        $("status").textContent = p.text;
      },
    });
    $("bar").style.width = "100%";
    $("status").textContent = "✅ Model ready: " + MODEL;
    $("loadBtn").textContent = "Model Loaded";
  } catch (e) {
    engine = null;
    const m = String(e?.message || e);
    let why = "Something went wrong while loading the model.";
    if (/f16|ShaderModule|WGSL/i.test(m)) why = "Your GPU could not run the model's shaders.";
    else if (/fetch|network|cache|quota/i.test(m)) why = "Model download blocked or network issue, check internet / try another network.";
    else if (/memory|OOM|buffer/i.test(m)) why = "Not enough GPU memory on this device.";
    $("bar").style.width = "0%";
    $("status").textContent = "❌ " + why + " Click Load Model to retry. (Details: " + m.split("\n")[0] + ")";
    $("loadBtn").disabled = false;
    setCloud(true, why);
  }
};

$("fileIn").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    if (f.name.toLowerCase().endsWith(".pdf")) {
      const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        text += c.items.map((it) => it.str).join(" ") + "\n";
      }
      $("notes").value = text.trim();
    } else $("notes").value = await f.text();
    $("notes").dispatchEvent(new Event("input"));
  } catch (err) { alert("Could not read file: " + err.message); }
};

const PROMPTS = {
  summary: ["Summary", "Summarize the following notes as 5-8 concise bullet points starting with '- '."],
  terms: ["Key Terms", "List the 6-10 most important key terms from the notes. Format each as '- Term: short definition'."],
  explain: ["Explain Simply", "Explain the following notes in very simple language, as if to a 12-year-old, using a short example."],
  quiz: ["Quiz", 'Create exactly 5 multiple-choice questions from the notes. Respond ONLY with JSON array: [{"q":"question","options":["A","B","C","D"],"answer":0}] where answer is the index of the correct option.'],
};

$("stopBtn").onclick = () => { stop = true; engine?.interruptGenerate?.(); };

document.querySelectorAll("[data-task]").forEach((b) => (b.onclick = () => run(b.dataset.task)));

async function run(task) {
  const notes = $("notes").value.trim();
  if (!cloud && !engine) return alert("Please load the model first, or tick 'Use cloud AI'.");
  if (!notes) return alert("Please paste or upload some notes.");
  if (busy) return;
  busy = true; stop = false;
  const [title, instr] = PROMPTS[task];
  $("outTitle").textContent = "3. Output – " + title;
  $("quiz").innerHTML = ""; $("output").classList.remove("muted");
  $("output").textContent = "Thinking...";
  let text = "";
  try {
    const messages = [
      { role: "system", content: "You are NoteMind, a helpful study assistant." },
      { role: "user", content: `${instr}\n\nNOTES:\n${notes.slice(0, 6000)}` },
    ];
    const text = await generate(messages, task === "quiz" ? 0.4 : 0.6, (t) => ($("output").textContent = t));
    if (task === "quiz") renderQuiz(text);
  } catch (e) { $("output").textContent = "Error: " + e.message; }
  busy = false;
}

async function generate(messages, temperature, onText) {
  if (cloud || !engine) {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, max_tokens: 900, temperature }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Cloud AI error " + r.status);
    onText(j.text); return j.text;
  }
  let text = "";
  const chunks = await engine.chat.completions.create({ stream: true, temperature, max_tokens: 900, messages });
  for await (const c of chunks) {
    if (stop) break;
    text += c.choices[0]?.delta?.content || "";
    onText(text);
  }
  return text;
}

function renderQuiz(raw) {
  let qs;
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    qs = JSON.parse(m[0]).filter((q) => q.q && Array.isArray(q.options)).slice(0, 5);
    if (!qs.length) throw 0;
  } catch { $("output").textContent += "\n\n⚠️ Could not parse quiz. Click Quiz again."; return; }
  $("output").textContent = "Answer the questions below:";
  let score = 0, answered = 0;
  const box = $("quiz");
  qs.forEach((q, i) => {
    const d = document.createElement("div"); d.className = "q";
    d.innerHTML = `<p>Q${i + 1}. </p>`; d.querySelector("p").append(q.q);
    q.options.forEach((o, j) => {
      const b = document.createElement("button"); b.className = "opt"; b.textContent = o;
      b.onclick = () => {
        d.querySelectorAll(".opt").forEach((x, k) => { x.disabled = true; if (k === Number(q.answer)) x.classList.add("correct"); });
        if (j === Number(q.answer)) score++; else b.classList.add("wrong");
        if (++answered === qs.length) {
          const s = document.createElement("div"); s.className = "score";
          s.textContent = `🎯 Score: ${score} / ${qs.length}`; box.append(s);
        }
      };
      d.append(b);
    });
    box.append(d);
  });
}
