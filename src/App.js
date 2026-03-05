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
} from "lucide-react";

// Implementación de Backoff Exponencial protegida
const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      console.error("Error de API:", res.status, errorData);
      if (res.status === 400 || res.status === 403 || res.status === 429) {
        throw new Error(
          `Error de Google (${res.status}): ${
            errorData?.error?.message || "Revisar clave API"
          }`
        );
      }
      throw new Error(`Error HTTP: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (retries > 0 && !error.message.includes("Error de Google")) {
      console.warn(
        `Reintentando petición de red... Intentos restantes: ${retries}`
      );
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
    { name: "Carlos García", phone: "+34 600 111 222" },
    { name: "María López", phone: "+34 600 333 444" },
  ]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [historyLog, setHistoryLog] = useState([
    {
      id: 1,
      type: "manual",
      title: "Apertura Manual",
      desc: "Carlos García (Tú)",
      time: "09:00",
      date: "Hoy",
    },
  ]);
  const [messagesList, setMessagesList] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Estados para UI
  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);

  // Referencias CRÍTICAS para el Bucle de Voz (Semáforos)
  const isFluidModeRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje de MicroSmart. ¿Con quién hablo y en qué le puedo ayudar?",
    },
  ]);
  const [apiHistory, setApiHistory] = useState([]);
  const chatEndRef = useRef(null);

  // Precargar las voces del sistema al iniciar
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // --- LÓGICA DE VOZ Y SÍNTESIS MEJORADA PARA MÓVILES ---
  const speakResponse = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Parar cualquier audio previo

      const cleanText = text.replace(/\[.*?\]/g, "").trim();

      if (!cleanText) {
        isProcessingRef.current = false;
        if (isFluidModeRef.current) setTimeout(startListening, 300);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";

      // Búsqueda exhaustiva de voces naturales para iOS y Android
      const voices = window.speechSynthesis.getVoices();

      const preferredNames = [
        "google",
        "premium",
        "natural",
        "monica",
        "paulina",
        "jorge",
        "luciana",
        "network",
      ];

      let bestVoice = voices.find(
        (v) =>
          (v.lang.startsWith("es-") || v.lang === "es") &&
          preferredNames.some((name) => v.name.toLowerCase().includes(name))
      );

      if (!bestVoice) {
        bestVoice = voices.find(
          (v) =>
            (v.lang.startsWith("es-") || v.lang === "es") &&
            v.localService === false
        );
      }

      if (!bestVoice) {
        bestVoice = voices.find(
          (v) => v.lang.startsWith("es-") || v.lang === "es"
        );
      }

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      isSpeakingRef.current = true;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (isFluidModeRef.current) {
          setTimeout(startListening, 300);
        }
      };

      utterance.onerror = (e) => {
        console.error("Error en síntesis de voz:", e);
        isSpeakingRef.current = false;
        if (isFluidModeRef.current) {
          setTimeout(startListening, 500);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador.");
      stopFluidMode();
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.interimResults = false;
      recognitionRef.current.continuous = false;

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
            ) {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
          }, 300);
        }
      };

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          isProcessingRef.current = true;
          recognitionRef.current.stop();
          handleSimulateVisitor(transcript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        setIsListening(false);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          stopFluidMode();
        }
      };
    }

    if (
      isFluidModeRef.current &&
      !isProcessingRef.current &&
      !isSpeakingRef.current
    ) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const stopFluidMode = () => {
    isFluidModeRef.current = false;
    setIsFluidMode(false);
    setIsListening(false);
    isProcessingRef.current = false;
    isSpeakingRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    window.speechSynthesis.cancel();
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) {
      stopFluidMode();
    } else {
      if ("speechSynthesis" in window) {
        const unlockUtterance = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(unlockUtterance);
      }

      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
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
    style.innerHTML = `
      * { touch-action: pan-y; -webkit-tap-highlight-color: transparent; }
      input, textarea, select { font-size: 16px !important; }
      .scrollbar-hide::-webkit-scrollbar { display: none; }
      .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `;
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
    if (
      newName.trim() &&
      newPhone.trim() &&
      !authorizedNames
        .map((n) => n.name.toLowerCase())
        .includes(newName.trim().toLowerCase())
    ) {
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

  const handleOpenDoor = () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");
    setTimeout(() => {
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
      setTimeout(() => setDoorStatus("idle"), 2000);
    }, 1500);
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;

    isProcessingRef.current = true;
    if (recognitionRef.current) recognitionRef.current.stop();

    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setIsTyping(true);

    const apiKey = "AIzaSyD06jLabAFFFMxiZq0RAKQ7p5sWtwd8Mgw";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const allowedNamesList =
      authorizedNames.length > 0
        ? authorizedNames.map((p) => p.name).join(", ")
        : "Nadie";

    // EL NUEVO CEREBRO: Riguroso, natural y estructurado.
    const systemPrompt = `Eres el conserje virtual de alta seguridad de MicroSmart.
Tu PERSONALIDAD: Amable, natural, profesional y muy riguroso con la seguridad. Actúa como un humano, haciendo preguntas paso a paso.

MISIONES Y REGLAS DE SEGURIDAD CRÍTICAS:
1. NUNCA asumas o confirmes apellidos que el visitante no haya dicho primero.
2. NUNCA digas que la casa está vacía. Si el nombre no coincide, indica que se han equivocado.
3. Ve paso a paso. No pidas toda la información de golpe, mantén una conversación fluida.

PASOS DE VERIFICACIÓN (Síguelos estrictamente):
Paso 1: Si no se han presentado, pregunta con quién hablas y el motivo de la visita.
Paso 2: Si es un REPARTIDOR, debes asegurarte de preguntarle de qué empresa viene y para quién es el paquete exactamente (Nombre y Apellido).
Paso 3: Si es una VISITA, pregúntale a quién busca exactamente (Nombre y Apellido).
Paso 4: Compara el destinatario con la lista de PERSONAS AUTORIZADAS: [${allowedNamesList}].

ACCIONES FINALES (Usa estas etiquetas SOLO cuando hayas verificado toda la información rigurosamente):
- Si es REPARTIDOR y el destinatario coincide en la lista: Dile que le abres y usa la etiqueta [ABRIR_PUERTA | Empresa | Destinatario]
- Si es VISITA y el destinatario coincide en la lista: Dile que le vas a dejar un recado y usa la etiqueta [MENSAJE_PARA | NombreAutorizado | texto]
- Si NO coincide el nombre o es comercial: Rechaza amablemente y usa la etiqueta [ACCESO_DENEGADO | Motivo]

¡MUY IMPORTANTE SOBRE EL MICRÓFONO!:
SOLO añade la etiqueta [FIN_CONVERSACION] al final de tu mensaje SI acabas de usar una de las Acciones Finales (ABRIR_PUERTA, MENSAJE_PARA, ACCESO_DENEGADO) o si el usuario se despide explícitamente. 
MIENTRAS ESTÉS HACIENDO PREGUNTAS (ej. preguntando la empresa o el apellido), NUNCA uses [FIN_CONVERSACION], para que la conversación siga abierta y fluida.`;

    const newApiMsg = { role: "user", parts: [{ text: textToSend }] };

    let validApiHistory = [...apiHistory];
    if (
      validApiHistory.length > 0 &&
      validApiHistory[validApiHistory.length - 1].role === "user"
    ) {
      validApiHistory.pop();
    }

    const contents = [...validApiHistory, newApiMsg];

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
        }),
      });

      let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiText) throw new Error("Respuesta vacía de la IA.");

      setApiHistory([
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ]);

      let actionType = null;
      let endConversation = false;

      if (aiText.includes("[ABRIR_PUERTA")) actionType = "opened";
      else if (aiText.includes("[MENSAJE_PARA")) actionType = "message_saved";
      else if (aiText.includes("[ACCESO_DENEGADO")) actionType = "denied";

      if (aiText.includes("[FIN_CONVERSACION]")) {
        endConversation = true;
      }

      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: finalAiText, action: actionType },
      ]);

      isProcessingRef.current = false;

      if (endConversation) {
        isFluidModeRef.current = false;
        setIsFluidMode(false);
      }

      speakResponse(finalAiText);
    } catch (error) {
      console.error("Fetch error capturado:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content: `⚠️ Error de red. Repita.`,
        },
      ]);

      isProcessingRef.current = false;
      if (isFluidModeRef.current) {
        setTimeout(startListening, 1500);
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        <div className="hidden md:block h-6 w-1/3 bg-[#1e293b] absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-30"></div>

        {/* Cabecera */}
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <MicroSmartLogo className="h-[84px] w-auto flex items-center" />
            <div className="flex space-x-1">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors relative">
                <Bell size={20} className="text-slate-600" />
                {messagesList.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
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
                Hola, {authorizedNames[0]?.name?.split(" ")[0]}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium flex items-center">
                <MapPin size={10} className="mr-1 text-[#7bc100]" />{" "}
                microsmart.es
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
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
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
                  doorStatus === "idle"
                    ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30"
                    : "bg-[#00479b] shadow-blue-900/30"
                }`}
              >
                {doorStatus === "idle" ? (
                  <>
                    <Power size={56} className="text-white mb-2" />
                    <span className="text-white text-xl font-black">ABRIR</span>
                  </>
                ) : (
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
              </button>

              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <span className="text-xl font-black text-slate-800">
                    {historyLog.length}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Registros
                  </span>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <span className="text-xl font-black text-slate-800">
                    {messagesList.length}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Avisos
                  </span>
                </div>
              </div>
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
                <div className="flex items-center space-x-2">
                  <div
                    className={`px-2 py-1 ${
                      isFluidMode
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    } text-[8px] font-black rounded-full transition-colors`}
                  >
                    {isFluidMode ? "CONSERJE DESPIERTO" : "MODO DORMIDO"}
                  </div>
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
                        : "bg-slate-200 hover:bg-slate-300"
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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center transition-all">
                    {isFluidMode
                      ? isListening
                        ? "Escuchando..."
                        : "Conserje hablando..."
                      : "Toca el micro para despertar"}
                  </p>

                  <div className="w-full relative flex items-center mt-2 opacity-50 focus-within:opacity-100 transition-opacity">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleSimulateVisitor()
                      }
                      placeholder="O escribe algo..."
                      className="w-full bg-slate-50 text-base text-slate-800 rounded-xl px-4 py-3 focus:outline-none border border-slate-100"
                    />
                    <button
                      onClick={() => handleSimulateVisitor()}
                      disabled={isTyping}
                      className="absolute right-2 p-2 bg-[#00479b] text-white rounded-lg"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 py-4">
              <h2 className="text-xl font-black text-slate-800 mb-6 tracking-tight">
                Actividad
              </h2>
              <div className="space-y-3">
                {historyLog.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-3"
                  >
                    <div
                      className={`p-2.5 rounded-xl ${
                        log.type === "ai_open"
                          ? "bg-green-100 text-[#7bc100]"
                          : "bg-blue-100 text-[#00479b]"
                      } `}
                    >
                      {log.type === "ai_open" ? (
                        <Package size={18} />
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
                ))}
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
                      <a
                        href={`https://wa.me/${msg.phone.replace(
                          /\D/g,
                          ""
                        )}?text=${encodeURIComponent(
                          `Hola ${msg.recipient}, el Conserje MicroSmart tomó este recado para ti:\n\n"${msg.content}"`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full bg-[#25d366] hover:bg-[#128c7e] text-white py-2.5 rounded-xl text-[10px] font-black transition-all shadow-lg shadow-green-500/20"
                      >
                        <PhoneForwarded size={14} className="mr-2" /> REENVIAR
                        WHATSAPP
                      </a>
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
                    className="w-full bg-slate-50 border border-slate-200 text-base text-slate-800 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#7bc100]/20"
                  />
                  <div className="flex space-x-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3">
                      <span className="text-slate-400 text-sm font-bold border-r border-slate-200 pr-2 mr-2">
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

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-1">
                <button className="w-full flex justify-between items-center p-2.5 hover:bg-slate-50 rounded-xl transition-all">
                  <div className="flex items-center space-x-3">
                    <Wifi size={18} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      Configurar WiFi
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
                <button className="w-full flex justify-between items-center p-2.5 hover:bg-red-50 rounded-xl transition-all text-red-500">
                  <div className="flex items-center space-x-3">
                    <LogOut size={18} />
                    <span className="text-xs font-bold">Desconectar App</span>
                  </div>
                </button>
              </div>

              <div className="text-center pt-2 pb-6">
                <p className="text-[9px] font-black text-[#00479b] tracking-[0.2em]">
                  MICROSMART.ES
                </p>
                <p className="text-[8px] text-slate-300 font-bold mt-1 uppercase">
                  Control Inteligente v1.7
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Menú Dock */}
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
            label="Recados"
            badge={messagesList.length}
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
        active ? "text-[#00479b]" : "text-slate-400 hover:text-slate-600"
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
      {active && (
        <div className="absolute bottom-0 w-1 h-1 bg-[#00479b] rounded-full"></div>
      )}
    </button>
  );
}
