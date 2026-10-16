# 🧠 NoteMind – AI Smart Notes Summarizer & Quiz Generator

Built for **Hacktoberfest Hack Day × WikiClub Tech UIT – Edition 1.0** · Challenge: **Best Open-Source AI Project**
Author: **Ayush Yadav**

![NoteMind screenshot](screenshot.png)

## ❓ Problem
Students have long lecture notes and PDFs but little time to revise. Most AI study tools need paid APIs, accounts, and send private notes to remote servers.

## 💡 Solution
NoteMind is a free, open-source web app that runs an **open-weight LLM fully inside the browser**. Paste notes or upload a `.txt`/`.pdf` and instantly get:
- 📝 **Summary** in bullet points
- 🔑 **Key terms** with short definitions
- ❓ **Interactive 5-question MCQ quiz** with instant feedback and score
- 💡 **Simple explanation** (ELI12 style)

No server, no API key, no data leaves your device. Works offline after the first model download.

## 🛠 Tech Stack
- HTML, CSS, vanilla JavaScript (ES modules)
- [WebLLM](https://github.com/mlc-ai/web-llm) (`@mlc-ai/web-llm`, Apache-2.0) – in-browser LLM inference via WebGPU
- [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174 (Apache-2.0) – PDF text extraction

## 🤖 AI Model
- **Model:** Qwen2.5-0.5B-Instruct (WebLLM build `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, 4-bit quantized)
- **Source:** https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct
- **License:** Apache-2.0 – https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/blob/main/LICENSE

## ⚙️ How AI is integrated
1. On "Load Model", WebLLM downloads the quantized Qwen2.5 weights (~400 MB, cached in browser) and compiles them for the GPU with WebGPU, showing a progress bar.
2. Each button sends the notes with a task-specific prompt through WebLLM's OpenAI-compatible `chat.completions.create` API with `stream: true`, so text appears token by token.
3. For the quiz, the model is prompted to output JSON; the app parses it and renders clickable MCQs with correct/wrong highlighting and a final score.
4. If the browser lacks WebGPU, a clear fallback message is shown.

## 🚀 Installation & Usage
```bash
git clone https://github.com/ayush8620/notemind.git
cd notemind
python3 -m http.server 8000   # any static server works
```
Open http://localhost:8000 in **Chrome / Edge 113+ (desktop)**, click **Load Model**, paste notes, choose an action.
Can also be deployed for free on GitHub Pages / Vercel / Netlify (static files only).

## 📁 Files
`index.html` · `style.css` · `app.js` · `README.md` · `LICENSE` · `screenshot.png`

## 📜 License
This project is licensed under the **MIT License** – see [LICENSE](LICENSE).
The Qwen2.5 model is licensed under Apache-2.0 by Alibaba Cloud.
