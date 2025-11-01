const LETTERS = [
  "А","Б","В","Г","Ґ","Д","Е","Є","Ж","З","И","І","Ї","Й","К",
  "Л","М","Н","О","П","Р","С","Т","У","Ф","Х","Ц","Ч","Ш","Щ","Ь","Ю","Я"
];

let canvas, ctx, resultDisplay, historyDiv, clearCanvasBtn, clearHistoryBtn, modelStatus, timerHint;

const DELAY_MS = 1000;
let model = null;
let modelLoaded = false;
let dataset = [];
let recognitionTimer = null;
let drawing = false;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('drawCanvas');
  ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  resultDisplay = document.getElementById('resultDisplay');
  historyDiv = document.getElementById('history');
  clearCanvasBtn = document.getElementById('clearCanvasBtn');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  modelStatus = document.getElementById('modelStatus');
  timerHint = document.getElementById('timerHint');

  console.log('DOM loaded. Elements:', {
    canvasExists: !!canvas,
    ctxExists: !!ctx,
    resultDisplay: !!resultDisplay,
    historyDiv: !!historyDiv,
    clearCanvasBtn: !!clearCanvasBtn,
    clearHistoryBtn: !!clearHistoryBtn,
    modelStatus: !!modelStatus
  });

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'black';

  if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', clearCanvas);
  } else {
    console.warn('');
  }

  if (clearHistoryBtn) {
    try { clearHistoryBtn.type = 'button'; } catch (e) { }

    clearHistoryBtn.addEventListener('click', () => {
      console.log('');
      clearHistory();
    });
  } else {
    console.warn('');
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  (async function tryLoadModel(){
    try {
      model = await tf.loadLayersModel('model/model.json');
      modelLoaded = true;
      if (modelStatus) modelStatus.textContent = 'Модель завантажена';
    } catch (e) {
      modelLoaded = false;
      if (modelStatus) modelStatus.textContent = 'Модель не знайдена';
    }
  })();
});

function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function onPointerDown(e) {
  drawing = true;
  const p = getPointerPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  if (recognitionTimer) {
    clearTimeout(recognitionTimer);
    recognitionTimer = null;
    clearTimerHint();
  }
}
function onPointerMove(e) {
  if (!drawing) return;
  const p = getPointerPos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}
function onPointerUp(e) {
  if (!drawing) return;
  drawing = false;
  ctx.beginPath();
  startRecognitionCountdown();
}
function onPointerLeave(e) {
  if (!drawing) return;
  drawing = false;
  ctx.beginPath();
  startRecognitionCountdown();
}
function startRecognitionCountdown() {
  if (recognitionTimer) clearTimeout(recognitionTimer);
  let secondsLeft = 3;
  showTimerHint(secondsLeft);

  const countdownInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft > 0) {
      showTimerHint(secondsLeft);
    } else {
      clearInterval(countdownInterval);
      clearTimerHint();
    }
  }, 1000);

  recognitionTimer = setTimeout(async () => {
    await recognizeAndAppend();
    clearCanvas();
    clearTimerHint();
    recognitionTimer = null;
    clearInterval(countdownInterval);
  }, DELAY_MS);
}

function showTimerHint(seconds) {
  if (timerHint) timerHint.textContent = `Сканування через ${seconds} сек...`;
}
function clearTimerHint() { if (timerHint) timerHint.textContent = ''; }
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function clearHistory() {
  if (resultDisplay) resultDisplay.innerHTML = '';
  if (historyDiv) historyDiv.innerHTML = '';
  dataset = [];
  console.log('History cleared; dataset length =', dataset.length);

  if (modelStatus) {
    const prev = modelStatus.textContent;
    modelStatus.textContent = 'Історію очищено';
    setTimeout(() => {
      modelStatus.textContent = prev;
    }, 1500);
  }
}

function preprocessForModel() {
  const tmp = document.createElement('canvas');
  tmp.width = 28; tmp.height = 28;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = 'white';
  tctx.fillRect(0, 0, 28, 28);
  tctx.drawImage(canvas, 0, 0, 28, 28);
  const imgData = tctx.getImageData(0, 0, 28, 28);
  let tensor = tf.browser.fromPixels(imgData, 1).toFloat().div(255.0);
  tensor = tf.sub(1.0, tensor);
  tensor = tensor.expandDims(0);
  return tensor;
}

async function recognizeAndAppend() {
  let recognized = '?';
  if (modelLoaded && model) {
    try {
      const input = preprocessForModel();
      const pred = model.predict(input);
      const arr = await pred.data();
      let maxIdx = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i] > arr[maxIdx]) maxIdx = i;
      recognized = LETTERS[maxIdx] || '?';
      tf.dispose([input, pred]);
    } catch (e) {
      console.error('', e);
    }
  } else {
    console.warn('');
  }

  if (resultDisplay) {
    const span = document.createElement('span');
    span.className = 'result-letter';
    span.textContent = recognized;
    resultDisplay.appendChild(span);
  }

  if (historyDiv) {
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toLocaleTimeString()} — ${recognized}`;
    historyDiv.prepend(entry);
  }
}
