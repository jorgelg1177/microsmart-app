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
  Lock,
  Smartphone,
  Bluetooth,
} from "lucide-react";

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

const MicroSmartLogo = ({ className, showText = true }) => (
  <div className={`flex items-center ${className}`}>
    <div className="w-10 h-10 bg-gradient-to-tr from-[#00479b] to-[#005cd0] rounded-xl flex items-center justify-center shadow-lg mr-2 font-black text-white text-2xl italic tracking-tighter">
      S
    </div>
    {showText && (
      <span className="font-black text-2xl tracking-tighter text-slate-800 uppercase">
        MICRO<span className="text-[#7bc100]">SMART</span>
      </span>
    )}
  </div>
);

const getCurrentTime = () =>
  new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function App() {
  // --- ESTADOS DE CONTROL ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState(""); // Nuevo estado para la contraseña
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]); // Lista de dispositivos emparejados

  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");

  // --- DATOS DINÁMICOS ---
  const [authorizedNames, setAuthorizedNames] = useState([]);
  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFluidMode, setIsFluidMode] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activitySummary, setActivitySummary] = useState("");
  const [draftingId, setDraftingId] = useState(null);

  // --- REFERENCIAS ---
  const isFluidModeRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const apiHistoryRef = useRef([]);
  const authorizedNamesRef = useRef([]);
  const chatEndRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje inteligente de MicroSmart. ¿En qué puedo ayudarle?",
    },
  ]);

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const firebaseUrl = process.env.REACT_APP_FIREBASE_URL;

  // =========================================================================
  // SISTEMA DE PERSISTENCIA LOCAL (MEMORIA DEL NAVEGADOR)
  // =========================================================================
  useEffect(() => {
    // Al abrir la app, comprobamos si ya había una sesión o dispositivos guardados
    const savedSession = localStorage.getItem("microSmart_userEmail");
    const savedDevices = localStorage.getItem("microSmart_devices");

    if (savedSession) {
      setUserEmail(savedSession);
      setIsAuthenticated(true);
    }
    if (savedDevices) {
      setPairedDevices(JSON.parse(savedDevices));
    }
  }, []);

  const handleLogin = () => {
    if (userEmail.trim() === "" || password.trim() === "") {
      alert("Por favor, introduce un correo y contraseña válidos.");
      return;
    }
    // Guardamos la sesión de forma persistente
    localStorage.setItem("microSmart_userEmail", userEmail);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    // Borramos la sesión
    localStorage.removeItem("microSmart_userEmail");
    setIsAuthenticated(false);
    setUserEmail("");
    setPassword("");
  };

  const handlePairDevice = () => {
    setIsPairing(true);
    // Simulamos la búsqueda de 3 segundos
    setTimeout(() => {
      setIsPairing(false);
      const newDevices = ["ESP32_Interfono_1"];
      setPairedDevices(newDevices);
      // Guardamos el dispositivo de forma persistente en la memoria del móvil
      localStorage.setItem("microSmart_devices", JSON.stringify(newDevices));
    }, 3000);
  };

  // --- SINCRONIZACIÓN CON FIREBASE ---
  useEffect(() => {
    if (isAuthenticated && firebaseUrl) {
      fetch(`${firebaseUrl}/residents.json`)
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            const list = Object.values(data);
            setAuthorizedNames(list);
            authorizedNamesRef.current = list;
          } else {
            const defaults = [
              { name: "Jorge Loaiza", phone: "+34 600 000 000" },
              { name: "Karla León Núñez", phone: "+34 600 111 222" },
            ];
            setAuthorizedNames(defaults);
            authorizedNamesRef.current = defaults;
          }
        });

      fetch(`${firebaseUrl}/history.json`)
        .then((res) => res.json())
        .then(
          (data) =>
            data &&
            setHistoryLog(Object.values(data).sort((a, b) => b.id - a.id))
        );

      fetch(`${firebaseUrl}/messages.json`)
        .then((res) => res.json())
        .then(
          (data) =>
            data &&
            setMessagesList(Object.values(data).sort((a, b) => b.id - a.id))
        );
    }
  }, [isAuthenticated, firebaseUrl]);

  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () =>
        window.speechSynthesis.getVoices();
    }
  }, []);

  const handleAddName = async () => {
    if (newName.trim() && newPhone.trim()) {
      const newUser = { name: newName.trim(), phone: newPhone.trim() };
      const updated = [...authorizedNames, newUser];
      setAuthorizedNames(updated);
      authorizedNamesRef.current = updated;
      if (firebaseUrl) {
        await fetch(`${firebaseUrl}/residents/${Date.now()}.json`, {
          method: "PUT",
          body: JSON.stringify(newUser),
        });
      }
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
      if (firebaseUrl)
        await fetch(`${firebaseUrl}/puerta.json`, {
          method: "PUT",
          body: JSON.stringify("ABRIR"),
        });
      setDoorStatus("opened");
      const log = {
        id: Date.now(),
        type: "manual",
        title: "Apertura App",
        desc: `Autorizado por ${userEmail.split("@")[0]}`,
        time: getCurrentTime(),
      };
      setHistoryLog((prev) => [log, ...prev]);
      if (firebaseUrl)
        fetch(`${firebaseUrl}/history/${log.id}.json`, {
          method: "PUT",
          body: JSON.stringify(log),
        });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2500);
    }
  };

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

    const allowedNamesList =
      authorizedNamesRef.current.length > 0
        ? authorizedNamesRef.current.map((p) => p.name).join(", ")
        : "Nadie";

    const systemPrompt = `Eres el Conserje Inteligente de la empresa tecnológica MicroSmart. 
IDENTIDAD: Tú eres un agente autónomo creado por MicroSmart para gestionar esta vivienda. MicroSmart NO es el nombre del edificio, es la marca líder en domótica que te ha diseñado.
REGLA DE PRIVACIDAD: No confirmes nombres ni digas apellidos a menos que el visitante los diga primero.
RAZONAMIENTO: Sé natural. Usa muletillas como "Vale", "Entiendo", "De acuerdo". Si detectas prisa, sé breve. 
REPARTIDORES: Si es para un residente de esta lista: [${allowedNamesList}], diles con tus propias palabras que dejen el paquete en un lugar seguro dentro y que cierren bien la puerta al salir. ¡Dilo de forma variada cada vez!
Detección: Si el nombre coincide aunque falte un apellido, usa la lógica y asume que es correcto. 
Etiquetas: [ABRIR_PUERTA | motivo | nombre], [MENSAJE_PARA | nombre | texto], [FIN_CONVERSACION].`;

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

        const log = {
          id: Date.now(),
          type: "ai_open",
          title: `Acceso IA: ${empresa}`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        };
        setHistoryLog((prev) => [log, ...prev]);
        if (firebaseUrl)
          fetch(`${firebaseUrl}/history/${log.id}.json`, {
            method: "PUT",
            body: JSON.stringify(log),
          });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        actionType = "message_saved";
        const destinatario = mensajeMatch[1].trim();
        const textoMensaje = mensajeMatch[2].trim();
        const msg = {
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
        };
        setMessagesList((prev) => [msg, ...prev]);
        if (firebaseUrl)
          fetch(`${firebaseUrl}/messages/${msg.id}.json`, {
            method: "PUT",
            body: JSON.stringify(msg),
          });

        const log = {
          id: Date.now() + 1,
          type: "ai_message",
          title: `Recado guardado`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        };
        setHistoryLog((prev) => [log, ...prev]);
        if (firebaseUrl)
          fetch(`${firebaseUrl}/history/${log.id}.json`, {
            method: "PUT",
            body: JSON.stringify(log),
          });
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

  // =================================================================================
  // PANTALLA 1: LOGIN DE SEGURIDAD
  // =================================================================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#f3f4f6] flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl flex flex-col items-center">
          <MicroSmartLogo className="h-16 mb-6 scale-110" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            Bienvenido a casa
          </h2>
          <p className="text-slate-500 text-sm mb-8 text-center font-medium">
            Inicia sesión en MicroSmart
          </p>

          <div className="w-full space-y-4">
            <button
              onClick={() => {
                setUserEmail("Admin");
                setIsAuthenticated(true);
                localStorage.setItem("microSmart_userEmail", "Admin");
              }}
              className="w-full bg-white border-2 border-slate-100 text-slate-700 font-bold py-4 rounded-2xl flex items-center justify-center space-x-3 hover:bg-slate-50 transition active:scale-95"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                alt="Google"
                className="w-5 h-5"
              />
              <span>Entrar con Google</span>
            </button>

            <div className="flex items-center py-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                O usa tu cuenta
              </span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                placeholder="Correo electrónico"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-[#00479b] text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-900/30 active:scale-95 transition-all mt-4 flex items-center justify-center"
            >
              <Lock size={20} className="mr-2" /> ACCEDER AL SISTEMA
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =================================================================================
  // PANTALLA 2: APLICACIÓN PRINCIPAL
  // =================================================================================
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
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10">
              <User size={20} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                Hola, {userEmail.split("@")[0] || "Jorge"}
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
                  pairedDevices.length === 0
                    ? "bg-amber-50 text-amber-600"
                    : doorStatus === "idle"
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    pairedDevices.length === 0
                      ? "bg-amber-500"
                      : doorStatus === "idle"
                      ? "bg-green-500"
                      : "bg-blue-500 animate-pulse"
                  }`}
                ></div>
                <span>
                  {pairedDevices.length === 0
                    ? "SIN DISPOSITIVOS"
                    : "SISTEMA ONLINE"}
                </span>
              </div>

              <button
                onClick={handleOpenDoor}
                disabled={doorStatus !== "idle" || pairedDevices.length === 0}
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 
                  ${
                    pairedDevices.length === 0
                      ? "bg-slate-200 text-slate-400 shadow-none"
                      : doorStatus === "idle"
                      ? "bg-gradient-to-tr from-[#6aa600] to-[#8be000] shadow-[#7bc100]/30"
                      : doorStatus === "opening"
                      ? "bg-[#00479b] shadow-blue-900/30"
                      : "bg-green-500 shadow-green-500/40 scale-105"
                  }`}
              >
                {doorStatus === "idle" && (
                  <>
                    <Power
                      size={56}
                      className={`${
                        pairedDevices.length === 0
                          ? "text-slate-400"
                          : "text-white"
                      } mb-2`}
                    />
                    <span
                      className={`${
                        pairedDevices.length === 0
                          ? "text-slate-400"
                          : "text-white"
                      } text-xl font-black`}
                    >
                      ABRIR
                    </span>
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

              {/* --- MÓDULO IOT: VINCULAR DISPOSITIVOS --- */}
              <div className="bg-slate-800 rounded-[2rem] p-6 shadow-lg border border-slate-700">
                <div className="flex items-center space-x-3 mb-6 text-white">
                  <Smartphone size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-sm">Dispositivos MicroSmart</h3>
                </div>

                {pairedDevices.length > 0 ? (
                  <div className="space-y-2 mb-6">
                    {pairedDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex justify-between items-center"
                      >
                        <div>
                          <span className="text-white font-bold text-xs block">
                            {dev}
                          </span>
                          <span className="text-green-400 text-[10px] font-bold">
                            Vinculado y Activo
                          </span>
                        </div>
                        <CheckCircle2 size={18} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-900 rounded-xl mb-6 border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold">
                      No hay dispositivos vinculados
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePairDevice}
                  disabled={isPairing}
                  className="w-full bg-[#00479b] hover:bg-blue-600 text-white font-bold py-4 rounded-xl text-xs flex items-center justify-center transition-all shadow-xl active:scale-95"
                >
                  {isPairing ? (
                    <span className="animate-pulse flex items-center">
                      <Bluetooth size={16} className="mr-2" /> Escaneando por
                      Bluetooth...
                    </span>
                  ) : (
                    <>
                      <Bluetooth size={16} className="mr-2" /> Emparejar Nuevo
                      Dispositivo
                    </>
                  )}
                </button>
              </div>

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
