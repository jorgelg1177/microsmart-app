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
  Mail,
  Key,
} from "lucide-react";

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, set, push, onValue } from "firebase/database";

// =========================================================================
// ⚠️ AQUÍ VAN TUS CLAVES REALES DE FIREBASE (Búscalas en la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyAyQe2Ev40lMOx6_gNvMGv6P86oRrGlHvg",
  authDomain: "portero-a87d8.firebaseapp.com",
  databaseURL:
    "https://portero-a87d8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "portero-a87d8",
  storageBucket: "portero-a87d8.firebasestorage.app",
  messagingSenderId: "779001621682",
  appId: "1:779001621682:web:ea0fed5bddc97e489dedab",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
// =========================================================================

const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      if (res.status === 401)
        throw new Error("Error 401: Clave de API inválida.");
      if (res.status === 404)
        throw new Error("Error 404: El modelo de IA no se encuentra.");
      if (res.status === 400 || res.status === 403 || res.status === 429) {
        throw new Error(
          `Error de Google (${res.status}): Revisar clave API o cuota`
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
  // --- ESTADOS DE SEGURIDAD Y REGISTRO ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // Puede ser 'login', 'register' o 'reset'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- ESTADOS PRINCIPALES DE LA APP ---
  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle");
  const [isPairing, setIsPairing] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [authorizedNames, setAuthorizedNames] = useState([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [historyLog, setHistoryLog] = useState([]);
  const [messagesList, setMessagesList] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // --- NUEVOS ESTADOS PARA EL MODAL BLUETOOTH ---
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [tempSsid, setTempSsid] = useState("");
  const [tempPass, setTempPass] = useState("");

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

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY; // Tu clave de Gemini
  const aiModel = "gemini-2.5-flash";

  // --- ESCUCHAR SI EL USUARIO ESTÁ LOGUEADO ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setHistoryLog([]);
        setPairedDevices([]);
        setAuthorizedNames([]);
        setMessagesList([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- CARGAR DATOS ÚNICOS DEL USUARIO DESDE FIREBASE ---
  useEffect(() => {
    if (currentUser) {
      const uid = currentUser.uid;

      // Cargar Dispositivos del usuario
      onValue(ref(db, `users/${uid}/devices`), (snapshot) => {
        setPairedDevices(snapshot.val() ? Object.values(snapshot.val()) : []);
      });

      // Cargar Nombres Autorizados
      onValue(ref(db, `users/${uid}/authorizedNames`), (snapshot) => {
        setAuthorizedNames(snapshot.val() ? Object.values(snapshot.val()) : []);
      });

      // Cargar Historial
      onValue(ref(db, `users/${uid}/history`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const loadedHistory = Object.keys(data)
            .map((key) => ({
              ...data[key],
              dbKey: key,
            }))
            .sort((a, b) => b.id - a.id);
          setHistoryLog(loadedHistory);
        } else {
          setHistoryLog([]);
        }
      });

      // Cargar Recados (Mensajes)
      onValue(ref(db, `users/${uid}/messages`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const loadedMessages = Object.keys(data)
            .map((key) => ({
              ...data[key],
              dbKey: key,
            }))
            .sort((a, b) => b.id - a.id);
          setMessagesList(loadedMessages);
        } else {
          setMessagesList([]);
        }
      });
    }
  }, [currentUser]);

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

  // --- FUNCIONES DE AUTENTICACIÓN ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthMessage("Cuenta creada con éxito.");
      } else if (authMode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setAuthMessage("Revisa tu correo para cambiar la contraseña.");
      }
    } catch (error) {
      setAuthError("Error: Verifica tus datos. " + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- GUARDADO PERSISTENTE EN BASE DE DATOS ---
  const saveToHistory = async (newLog) => {
    if (!currentUser) return;
    await push(ref(db, `users/${currentUser.uid}/history`), newLog);
  };

  const saveMessage = async (newMessage) => {
    if (!currentUser) return;
    await push(ref(db, `users/${currentUser.uid}/messages`), newMessage);
  };

  const handlePairDevice = async () => {
    if (!currentUser) return;
    setIsPairing(true);
    setTimeout(async () => {
      const newDevice = `ESP32_Interfono_${Math.floor(Math.random() * 1000)}`;
      const updatedDevices = [...pairedDevices, newDevice];
      await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
      setIsPairing(false);
    }, 3000);
  };

  // --- LA MAGIA DEL BLUETOOTH WEB ---
  const ejecutarEmparejamientoBLE = async () => {
    if (!currentUser) return;
    setIsPairing(true);

    try {
      // 1. Buscamos el ESP32
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "MicroSmart_ESP32" }],
        optionalServices: ["19b10000-e8f2-537e-4f6c-d104768a1214"],
      });

      // 2. Nos conectamos a su "Servicio"
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(
        "19b10000-e8f2-537e-4f6c-d104768a1214"
      );
      const characteristic = await service.getCharacteristic(
        "19b10001-e8f2-537e-4f6c-d104768a1214"
      );

      // 3. Juntamos el WiFi, la Clave y el UID invisible
      const payload = `${tempSsid}||${tempPass}||${currentUser.uid}`;
      const encoder = new TextEncoder();

      // 4. Se lo enviamos al ESP32
      await characteristic.writeValue(encoder.encode(payload));

      // 5. Lo guardamos en Firebase como vinculado
      const newDeviceName = "ESP32_Conserje_BLE";
      if (!pairedDevices.includes(newDeviceName)) {
        const updatedDevices = [...pairedDevices, newDeviceName];
        await set(ref(db, `users/${currentUser.uid}/devices`), updatedDevices);
      }

      alert(
        "¡Vinculado con éxito! El portero se está conectando al WiFi de tu casa."
      );
      setWifiModalOpen(false);
      setTempSsid("");
      setTempPass("");
    } catch (error) {
      console.error(error);
      alert(
        "Error de Bluetooth. Asegúrate de estar cerca y darle permisos al navegador."
      );
    } finally {
      setIsPairing(false);
    }
  };

  const handleAddName = async () => {
    if (newName.trim() && newPhone.trim() && currentUser) {
      const formattedPhone = newPhone.startsWith("+")
        ? newPhone.trim()
        : `+34 ${newPhone.trim()}`;
      const updatedNames = [
        ...authorizedNames,
        { name: newName.trim(), phone: formattedPhone },
      ];
      await set(
        ref(db, `users/${currentUser.uid}/authorizedNames`),
        updatedNames
      );
      setNewName("");
      setNewPhone("");
    }
  };

  const handleRemoveName = async (nameToRemove) => {
    if (!currentUser) return;
    const updatedNames = authorizedNames.filter(
      (person) => person.name !== nameToRemove
    );
    await set(
      ref(db, `users/${currentUser.uid}/authorizedNames`),
      updatedNames
    );
  };

  const handleOpenDoor = async () => {
    if (doorStatus !== "idle" || !currentUser) return;
    setDoorStatus("opening");
    try {
      await set(ref(db, `users/${currentUser.uid}/puerta/estado`), "ABRIR");
      setDoorStatus("opened");
      saveToHistory({
        id: Date.now(),
        type: "manual",
        title: "Apertura Manual",
        desc: `Desde App por ${currentUser.email}`,
        time: getCurrentTime(),
        date: "Hoy",
      });
    } catch (error) {
      alert("Error de conexión con la base de datos.");
      setDoorStatus("idle");
    } finally {
      setTimeout(() => setDoorStatus("idle"), 2500);
    }
  };

  // --- LÓGICA DE IA Y VOZ (INTACTA) ---
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

  const handleSimulateVisitor = async (textOverride) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || isTyping) return;

    if (!apiKey) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content: "⚠️ Sistema: No se detecta la clave API de Gemini.",
        },
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

    const systemPrompt = `Eres el Conserje Inteligente desarrollado por la empresa MicroSmart.
IMPORTANTE SOBRE TU IDENTIDAD: MicroSmart es una empresa tecnológica líder en domótica y sistemas autónomos.
Tú eres uno de sus productos, instalado para proteger esta vivienda privada. La casa NO se llama MicroSmart.
Si te preguntan quién o qué eres, responde con naturalidad que eres el sistema inteligente creado por MicroSmart.

REGLA 1 - PRIVACIDAD INNEGOCIABLE (MODO CAJA FUERTE):
NUNCA, bajo ningún concepto, reveles ni confirmes el apellido o nombre de un residente si el visitante no lo ha dicho de forma exacta primero.
- MAL: "¿Busca a Jorge Loaiza?".
- BIEN: "Entendido, ¿me podría indicar el apellido para confirmar?"

REGLA 2 - MODO CAMALEÓN Y NATURALIDAD (CERO ROBOT):
- Usa muletillas humanas al inicio de tus frases: "Vale", "Entiendo", "A ver...", "De acuerdo", "Perfecto", "Un segundo".
- NO repitas "por favor" o "gracias" en cada frase. Úsalas esporádicamente para que suene natural.
- Si el visitante tiene prisa (ej. "¡Amazon!", "Paquete"): Sé rápido y directo. Si está tranquilo, sé cálido.

REGLA 3 - INTELIGENCIA Y LÓGICA:
Si el visitante dice un nombre y al menos UN apellido correcto de la lista, dale el acceso por válido.

PROTOCOLOS ESTRICTOS DE SALIDA (Usa SIEMPRE las etiquetas al final de tu respuesta):
- REPARTIDORES: Cuando verifiques nombre y apellido, dales acceso.
SIEMPRE debes pedirles dos cosas: 1) Que dejen el paquete en un lugar seguro dentro y 2) Que se aseguren de cerrar bien la puerta al salir. Usa tus propias palabras cada vez.
-> [ABRIR_PUERTA | Empresa | Destinatario]
- VISITA VERIFICADA: "Adelante, puede pasar." -> [ABRIR_PUERTA | Visita | Nombre]
- NO AUTORIZADO: "Lo siento, sin el nombre completo no puedo abrir. Si quiere déjeme un recado y yo se lo paso."
-> [MENSAJE_PARA | Desconocido | texto]
- RECHAZO DIRECTO: [ACCESO_DENEGADO | Motivo]

REGLA DE AUTO-COLGADO:
Añade la etiqueta [FIN_CONVERSACION] ÚNICAMENTE cuando la conversación termine de forma natural.`;

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

        if (currentUser) {
          set(ref(db, `users/${currentUser.uid}/puerta/estado`), "ABRIR").catch(
            (e) => console.error(e)
          );
        }

        saveToHistory({
          id: Date.now(),
          type: "ai_open",
          title: `Acceso IA: ${empresa}`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      const mensajeMatch = aiText.match(
        /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/
      );
      if (mensajeMatch) {
        actionType = "message_saved";
        const destinatario = mensajeMatch[1].trim();
        const textoMensaje = mensajeMatch[2].trim();

        saveMessage({
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
        });

        saveToHistory({
          id: Date.now() + 1,
          type: "ai_message",
          title: `Recado guardado`,
          desc: `Para: ${destinatario}`,
          time: getCurrentTime(),
          date: "Hoy",
        });
      }

      const rechazoMatch = aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/);
      if (rechazoMatch) {
        actionType = "denied";
        const motivo = rechazoMatch[1].trim();
        saveToHistory({
          id: Date.now(),
          type: "ai_denied",
          title: `Acceso Denegado`,
          desc: motivo,
          time: getCurrentTime(),
          date: "Hoy",
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // =================================================================================
  // PANTALLA 1: LOGIN REAL CON FIREBASE AUTH (Logos 30% más grandes)
  // =================================================================================
  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-[#f3f4f6] flex items-center justify-center font-sans p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-8 shadow-2xl flex flex-col items-center">
          {/* LOGO 30% MÁS GRANDE (h-32) */}
          <MicroSmartLogo className="h-32 mb-8 scale-110" />

          <h2 className="text-2xl font-black text-slate-800 mb-2">
            {authMode === "login"
              ? "Bienvenido a casa"
              : authMode === "register"
              ? "Crear cuenta"
              : "Recuperar acceso"}
          </h2>
          <p className="text-slate-500 text-sm mb-6 text-center font-medium">
            {authMode === "login"
              ? "Inicia sesión para gestionar tu hogar MicroSmart"
              : authMode === "register"
              ? "Regístrate para vincular tus dispositivos"
              : "Te enviaremos un enlace para restaurar tu contraseña"}
          </p>

          {authError && (
            <div className="w-full bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mb-4 text-center border border-red-100">
              {authError}
            </div>
          )}
          {authMessage && (
            <div className="w-full bg-green-50 text-green-700 p-3 rounded-xl text-xs font-bold mb-4 text-center border border-green-100">
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuth} className="w-full space-y-3">
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="email"
                placeholder="Correo electrónico"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
              />
            </div>

            {authMode !== "reset" && (
              <div className="relative">
                <Key
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  required
                  minLength="6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-slate-800 font-medium"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#00479b] hover:bg-blue-800 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-blue-900/30 active:scale-95 transition-all mt-2 flex items-center justify-center"
            >
              {authLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : authMode === "login" ? (
                "ACCEDER AL SISTEMA"
              ) : authMode === "register" ? (
                "REGISTRARSE"
              ) : (
                "ENVIAR ENLACE"
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center space-y-3 w-full">
            {authMode === "login" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("reset");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-[#00479b] transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <div className="flex-grow border-t border-slate-100 w-full my-2"></div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  className="text-sm font-bold text-slate-600 hover:text-[#00479b] transition-colors"
                >
                  Crear una cuenta nueva
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                  setAuthMessage("");
                }}
                className="text-sm font-bold text-slate-600 hover:text-[#00479b] transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =================================================================================
  // PANTALLA 2: APLICACIÓN PRINCIPAL (Aislada por usuario)
  // =================================================================================
  return (
    <div className="fixed inset-0 w-screen h-[100dvh] bg-[#f3f4f6] flex items-center justify-center font-sans text-slate-900 overflow-hidden">
      {/* MODAL WIFI BLUETOOTH INVISIBLE */}
      {wifiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-center mb-4 text-[#00479b]">
              <Bluetooth size={32} />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">
              Conectar Portero
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6">
              Ingresa los datos del WiFi de tu casa. Enviaremos esta
              configuración a tu portero de forma segura e invisible.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nombre de tu WiFi"
                value={tempSsid}
                onChange={(e) => setTempSsid(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium"
              />
              <input
                type="password"
                placeholder="Contraseña del WiFi"
                value={tempPass}
                onChange={(e) => setTempPass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00479b] text-sm font-medium"
              />
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setWifiModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarEmparejamientoBLE}
                disabled={isPairing || !tempSsid || !tempPass}
                className="flex-1 py-3 bg-[#00479b] text-white rounded-xl font-bold text-sm shadow-lg flex justify-center items-center"
              >
                {isPairing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Vincular"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md h-full md:h-[92vh] md:max-h-[850px] md:rounded-[3rem] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col relative md:border-[10px] border-[#1e293b]">
        <div className="bg-white px-6 pt-8 pb-3 flex flex-col z-10 border-b border-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-3">
            {/* LOGO 30% MÁS GRANDE AQUÍ TAMBIÉN (h-[110px]) */}
            <MicroSmartLogo className="h-[110px] w-auto flex items-center" />
            <div className="flex space-x-1">
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 rounded-full transition-colors"
              >
                <LogOut size={20} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 bg-[#00479b] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10 shrink-0">
              <User size={20} className="text-white" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-800 leading-tight truncate">
                {currentUser.email}
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
                className={`relative w-56 h-56 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 ${
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
                  historyLog.map((log, i) => (
                    <div
                      key={i}
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
                  messagesList.map((msg, i) => (
                    <div
                      key={i}
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

              {/* --- MÓDULO IOT: VINCULAR DISPOSITIVOS (AHORA PERSISTENTE) --- */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg">
                <div className="flex items-center space-x-3 text-white mb-4">
                  <Smartphone size={18} className="text-[#7bc100]" />
                  <h3 className="font-bold text-sm">Dispositivos MicroSmart</h3>
                </div>

                {pairedDevices.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {pairedDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex justify-between items-center"
                      >
                        <div>
                          <span className="text-white font-bold text-xs block">
                            {dev}
                          </span>
                          <span className="text-green-400 text-[9px] font-bold">
                            Conectado a la cuenta
                          </span>
                        </div>
                        <CheckCircle2 size={16} className="text-green-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-slate-800/50 rounded-xl mb-4 border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold">
                      No hay telefonillos vinculados
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setWifiModalOpen(true)}
                  className="w-full bg-[#00479b] hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center transition-all shadow-xl active:scale-95"
                >
                  <Bluetooth size={16} className="mr-2" /> Emparejar por
                  Bluetooth
                </button>
              </div>

              {/* --- MÓDULO USUARIOS AUTORIZADOS --- */}
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

        {/* NAVEGACIÓN INFERIOR */}
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
