export function createSpeechController({ textarea, statusNode, startButton, stopButton, onTranscript }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) {
    statusNode.textContent = "Voice capture is not supported in this browser yet.";
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
    statusNode.textContent = "I'm listening. Say it naturally.";
    syncButtons();
  };

  recognition.onend = () => {
    listening = false;
    statusNode.textContent = "I've got it. Hit Let's do this when you're ready.";
    syncButtons();
  };

  recognition.onerror = (event) => {
    listening = false;
    statusNode.textContent = `I hit a voice capture snag: ${event.error}.`;
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
