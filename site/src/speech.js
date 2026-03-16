function getNativeSpeechPlugin() {
  return window.Capacitor?.Plugins?.SpeechRecognition || null;
}

function normalizeNativeTranscript(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return "";
  }

  return matches
    .map((value) => String(value || "").trim())
    .sort((left, right) => right.length - left.length)[0];
}

function createNativeSpeechController({ textarea, statusNode, startButton, stopButton, onTranscript, plugin }) {
  let baseValue = "";
  let listening = false;
  let partialResultsHandle = null;
  let listeningStateHandle = null;

  const syncButtons = () => {
    startButton.disabled = listening;
    if (stopButton) {
      stopButton.disabled = !listening;
    }
  };

  const setTranscript = (transcript) => {
    const cleanedTranscript = String(transcript || "").trim();
    const nextValue = [baseValue, cleanedTranscript].filter(Boolean).join(baseValue ? " " : "");
    textarea.value = nextValue;
    if (typeof onTranscript === "function") {
      onTranscript(nextValue);
    }
  };

  const removeHandle = async (handle) => {
    if (!handle || typeof handle.remove !== "function") {
      return;
    }

    try {
      await handle.remove();
    } catch {}
  };

  const cleanupListeners = async () => {
    await removeHandle(partialResultsHandle);
    await removeHandle(listeningStateHandle);
    partialResultsHandle = null;
    listeningStateHandle = null;
  };

  const finishListening = async (message) => {
    listening = false;
    statusNode.textContent = message;
    syncButtons();
    await cleanupListeners();
  };

  const ensurePermission = async () => {
    if (typeof plugin.checkPermissions !== "function" || typeof plugin.requestPermissions !== "function") {
      return;
    }

    let permissions = await plugin.checkPermissions();
    if (permissions?.speechRecognition === "granted" || permissions?.microphone === "granted") {
      return;
    }

    permissions = await plugin.requestPermissions();
    if (permissions?.speechRecognition === "granted" || permissions?.microphone === "granted") {
      return;
    }

    throw new Error("Microphone permission was not granted.");
  };

  syncButtons();

  return {
    async start() {
      if (listening) {
        return;
      }

      try {
        const availability =
          typeof plugin.available === "function" ? await plugin.available() : { available: true };
        if (availability?.available === false) {
          throw new Error("Voice capture is not available on this device.");
        }

        await ensurePermission();
        await cleanupListeners();

        baseValue = textarea.value.trim();
        statusNode.textContent = "Opening your microphone...";
        listening = true;
        syncButtons();

        if (typeof plugin.addListener === "function") {
          partialResultsHandle = await plugin.addListener("partialResults", (event) => {
            const transcript = normalizeNativeTranscript(event?.matches);
            if (transcript) {
              setTranscript(transcript);
            }
          });

          listeningStateHandle = await plugin.addListener("listeningState", async (event) => {
            const status = String(event?.status || "").toLowerCase();

            if (status === "started") {
              statusNode.textContent = "I'm listening. Say it naturally.";
              return;
            }

            if (status === "stopped") {
              await finishListening("I've got it. Hit Generate when you're ready.");
            }
          });
        }

        const startResult =
          typeof plugin.start === "function"
            ? await plugin.start({
                language: "en-US",
                maxResults: 1,
                partialResults: true,
                popup: false
              })
            : null;

        const transcript = normalizeNativeTranscript(startResult?.matches);
        if (transcript) {
          setTranscript(transcript);
        }

        statusNode.textContent = "I'm listening. Say it naturally.";
      } catch (error) {
        await finishListening(
          `I hit a voice capture snag: ${error instanceof Error ? error.message : "Please try again."}`
        );
      }
    },

    async stop() {
      if (!listening) {
        return;
      }

      try {
        if (typeof plugin.stop === "function") {
          await plugin.stop();
        }
      } catch {}

      await finishListening("I've got it. Hit Generate when you're ready.");
    },

    isListening() {
      return listening;
    }
  };
}

function createBrowserSpeechController({ textarea, statusNode, startButton, stopButton, onTranscript, Recognition }) {
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let baseValue = "";
  let listening = false;

  const syncButtons = () => {
    startButton.disabled = listening;
    if (stopButton) {
      stopButton.disabled = !listening;
    }
  };

  recognition.onstart = () => {
    listening = true;
    baseValue = textarea.value.trim();
    statusNode.textContent = "I'm listening. Say it naturally.";
    syncButtons();
  };

  recognition.onend = () => {
    listening = false;
    statusNode.textContent = "I've got it. Hit Generate when you're ready.";
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
    async start() {
      recognition.start();
    },
    async stop() {
      recognition.stop();
    },
    isListening() {
      return listening;
    }
  };
}

export function createSpeechController({ textarea, statusNode, startButton, stopButton, onTranscript }) {
  const nativePlugin = getNativeSpeechPlugin();
  if (nativePlugin) {
    statusNode.textContent = "Tap Record to use your device microphone.";
    return createNativeSpeechController({
      textarea,
      statusNode,
      startButton,
      stopButton,
      onTranscript,
      plugin: nativePlugin
    });
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Recognition) {
    return createBrowserSpeechController({
      textarea,
      statusNode,
      startButton,
      stopButton,
      onTranscript,
      Recognition
    });
  }

  statusNode.textContent = "Voice capture is not supported on this device yet.";
  startButton.disabled = true;
  if (stopButton) {
    stopButton.disabled = true;
  }
  return null;
}
