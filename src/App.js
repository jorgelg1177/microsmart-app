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

// Implementación de Backoff Exponencial para las llamadas a la API
const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      // Obtenemos más detalles del error si es posible
      const errorData = await res.json().catch(() => null);
      console.error("Error de API:", res.status, errorData);
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Reintentando petición... Intentos restantes: ${retries}`);
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

  // Estados para Voz Fluida
  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje de MicroSmart. ¿Con quién hablo y en qué le puedo ayudar?",
    },
  ]);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- LÓGICA DE VOZ Y SÍNTESIS ---

  const speakResponse = (text) => {
    if ("speechSynthesis" in window) {
      // Cancelar cualquier lectura previa
      window.speechSynthesis.cancel();

      const cleanText = text.replace(/\[.*?\]/g, "").trim();

      if (!cleanText) return; // No hablar si no hay texto

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      utterance.rate = 1.0;

      utterance.onend = () => {
        // SI estamos en modo fluido, volvemos a escuchar automáticamente al terminar de hablar
        if (isFluidMode) {
          setTimeout(() => {
            startVoiceRecognition();
          }, 500);
        }
      };

      utterance.onerror = (e) => {
        console.error("Error en síntesis de voz:", e);
        if (isFluidMode) {
          setTimeout(startVoiceRecognition, 1000);
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador.");
      setIsFluidMode(false);
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = "es-ES";
      recognitionRef.current.interimResults = false;
      recognitionRef.current.continuous = false;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          // Detenemos explícitamente para asegurar que no haya solapamientos
          recognitionRef.current.stop();
          handleSimulateVisitor(transcript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Error de reconocimiento de voz:", event.error);
        setIsListening(false);
        // Si hay error (como silencio - 'no-speech'), reintentamos si sigue el modo fluido
        if (isFluidMode && event.error === "no-speech") {
          setTimeout(startVoiceRecognition, 1000);
        } else if (isFluidMode && event.error !== "aborted") {
          setIsFluidMode(false); // Apagar si es un error diferente
        }
      };
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("Reconocimiento ya iniciado", e);
    }
  };

  const toggleFluidMode = () => {
    if (isFluidMode) {
      // Apagar modo fluido
      setIsFluidMode(false);
      setIsListening(false);
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    } else {
      // Encender modo fluido
      setIsFluidMode(true);
      startVoiceRecognition();
    }
  };

  // --- BLOQUEO DE ZOOM Y SCROLL ---
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

    const newUserMsg = { role: "user", content: textToSend };
    setChatHistory((prev) => [...prev, newUserMsg]);
    setChatInput("");
    setIsTyping(true);

    // API Key configurada
    const apiKey = "AIzaSyDVE6h1s-PPAWXvYg-t_f9kf6y0YfskQRs";

    if (!apiKey) {
      console.error("API Key no configurada.");
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Error: Falta configurar la clave API del asistente.",
        },
      ]);
      setIsTyping(false);
      if (isFluidMode) setIsFluidMode(false);
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const allowedNamesList =
      authorizedNames.length > 0
        ? authorizedNames.map((p) => p.name).join(", ")
        : "Nadie";

    const systemPrompt = `Eres el conserje virtual de alta seguridad de una vivienda, creado por MicroSmart.
Tu PERSONALIDAD: Amable, natural y educado. Mantén un tono formal y eficiente pero agradable.
ESTÁS EN UNA CONVERSACIÓN FLUIDA POR VOZ. Sé breve y directo para que la charla no sea lenta.

REGLAS DE SEGURIDAD:
1. NUNCA confirmes apellidos que el visitante NO diga.
2. El visitante DEBE dar NOMBRE Y APELLIDO EXACTO.
PERSONAS AUTORIZADAS: [${allowedNamesList}].

PROTOCOLO:
- REPARTIDOR: Debe decir EMPRESA y DESTINATARIO. Si es correcto, abre. Usa exactamente la etiqueta: [ABRIR_PUERTA | Empresa | Destinatario]
- VISITA: Si valida nombre completo y no estás, ofrece recado. Usa exactamente la etiqueta: [MENSAJE_PARA | NombreAutorizado | texto]
- RECHAZO: Si no coincide nombre, rechaza educadamente. Usa exactamente la etiqueta: [ACCESO_DENEGADO | Motivo]`;

    // Filtramos el historial para asegurarnos de que el formato sea el correcto para Gemini
    const contents = [
      ...chatHistory.filter((m) => m.role !== "system"),
      newUserMsg,
    ].map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    try {
      console.log("Enviando petición a Gemini...");
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
        }),
      });

      console.log("Respuesta recibida:", data);
      let aiText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No entiendo, ¿puede repetir?";
      let actionType = null;

      if (aiText.includes("[ABRIR_PUERTA")) actionType = "opened";
      else if (aiText.includes("[MENSAJE_PARA")) actionType = "message_saved";
      else if (aiText.includes("[ACCESO_DENEGADO")) actionType = "denied";

      const finalAiText = aiText.replace(/\[.*?\]/g, "").trim();
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: finalAiText, action: actionType },
      ]);

      // HABLAR RESPUESTA
      speakResponse(finalAiText);
    } catch (error) {
      console.error("Fetch error capturado:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Lo siento, ha ocurrido un error de conexión con el servidor.",
        },
      ]);
      if (isFluidMode) setIsFluidMode(false); // Desactivar modo fluido si hay error severo
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

        {/* Contenido con Scroll Interno */}
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
                    } text-[8px] font-black rounded-full`}
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

              {/* Control de Voz Centralizado */}
              <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex flex-col items-center space-y-4">
                  <button
                    onClick={toggleFluidMode}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl ${
                      isFluidMode
                        ? isListening
                          ? "bg-red-500 scale-110 animate-pulse ring-8 ring-red-100"
                          : "bg-green-500 ring-8 ring-green-50"
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
                        ? "Habla ahora..."
                        : "Conserje procesando..."
                      : "Toca el micro para despertar al conserje"}
                  </p>

                  {/* Backup para escribir si no quieren hablar */}
                  <div className="w-full relative flex items-center mt-2 opacity-50 focus-within:opacity-100 transition-opacity">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleSimulateVisitor()
                      }
                      placeholder="Escribe algo..."
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

          {/* ... Pestañas de Mensajes y Ajustes se mantienen igual ... */}
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
