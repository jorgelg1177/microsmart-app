import React, { useState, useRef, useEffect } from "react";
import {
  Home,
  Clock,
  Bot,
  Settings,
  Power,
  Bell,
  ShieldCheck,
  User,
  MapPin,
  Package,
  ShieldAlert,
  ChevronRight,
  Wifi,
  Send,
  Sparkles,
  X,
  UserPlus,
  MessageSquare,
  PhoneForwarded,
  Menu,
  LogOut,
  Mic,
  MicOff,
  Volume2,
  Wand2,
  FileText,
  CheckCircle2,
} from "lucide-react";

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      console.error("Error de API:", res.status, errorData);
      if (res.status === 401)
        throw new Error("Error 401: Clave de API inválida o revocada.");
      if (res.status === 404)
        throw new Error("Error 404: El modelo de IA no se encuentra.");
      if (res.status === 400 || res.status === 403 || res.status === 429) {
        throw new Error(
          `Error de Google (${res.status}): ${
            errorData?.error?.message || "Revisar clave API o cuota"
          }`
        );
      }
      throw new Error(`Error HTTP: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (
      retries > 0 &&
      !error.message.includes("Error 401") &&
      !error.message.includes("Error 404") &&
      !error.message.includes("Error de Google")
    ) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

const MicroSmartLogo = ({ className }) => (
  <div className={className}>
    <img
      src="/logo.png"
      alt="MicroSmart Logo"
      className="h-full w-auto object-contain"
      onError={(e) => {
        e.target.style.display = "none";
        e.target.nextSibling.style.display = "block";
      }}
    />
    <span className="hidden font-black text-xl tracking-tighter text-slate-800 uppercase">
      MICRO<span className="text-[#7bc100]">SMART</span>
    </span>
  </div>
);

const getCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");
  const [authorizedNames, setAuthorizedNames] = useState([
    { name: "Jorge Loaiza", phone: "+34 600 111 222" },
    { name: "Karla León Núñez", phone: "+34 600 333 444" },
  ]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activitySummary, setActivitySummary] = useState("");
  const [draftingId, setDraftingId] = useState(null);

  const isFluidModeRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef(authorizedNames);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje inteligente de MicroSmart. ¿En qué le puedo ayudar?",
    },
  ]);
  const [apiHistory, setApiHistory] = useState([]);

  // =========================================================================
  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const aiModel = "gemini-2.5-flash";
  const firebaseUrl = process.env.REACT_APP_FIREBASE_URL;
  // =========================================================================

  useEffect(() => {
    authorizedNamesRef.current = authorizedNames;
  }, [authorizedNames]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (isFluidModeRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        ) {
          speakResponse(
            "Parece que no hay nadie. Me retiro, que tenga un excelente día.",
            true
          );
          setChatHistory((prev) => [
            ...prev,
            {
              role: "ai",
              content:
                "Parece que no hay nadie. Me retiro, que tenga un excelente día. [Llamada finalizada por inactividad]",
            },
          ]);
        }
      }, 15000);
    }
  };

  const stopFluidMode = () => {
    isFluidModeRef.current = false;
    setIsFluidMode(false);
    setIsListening(false);
    isProcessingRef.current = false;
    isSpeakingRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  };

  const handleSummarizeActivity = async () => {
    if (!apiKey) return setActivitySummary("Falta configurar la clave API.");
    if (historyLog.length === 0)
      return setActivitySummary(
        "No hay actividad registrada hoy para resumir."
      );
    if (isSummarizing) return;
    setIsSummarizing(true);
    const activityData = historyLog
      .map((log) => `${log.time}: ${log.title} - ${log.desc}`)
      .join("\n");
    const prompt = `Resume brevemente la actividad de hoy del portero de forma profesional: ${activityData}`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      setActivitySummary(
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No hay resumen disponible."
      );
    } catch (e) {
      setActivitySummary("Error: " + e.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftReply = async (message) => {
    if (!apiKey) return alert("Falta configurar la clave API.");
    setDraftingId(message.id);
    const prompt = `Redacta una respuesta de WhatsApp muy corta y amable para este recado: "${message.content}"`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const draft = response.candidates?.[0]?.content?.parts?.[0]?.text;
      const whatsappUrl = `https://wa.me/${message.phone.replace(
        /\D/g,
        ""
      )}?text=${encodeURIComponent(draft.trim())}`;
      window.open(whatsappUrl, "_blank");
    } catch (e) {
      console.error(e);
    } finally {
      setDraftingId(null);
    }
  };

  const speakResponse = (text, shouldEndCall = false) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\[.*?\]/g, "").trim();

      if (!cleanText) {
        isProcessingRef.current = false;
        if (isFluidModeRef.current && !shouldEndCall) {
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
        } else if (shouldEndCall) {
          stopFluidMode();
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      const voices = window.speechSynthesis.getVoices();
      let bestVoice = voices.find(
        (v) =>
          (v.lang.startsWith("es-") || v.lang === "es") &&
          (v.name.includes("Premium") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Google") ||
            v.name.includes("Siri") ||
            v.name.includes("Natural"))
      );
      if (!bestVoice)
        bestVoice = voices.find(
          (v) => v.lang.startsWith("es-") || v.lang === "es"
        );
      if (bestVoice) utterance.voice = bestVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      isSpeakingRef.current = true;
      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (shouldEndCall) {
          stopFluidMode();
        } else if (isFluidModeRef.current) {
          setTimeout(() => {
            startListening();
            resetSilenceTimer();
          }, 300);
        }
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (
          isFluidModeRef.current &&
          !isProcessingRef.current &&
          !isSpeakingRef.current
        ) {
          setTimeout(() => {
            if (
              isFluidModeRef.current &&
              !isProcessingRef.current &&
              !isSpeakingRef.current
            )
              try {
                recognitionRef.current.start();
              } catch (e) {}
          }, 300);
        }
      };
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          isProcessingRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current.stop();
          handleSimulateVisitor(transcript);
        }
      };
      recognitionRef.current.onerror = () => setIsListening(false);
    }
    if (
      isFluidModeRef.current &&
      !isProcessingRef.current &&
      !isSpeakingRef.current
    )
      try {
        recognitionRef.current.start();
      } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) {
      stopFluidMode();
    } else {
      if ("speechSynthesis" in window) {
        const unlock = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlock);
      }
      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
      resetSilenceTimer();
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    const style = document.createElement("style");
    style.innerHTML = `* { touch-action: pan-y; -webkit-tap-highlight-color: transparent; } input, textarea, select { font-size: 16px !important; } .scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`;
    document.head.appendChild(style);
    return () => {
      document.body.style.overflow = "auto";
      document.body.style.position = "static";
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  const handleAddName = () => {
    if (newName.trim() && newPhone.trim()) {
      const formattedPhone = newPhone.startsWith("+")
        ? newPhone.trim()
        : `+34 ${newPhone.trim()}`;
      setAuthorizedNames([
        ...authorizedNames,
        { name: newName.trim(), phone: formattedPhone },
      ]);
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = (nameToRemove) => {
    setAuthorizedNames(
      authorizedNames.filter((person) => person.name !== nameToRemove)
    );
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");

    try {
      if (firebaseUrl) {
        await fetch(`${firebaseUrl}/puerta.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify("ABRIR"),
        });
      }

      setDoorStatus("opened");
      setHistoryLog((prev) => [
        {
          id: Date.now(),
          type: "manual",
          title: "Apertura Manual",
          desc: "Desde App",
          time: getCurrentTime(),
          date: "Hoy",
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Error al conectar con la nube:", error);
      alert(
        "Error de conexión. Revisa que configuraste bien la URL de Firebase."
      );
      setDoorStatus("idle");
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2500);
    }
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;

    if (!apiKey) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: "⚠️ Sistema: No se detecta la clave API." },
      ]);
      setIsTyping(false);
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();
    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setIsTyping(true);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
    const allowedNamesList =
      authorizedNamesRef.current.length > 0
        ? authorizedNamesRef.current.map((p) => p.name).join(", ")
        : "Nadie";

    // --- CEREBRO DEFINITIVO: IDENTIDAD, REPARTIDORES Y PRIVACIDAD ---
    const systemPrompt = `Eres el Conserje Inteligente desarrollado por la empresa MicroSmart. 
IMPORTANTE SOBRE TU IDENTIDAD: MicroSmart es una empresa tecnológica líder en domótica y sistemas autónomos. Tú eres uno de sus productos, instalado para proteger esta vivienda privada. La casa NO se llama MicroSmart. Si te preguntan quién o qué eres, responde con naturalidad que eres el sistema inteligente creado por MicroSmart.

REGLA 1 - PRIVACIDAD INNEGOCIABLE (MODO CAJA FUERTE):
NUNCA, bajo ningún concepto, reveles ni confirmes el apellido o nombre de un residente si el visitante no lo ha dicho de forma exacta primero.
- MAL: "¿Busca a Jorge Loaiza?".
- BIEN: "Entendido, ¿me podría indicar el apellido para confirmar?"
- Si preguntan "¿Vive aquí la familia X?", di: "Por seguridad, indíqueme a quién busca exactamente".

REGLA 2 - MODO CAMALEÓN Y NATURALIDAD (CERO ROBOT):
- Usa muletillas humanas al inicio de tus frases: "Vale", "Entiendo", "A ver...", "De acuerdo", "Perfecto", "Un segundo".
- NO repitas "por favor" o "gracias" en cada frase. Úsalas esporádicamente para que suene natural.
- Si el visitante tiene prisa (ej. "¡Amazon!", "Paquete"): Sé rápido y directo. Si está tranquilo, sé cálido.

REGLA 3 - INTELIGENCIA Y LÓGICA:
Si el visitante dice un nombre y al menos UN apellido correcto de la lista, dale el acceso por válido. (Ej: Si la lista es "Karla León Núñez" y dicen "Para Karla Núñez", usa la lógica, es correcto).

PROTOCOLOS ESTRICTOS DE SALIDA (Usa SIEMPRE las etiquetas al final de tu respuesta):
- REPARTIDORES: Cuando verifiques nombre y apellido, dales acceso. SIEMPRE debes pedirles dos cosas: 1) Que dejen el paquete en un lugar seguro dentro y 2) Que se aseguren de cerrar bien la puerta al salir. 
¡IMPORTANTE!: Usa tus propias palabras cada vez para sonar natural. NO digas siempre la misma frase. (Ejemplos: "Vale, le abro. Déjelo en la entrada y asegúrese de que la puerta queda cerrada al irse", "Perfecto, pase y déjelo a salvo dentro, y no olvide tirar de la puerta, gracias"). -> [ABRIR_PUERTA | Empresa | Destinatario]
- VISITA VERIFICADA: "Adelante, puede pasar." -> [ABRIR_PUERTA | Visita | Nombre]
- NO AUTORIZADO: "Lo siento, sin el nombre completo no puedo abrir. Si quiere déjeme un recado y yo se lo paso." -> [MENSAJE_PARA | Desconocido | texto]
- RECHAZO DIRECTO: [ACCESO_DENEGADO | Motivo]

REGLA DE AUTO-COLGADO:
Añade la etiqueta [FIN_CONVERSACION] ÚNICAMENTE cuando la conversación termine de forma natural (ya abriste la puerta al repartidor, ya tomaste el recado, o se han despedido).`;

    let validApiHistory = [...apiHistoryRef.current];
    let combinedText = textToSend;
    if (
      validApiHistory.length > 0 &&
      validApiHistory[validApiHistory.length - 1].role === "user"
    ) {
      const lastMsg = validApiHistory.pop();
      combinedText = lastMsg.parts[0].text + ". " + textToSend;
    }
    const newApiMsg = { role: "user", parts: [{ text: combinedText }] };
    const contents = [...validApiHistory, newApiMsg];

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { temperature: 0.65 },
        }),
      });
      let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) throw new Error("Respuesta vacía del servidor.");

      const updatedHistory = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];
      setApiHistory(updatedHistory);
      apiHistoryRef.current = updatedHistory;

      let actionType = null,
        endConversation = false;
      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();

      const abrirMatch = aiText.match(
        /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (abrirMatch) {
        actionType = "opened";
        const empresa = abrirMatch[1].trim();
        const destinatario = abrirMatch[2].trim();

        if (firebaseUrl) {
          fetch(`${firebaseUrl}/puerta.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify("ABRIR"),
          }).catch((e) => console.error("Error en nube:", e));
        }

        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_open",
            title: `Acceso IA: ${empresa}`,
            desc: `Para: ${destinatario}`,
            time: getCurrentTime(),
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        actionType = "message_saved";
        const destinatario = mensajeMatch[1].trim();
        const textoMensaje = mensajeMatch[2].trim();
        setMessagesList((prev) => [
          {
            id: Date.now(),
            recipient: destinatario,
            content: textoMensaje,
            time: getCurrentTime(),
            phone:
              authorizedNamesRef.current.find(
                (p) =>
                  p.name === destinatario ||
                  p.name.includes(destinatario.split(" ")[0])
              )?.phone || "Desconocido",
          },
          ...prev,
        ]);
        setHistoryLog((prev) => [
          {
            id: Date.now() + 1,
            type: "ai_message",
            title: `Recado guardado`,
            desc: `Para: ${destinatario}`,
            time: getCurrentTime(),
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      const rechazoMatch = aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/);
      if (rechazoMatch) {
        actionType = "denied";
        const motivo = rechazoMatch[1].trim();
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_denied",
            title: `Acceso Denegado`,
            desc: motivo,
            time: getCurrentTime(),
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      if (aiText.includes("[FIN_CONVERSACION]")) endConversation = true;

      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: finalAiText, action: actionType },
      ]);

      isProcessingRef.current = false;
      speakResponse(finalAiText, endConversation);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: `⚠️ Error de red. Intente de nuevo.` },
      ]);
      isProcessingRef.current = false;
      if (isFluidModeRef.current)
        setTimeout(() => {
          startListening();
          resetSilenceTimer();
        }, 1500);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        <div className="hidden md:block h-6 w-1/3 bg-[#1e293b] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-30"></div>
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo className="h-[84px] w-auto flex items-center" />
            <div className="flex space-x-1">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                <Bell size={20} className="text-slate-600" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Menu size={20} className="text-slate-600" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10">
              <User size={20} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                Hola, {authorizedNames[0]?.name?.split(" ")[0] || "Propietario"}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium flex items-center">
                <MapPin size={10} className="mr-1 text-[#7bc100]" />{" "}
                microsmart.es
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-2 scrollbar-hide">
          {activeTab === "home" && (
            <div className="flex flex-col items-center space-y-8 py-8 animate-in fade-in zoom-in duration-500">
              <div
                className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  doorStatus === "idle"
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    doorStatus === "idle"
                      ? "bg-green-500"
                      : "bg-blue-500 animate-pulse"
                  }`}
                ></div>
                <span>SISTEMA ONLINE</span>
              </div>

              <button
                onClick={handleOpenDoor}
                disabled={doorStatus !== "idle"}
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 
                  ${
                    doorStatus === "idle"
                      ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30"
                      : doorStatus === "opening"
                      ? "bg-[#00479b] shadow-blue-900/30"
                      : "bg-green-500 shadow-green-500/40 scale-105"
                  }`}
              >
                {doorStatus === "idle" && (
                  <>
                    <Power size={56} className="text-white mb-2" />
                    <span className="text-white text-xl font-black">ABRIR</span>
                  </>
                )}
                {doorStatus === "opening" && (
                  <>
                    <ShieldCheck
                      size={56}
                      className="text-white mb-2 animate-bounce"
                    />
                    <span className="text-white text-lg font-bold">
                      PROCESANDO
                    </span>
                  </>
                )}
                {doorStatus === "opened" && (
                  <>
                    <CheckCircle2
                      size={56}
                      className="text-white mb-2 animate-in zoom-in"
                    />
                    <span className="text-white text-xl font-black">
                      ABIERTO
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
          {activeTab === "ai" && (
            <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500 bg-slate-50 -mx-6 rounded-t-[2.5rem] overflow-hidden border-t border-slate-200">
              <div className="p-5 pb-2 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center">
                    <Sparkles size={18} className="mr-2 text-[#00479b]" />{" "}
                    Conserje IA
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    Conversación Fluida
                  </p>
                </div>
                <div
                  className={`px-2 py-1 ${
                    isFluidMode
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  } text-[8px] font-black rounded-full`}
                >
                  {isFluidMode ? "CONSERJE DESPIERTO" : "MODO DORMIDO"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-[#00479b] text-white rounded-br-none"
                          : "bg-white text-slate-700 rounded-bl-none border border-slate-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-bl-none shadow-sm flex space-x-1">
                      <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></div>
                      <div
                        className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={toggleFluidMode}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                      isFluidMode
                        ? isListening
                          ? "bg-red-500 scale-110 animate-pulse ring-8 ring-red-100"
                          : "bg-amber-400 ring-8 ring-amber-50"
                        : "bg-slate-200"
                    }`}
                  >
                    {isFluidMode ? (
                      isListening ? (
                        <Mic size={32} className="text-white" />
                      ) : (
                        <Volume2 size={32} className="text-white" />
                      )
                    ) : (
                      <MicOff size={32} className="text-slate-400" />
                    )}
                  </button>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    {isFluidMode
                      ? isListening
                        ? "Escuchando..."
                        : "Pensando..."
                      : "Toca el micro para despertar"}
                  </p>
                </div>
              </div>
            </div>
          )}
          {activeTab === "history" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Registro
                </h2>
                <button
                  onClick={handleSummarizeActivity}
                  disabled={isSummarizing || historyLog.length === 0}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg transition-all ${
                    historyLog.length === 0
                      ? "bg-slate-200 text-slate-400 shadow-none"
                      : "bg-[#00479b] text-white shadow-blue-900/20 active:scale-95"
                  }`}
                >
                  {isSummarizing ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Sparkles size={12} />
                  )}
                  <span>✨ RESUMIR</span>
                </button>
              </div>
              {activitySummary && (
                <div className="mb-6 bg-blue-50 p-4 rounded-3xl border border-blue-100 animate-in slide-in-from-top-2">
                  <h4 className="text-[10px] font-black text-[#00479b] mb-1 uppercase tracking-widest flex items-center">
                    <FileText size={12} className="mr-1" /> Resumen IA
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {activitySummary}
                  </p>
                  <button
                    onClick={() => setActivitySummary("")}
                    className="mt-2 text-[9px] font-bold text-slate-400 hover:text-slate-600 underline"
                  >
                    Cerrar resumen
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {historyLog.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-400 font-bold text-xs">
                      Aún no hay actividad hoy
                    </p>
                  </div>
                ) : (
                  historyLog.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3"
                    >
                      <div
                        className={`p-2.5 rounded-xl ${
                          log.type === "ai_open"
                            ? "bg-green-100 text-[#7bc100]"
                            : log.type === "ai_denied"
                            ? "bg-red-100 text-red-500"
                            : log.type === "ai_message"
                            ? "bg-amber-100 text-amber-500"
                            : "bg-blue-100 text-[#00479b]"
                        }`}
                      >
                        {log.type === "ai_open" ? (
                          <Package size={18} />
                        ) : log.type === "ai_denied" ? (
                          <ShieldAlert size={18} />
                        ) : log.type === "ai_message" ? (
                          <MessageSquare size={18} />
                        ) : (
                          <User size={18} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-xs mb-1">
                          {log.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {log.desc}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black text-slate-700 block">
                          {log.time}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === "messages" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Recados
              </h2>
              <div className="space-y-4">
                {messagesList.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <MessageSquare
                      size={40}
                      className="text-slate-300 mx-auto mb-3"
                    />
                    <p className="text-slate-400 font-bold text-xs">
                      Sin mensajes pendientes
                    </p>
                  </div>
                ) : (
                  messagesList.map((msg) => (
                    <div
                      key={msg.id}
                      className="bg-white p-5 rounded-3xl shadow-md border-l-4 border-l-[#7bc100]"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[8px] font-black text-[#00479b] tracking-tighter uppercase">
                            PARA
                          </span>
                          <h4 className="font-black text-slate-800 text-sm">
                            {msg.recipient}
                          </h4>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                          {msg.time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-4 font-medium italic">
                        "{msg.content}"
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDraftReply(msg)}
                          disabled={draftingId === msg.id}
                          className="flex-1 flex items-center justify-center bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black transition-all shadow-lg active:scale-95"
                        >
                          {draftingId === msg.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Wand2 size={14} className="mr-2" />
                          )}
                          ✨ REDACTAR
                        </button>
                        <a
                          href={`https://wa.me/${msg.phone.replace(
                            /\D/g,
                            ""
                          )}?text=${encodeURIComponent(
                            `Hola ${msg.recipient}, el Conserje MicroSmart tomó este recado para ti:\n\n"${msg.content}"`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-[#25d366] text-white rounded-xl shadow-lg active:scale-95"
                        >
                          <PhoneForwarded size={16} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Configuración
              </h2>
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <UserPlus size={18} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Personas Autorizadas
                  </h3>
                </div>
                <div className="space-y-2 mb-4">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                    >
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-700 block truncate">
                          {person.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          {person.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 p-2 hover:bg-red-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-slate-50 border border-slate-200 text-base text-slate-800 rounded-lg px-3 py-2.5 focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                      <span className="text-slate-400 text-sm font-bold pr-2 mr-2 border-r border-slate-200">
                        +34
                      </span>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="bg-transparent text-base text-slate-800 w-full py-2.5 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleAddName}
                      className="bg-[#00479b] text-white px-4 rounded-lg text-xs font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] bg-white/95 backdrop-blur-xl border border-white/50 px-2 py-2 flex justify-between items-center z-20 rounded-[2rem] shadow-2xl">
          <NavItem
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
            icon={<Home size={22} />}
            label="Inicio"
          />
          <NavItem
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            icon={<Clock size={22} />}
            label="Registro"
          />
          <NavItem
            active={activeTab === "messages"}
            onClick={() => setActiveTab("messages")}
            icon={<MessageSquare size={22} />}
            badge={messagesList.length}
            label="Recados"
          />
          <NavItem
            active={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            icon={<Bot size={22} />}
            label="IA"
          />
          <NavItem
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            icon={<Settings size={22} />}
            label="Ajustes"
          />
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center p-1.5 transition-all duration-300 ${
        active ? "text-[#00479b]" : "text-slate-400"
      }`}
    >
      <div
        className={`transition-all duration-300 ${
          active ? "scale-110 -translate-y-0.5" : "scale-100"
        }`}
      >
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-[7px] font-black uppercase tracking-tighter mt-1 transition-all ${
          active ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
