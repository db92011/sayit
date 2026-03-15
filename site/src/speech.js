export function createSpeechController({ textarea, statusNode, startButton, stopButton, onTranscript }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    statusNode.textContent = "Speech capture is not supported in this browser. Typing still works.";
    startButton.disabled = true;
    stopButton.disabled = true;
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let baseValue = "";
  let listening = false;

  const syncButtons = () => {
    startButton.disabled = listening;
    stopButton.disabled = !listening;
  };

  recognition.onstart = () => {
    listening = true;
    baseValue = textarea.value.trim();
    statusNode.textContent = "Listening. Speak naturally and your words will be appended to the draft.";
    syncButtons();
  };

  recognition.onend = () => {
    listening = false;
    statusNode.textContent = "Voice capture stopped.";
    syncButtons();
  };

  recognition.onerror = (event) => {
    listening = false;
    statusNode.textContent = `Voice capture error: ${event.error}.`;
    syncButtons();
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();

    const nextValue = [baseValue, transcript].filter(Boolean).join(baseValue ? " " : "");
    textarea.value = nextValue;
    if (typeof onTranscript === "function") {
      onTranscript(nextValue);
    }
  };

  syncButtons();

  return {
    start() {
      recognition.start();
    },
    stop() {
      recognition.stop();
    }
  };
}
