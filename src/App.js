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
} from "lucide-react";

/**
 * Función de utilidad para llamadas a la API con reintentos automáticos
 */
const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      if (res.status === 401) throw new Error("Clave de API inválida.");
      if (res.status === 404) throw new Error("Modelo de IA no encontrado.");
      throw new Error(
        `Error ${res.status}: ${errorData?.error?.message || "Error de red"}`
      );
    }
    return await res.json();
  } catch (error) {
    if (retries > 0) {
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
    { name: "Jorge", phone: "+34 600 000 000" },
    { name: "Karla León Núñez", phone: "+34 600 000 000" },
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
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef(authorizedNames);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, buenas tardes. Soy el asistente de MicroSmart. ¿En qué puedo ayudarle?",
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
    }
  }, []);

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

  const speakResponse = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/\[.*?\]/g, "").trim();
      if (!cleanText) return;
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-ES";
      const voices = window.speechSynthesis.getVoices();
      let bestVoice = voices.find(
        (v) =>
          (v.lang.startsWith("es-") || v.lang === "es") &&
          (v.name.includes("Premium") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Google") ||
            v.name.includes("Siri"))
      );
      if (bestVoice) utterance.voice = bestVoice;
      isSpeakingRef.current = true;
      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (isFluidModeRef.current) setTimeout(startListening, 300);
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
            if (isFluidModeRef.current && !isProcessingRef.current)
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
          recognitionRef.current.stop();
          handleSimulateVisitor(transcript);
        }
      };
    }
    try {
      if (isFluidModeRef.current) recognitionRef.current.start();
    } catch (e) {}
  };

  const toggleFluidMode = () => {
    if (isFluidModeRef.current) {
      isFluidModeRef.current = false;
      setIsFluidMode(false);
      setIsListening(false);
      if (recognitionRef.current) recognitionRef.current.stop();
    } else {
      isFluidModeRef.current = true;
      setIsFluidMode(true);
      startListening();
    }
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");
    try {
      await fetch(`${firebaseUrl}/puerta.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("ABRIR"),
      });
      setDoorStatus("opened");
      setHistoryLog((prev) => [
        {
          id: Date.now(),
          type: "manual",
          title: "Apertura Manual",
          desc: "Acceso concedido",
          time: getCurrentTime(),
          date: "Hoy",
        },
        ...prev,
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2000);
    }
  };

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;
    isProcessingRef.current = true;
    setChatHistory((prev) => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setIsTyping(true);

    const allowedNamesList = authorizedNamesRef.current
      .map((p) => p.name)
      .join(", ");
    const systemPrompt = `Eres el CONSERJE INTELIGENTE de MicroSmart. Analiza y razona con lógica:
    1. AMABILIDAD: Saluda y despídete siempre de forma educada.
    2. RAZONAMIENTO: Si el nombre coincide parcialmente con la lista [${allowedNamesList}], usa la lógica para confirmar. 
    3. SEGURIDAD: No confirmes quién vive allí si no dicen el nombre primero.
    4. REPARTIDORES: Si es verificado, abre con la etiqueta [ABRIR_PUERTA].
    5. RECADOS: Si no pueden atender, ofrece guardar un mensaje [MENSAJE_PARA].
    Usa [FIN_CONVERSACION] al despedirte.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`;
      const contents = [
        ...apiHistoryRef.current,
        { role: "user", parts: [{ text: textToSend }] },
      ];
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4 },
        }),
      });

      let aiText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No entiendo, ¿podría repetir?";
      apiHistoryRef.current = [
        ...contents,
        { role: "model", parts: [{ text: aiText }] },
      ];

      const cleanAiText = aiText.replace(/\[.*?\]/g, "").trim();
      const abrirMatch = aiText.match(
        /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );

      if (abrirMatch) {
        fetch(`${firebaseUrl}/puerta.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify("ABRIR"),
        });
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_open",
            title: `Paquete: ${abrirMatch[1]}`,
            desc: `Para: ${abrirMatch[2]}`,
            time: getCurrentTime(),
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      setChatHistory((prev) => [...prev, { role: "ai", content: cleanAiText }]);
      if (aiText.includes("[FIN_CONVERSACION]")) {
        isFluidModeRef.current = false;
        setIsFluidMode(false);
      }
      speakResponse(cleanAiText);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-2xl overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        {/* Cabecera */}
        <div className="bg-white px-6 pt-10 pb-3 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <MicroSmartLogo className="h-[70px] flex items-center" />
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center text-white shadow-lg">
              <User size={20} />
            </div>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto pb-24 px-6 pt-4 scrollbar-hide">
          {activeTab === "home" && (
            <div className="flex flex-col items-center py-10 space-y-10">
              <div className="flex items-center space-x-2 bg-green-50 px-4 py-2 rounded-full text-[10px] font-bold text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>SISTEMA CONECTADO A LA NUBE</span>
              </div>
              <button
                onClick={handleOpenDoor}
                disabled={doorStatus !== "idle"}
                className={`w-52 h-52 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all active:scale-95 ${
                  doorStatus === "idle" ? "bg-[#7bc100]" : "bg-[#00479b]"
                }`}
              >
                <Power size={50} className="text-white mb-2" />
                <span className="text-white font-black text-xl">
                  {doorStatus === "idle" ? "ABRIR" : "..."}
                </span>
              </button>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="flex flex-col h-full bg-slate-50 -mx-6 rounded-t-3xl border-t border-slate-200">
              <div className="p-4 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0">
                <h2 className="text-sm font-black text-slate-800 flex items-center">
                  <Bot size={18} className="mr-2 text-[#00479b]" /> Conserje Pro
                </h2>
                <div
                  className={`px-3 py-1 text-[8px] font-black rounded-full ${
                    isFluidMode
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isFluidMode ? "MODO VOZ ACTIVO" : "MODO DORMIDO"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-[#00479b] text-white rounded-br-none"
                          : "bg-white text-slate-700 rounded-bl-none shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex flex-col items-center">
                <button
                  onClick={toggleFluidMode}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
                    isFluidMode
                      ? "bg-red-500 ring-8 ring-red-50"
                      : "bg-slate-200"
                  }`}
                >
                  <Mic
                    size={30}
                    className={isFluidMode ? "text-white" : "text-slate-400"}
                  />
                </button>
                <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">
                  {isListening ? "Le escucho..." : "Toque para hablar"}
                </p>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="py-4 space-y-6 animate-in fade-in duration-500">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Configuración
              </h2>

              {/* Sección de Personas Autorizadas (LA QUE FALTABA) */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-4">
                  <UserPlus size={18} className="text-[#00479b]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Residentes en la casa
                  </h3>
                </div>

                <div className="space-y-2 mb-6">
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">
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

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase">
                    Añadir nuevo residente
                  </p>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 ring-blue-100"
                  />
                  <div className="flex space-x-2">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Teléfono"
                      className="flex-1 bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none"
                    />
                    <button
                      onClick={handleAddName}
                      className="bg-[#00479b] text-white px-6 rounded-xl text-xs font-bold shadow-lg"
                    >
                      AÑADIR
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center space-x-3 mb-1">
                  <Wifi size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-slate-800 text-sm">
                    Estado del Interfono
                  </h3>
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-8">
                  Conectado vía Firebase Cloud
                </p>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="py-4 space-y-4">
              <h2 className="text-xl font-black text-slate-800 mb-4">
                Registro de Actividad
              </h2>
              {historyLog.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4"
                >
                  <div
                    className={`p-3 rounded-xl ${
                      log.type === "ai_open"
                        ? "bg-green-100 text-green-600"
                        : "bg-blue-100 text-[#00479b]"
                    }`}
                  >
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-xs">
                      {log.title}
                    </h4>
                    <p className="text-[10px] text-slate-500">{log.desc}</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-700">
                    {log.time}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "messages" && (
            <div className="py-4 space-y-4">
              <h2 className="text-xl font-black text-slate-800 mb-4">
                Mensajes Recibidos
              </h2>
              {messagesList.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white p-5 rounded-3xl shadow-md border-l-4 border-[#7bc100]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 text-sm">
                      Para: {msg.recipient}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {msg.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-4 italic">
                    "{msg.content}"
                  </p>
                  <div className="flex space-x-2">
                    <button className="flex-1 bg-slate-800 text-white py-2 rounded-xl text-[10px] font-bold">
                      <Wand2 size={12} className="inline mr-2" /> REACCIONAR
                    </button>
                    <a
                      href={`https://wa.me/${msg.phone.replace(/\D/g, "")}`}
                      className="p-2 bg-[#25d366] text-white rounded-xl"
                    >
                      <PhoneForwarded size={16} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Menú Inferior */}
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
      className={`relative flex-1 flex flex-col items-center justify-center p-2 transition-all duration-300 ${
        active ? "text-[#00479b]" : "text-slate-400"
      }`}
    >
      <div className={`transition-all ${active ? "scale-110" : "scale-100"}`}>
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-[7px] font-black uppercase mt-1 ${
          active ? "opacity-100" : "opacity-0 h-0"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
