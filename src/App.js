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
} from "lucide-react";

// Implementación de Backoff Exponencial para las llamadas a la API
const fetchWithRetry = async (url, options, retries = 5, delay = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Helper para obtener la hora actual formateada
const getCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [doorStatus, setDoorStatus] = useState("idle"); // idle, opening, opened

  // Estado para las personas autorizadas en la casa
  const [authorizedNames, setAuthorizedNames] = useState([
    { name: "Carlos García", phone: "+34 600 111 222" },
    { name: "María López", phone: "+34 600 333 444" },
  ]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Estados de Registro de Actividad y Mensajes
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

  // Estados para el Simulador IA de Gemini
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: "ai",
      content:
        "Hola, soy el conserje de MicroSmart. ¿Con quién hablo y en qué le puedo ayudar?",
    },
  ]);
  const chatEndRef = useRef(null);

  // Auto-scroll del chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isTyping]);

  // Manejadores para añadir o quitar personas autorizadas
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

  // Simular la apertura de la puerta (manual)
  const handleOpenDoor = () => {
    if (doorStatus !== "idle") return;
    setDoorStatus("opening");

    setTimeout(() => {
      setDoorStatus("opened");

      // Registrar apertura manual
      setHistoryLog((prev) => [
        {
          id: Date.now(),
          type: "manual",
          title: "Apertura Manual",
          desc: "Realizado desde la App",
          time: getCurrentTime(),
          date: "Hoy",
        },
        ...prev,
      ]);

      setTimeout(() => {
        setDoorStatus("idle");
      }, 2000);
    }, 1500);
  };

  // Función que se comunica con la API de Gemini
  const handleSimulateVisitor = async () => {
    if (!chatInput.trim() || isTyping) return;

    const newUserMsg = { role: "user", content: chatInput };
    setChatHistory((prev) => [...prev, newUserMsg]);
    setChatInput("");
    setIsTyping(true);

    const apiKey = ""; // Clave API proporcionada por el entorno
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    const allowedNamesList =
      authorizedNames.length > 0
        ? authorizedNames.map((p) => p.name).join(", ")
        : "Nadie (la casa está vacía temporalmente)";

    // System Prompt Dinámico e Inteligente (BLINDADO CON ZERO TRUST)
    const systemPrompt = `Eres el conserje virtual de alta seguridad de una vivienda, creado por MicroSmart.
Tu PERSONALIDAD: Eres un profesional de seguridad educado, cordial y directo. Eres amable pero mantienes un tono formal y eficiente.

REGLAS DE SEGURIDAD CRÍTICAS (DE OBLIGADO CUMPLIMIENTO):
1. ZERO LEAKAGE (CERO FUGAS): NUNCA pronuncies, escribas o confirmes apellidos o nombres que el visitante NO haya dicho primero. Solo usa las palabras que el visitante te da.
2. VALIDACIÓN DE IDENTIDAD: El visitante DEBE dar el NOMBRE Y APELLIDO EXACTO de la persona que busca. Si solo dicen el nombre de pila, DETÉN el proceso y pregunta: "Disculpe, por motivos de seguridad, ¿me podría indicar también el apellido?".
3. OCULTACIÓN DE OCUPACIÓN: NUNCA digas que la casa está vacía, que no hay nadie, o que la persona "no está", a menos que el visitante haya dado el NOMBRE Y APELLIDO CORRECTO de una persona autorizada. Si el nombre no coincide, rechaza el acceso diciendo que se ha equivocado de casa.

PERSONAS AUTORIZADAS ACTUALMENTE: [${allowedNamesList}].

PROTOCOLO DE ACTUACIÓN PASO A PASO:
- PASO 1 (RECOPILAR): Escucha lo que quiere. Si es un repartidor, asegúrate de que te diga de qué EMPRESA DE REPARTO viene y el NOMBRE Y APELLIDO completos del destinatario. Si falta algo, pregúntalo.
- PASO 2 (EVALUAR): Solo cuando tengas todos los datos completos, compáralos con la lista de PERSONAS AUTORIZADAS.
- PASO 3A (REPARTIDOR VALIDADO): Si trae paquete de una EMPRESA para un Nombre y Apellido AUTORIZADO, dile: "Le abro la puerta, por favor ingrese y deje el paquete en un sitio seguro y al salir cierre bien la puerta". Añade EXACTAMENTE esta etiqueta al final: [ABRIR_PUERTA | NombreEmpresa | NombreCompletoAutorizado]
- PASO 3B (VISITA VALIDADA): Si busca a un Nombre y Apellido AUTORIZADO, AHORA SÍ puedes decirle que esa persona no se encuentra en este momento y ofrecerle amablemente tomar un recado.
- PASO 4 (TOMAR RECADO): Si te dicta un mensaje, confirma que lo guardarás. Añade EXACTAMENTE esta etiqueta al final: [MENSAJE_PARA | NombreCompletoAutorizado | texto del recado]
- PASO 5 (DENEGACIONES): Si es comercial o no acierta el nombre, recházalos con educación y firmeza. Añade EXACTAMENTE esta etiqueta al final: [ACCESO_DENEGADO | Motivo del rechazo]`;

    const contents = [
      ...chatHistory.filter((m) => m.role !== "system"),
      newUserMsg,
    ].map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: contents,
    };

    try {
      const data = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let aiText =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Error al procesar la respuesta.";

      // PARSEO ROBUSTO DE ETIQUETAS OCULTAS
      let didOpen = false;
      let actionType = null;
      const currentTime = getCurrentTime();

      // 1. Detección de Apertura
      if (aiText.includes("[ABRIR_PUERTA")) {
        didOpen = true;
        actionType = "opened";

        let company = "Desconocida";
        let recipient = "Desconocido";

        // Extraer Empresa y Destinatario separados por el símbolo "|"
        const openMatch = aiText.match(
          /\[ABRIR_PUERTA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/i
        );
        if (openMatch) {
          company = openMatch[1].trim();
          recipient = openMatch[2].trim();
        }

        // Ejecuta botón físico
        setDoorStatus("opening");
        setTimeout(() => setDoorStatus("opened"), 1500);
        setTimeout(() => setDoorStatus("idle"), 3500);

        // GUARDA EN EL HISTORIAL
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "ai_open",
            title: "Apertura por IA ✨",
            desc: `Paquete de ${company} para ${recipient}`,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      // 2. Detección de Mensajes
      else if (aiText.includes("[MENSAJE_PARA")) {
        actionType = "message_saved";
        let recipient = "Desconocido";
        let content = "Mensaje no procesado correctamente";

        const msgMatch = aiText.match(
          /\[MENSAJE_PARA\s*\|\s*(.*?)\s*\|\s*(.*?)\]/i
        );
        if (msgMatch) {
          recipient = msgMatch[1].trim();
          content = msgMatch[2].trim();
        }

        const matchedPerson = authorizedNames.find(
          (p) => p.name.toLowerCase() === recipient.toLowerCase()
        );
        const phone = matchedPerson ? matchedPerson.phone : "Desconocido";

        setMessagesList((prev) => [
          {
            id: Date.now(),
            recipient,
            phone,
            content,
            time: currentTime,
            date: "Hoy",
            read: false,
            autoSent: true,
          },
          ...prev,
        ]);

        // GUARDA EN EL HISTORIAL
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "message",
            title: "WhatsApp Automático ✨",
            desc: `Recado enviado a ${recipient}`,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      // 3. Detección de Acceso Denegado
      else if (aiText.includes("[ACCESO_DENEGADO")) {
        actionType = "denied";
        let reason = "Rechazado por seguridad";

        const denyMatch = aiText.match(/\[ACCESO_DENEGADO\s*\|\s*(.*?)\]/i);
        if (denyMatch) {
          reason = denyMatch[1].trim();
        }

        // GUARDA EN EL HISTORIAL
        setHistoryLog((prev) => [
          {
            id: Date.now(),
            type: "denied",
            title: "Acceso Denegado ✨",
            desc: reason,
            time: currentTime,
            date: "Hoy",
          },
          ...prev,
        ]);
      }

      // LIMPIEZA FINAL: Eliminar cualquier etiqueta de programación antes de mostrársela al usuario
      aiText = aiText.replace(/\[.*?\]/g, "").trim();

      setChatHistory((prev) => [
        ...prev,
        { role: "ai", content: aiText, action: actionType },
      ]);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "Ups... Hubo un problema conectando con el servidor de la IA.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="w-full max-w-md h-[850px] max-h-[90vh] bg-gray-50 rounded-[40px] shadow-2xl overflow-hidden flex flex-col relative border-[8px] border-gray-900">
        {/* Header de la App */}
        <div className="bg-white px-6 pt-12 pb-4 flex flex-col shadow-sm z-10 shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div className="h-10 flex items-center w-2/3">
              <img
                src="MICROSMART negro sin fondo.png"
                alt="MicroSmart"
                className="h-full w-auto object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
              <div className="hidden w-full h-full items-center justify-center border-2 border-dashed border-[#7bc100]/50 rounded-lg px-2 bg-gray-50">
                <span className="text-xs font-semibold text-gray-500 text-center">
                  Logo MicroSmart
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer">
                <User size={20} className="text-gray-600" />
              </div>
              {/* Notificación roja si hay mensajes */}
              {messagesList.length > 0 && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
              )}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Hola, {authorizedNames[0]?.name?.split(" ")[0] || "Usuario"}
            </h1>
            <p className="text-sm text-gray-500 flex items-center mt-1">
              <MapPin size={14} className="mr-1" /> Mi Hogar
            </p>
          </div>
        </div>

        {/* Área de Contenido Dinámico */}
        <div className="flex-1 overflow-y-auto pb-24 bg-gray-50 relative">
          {/* 1. PANTALLA PRINCIPAL (HOME) */}
          {activeTab === "home" && (
            <div className="p-6 flex flex-col items-center h-full justify-center space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="bg-white px-4 py-2 rounded-full shadow-sm flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-[#7bc100] rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-600">
                  Dispositivo en línea
                </span>
              </div>

              <div className="relative">
                {doorStatus === "opening" && (
                  <>
                    <div className="absolute inset-0 bg-[#00479b] rounded-full animate-ping opacity-40"></div>
                    <div className="absolute inset-[-20px] bg-[#00479b] rounded-full animate-ping opacity-20 animation-delay-200"></div>
                  </>
                )}
                <button
                  onClick={handleOpenDoor}
                  disabled={doorStatus !== "idle"}
                  className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 ${
                    doorStatus === "idle"
                      ? "bg-gradient-to-b from-[#8be000] to-[#6aa600] hover:scale-105 active:scale-95 shadow-[#7bc100]/40"
                      : doorStatus === "opening"
                      ? "bg-[#00479b] scale-95 shadow-inner"
                      : "bg-[#7bc100] scale-100 shadow-[#7bc100]/50"
                  }`}
                >
                  {doorStatus === "idle" && (
                    <>
                      <Power
                        size={64}
                        className="text-white mb-2 drop-shadow-md"
                      />
                      <span className="text-white text-2xl font-bold tracking-wider">
                        ABRIR
                      </span>
                      <span className="text-[#ecfccb] text-sm mt-1">
                        Pulsar para abrir
                      </span>
                    </>
                  )}
                  {doorStatus === "opening" && (
                    <>
                      <ShieldCheck
                        size={64}
                        className="text-white mb-2 animate-bounce"
                      />
                      <span className="text-white text-xl font-bold">
                        Abriendo...
                      </span>
                    </>
                  )}
                  {doorStatus === "opened" && (
                    <>
                      <ShieldCheck size={64} className="text-white mb-2" />
                      <span className="text-white text-xl font-bold">
                        ¡Abierto!
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 2. PANTALLA CONSERJE IA (SIMULADOR) */}
          {activeTab === "ai" && (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="p-6 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-800">
                    Simulador IA ✨
                  </h2>
                  <div className="w-12 h-6 bg-[#00479b] rounded-full flex items-center p-1 justify-end">
                    <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Todo lo que hables aquí quedará registrado en el Historial.
                </p>
              </div>

              {/* Chat del Simulador */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white/50">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm ${
                        msg.role === "user"
                          ? "bg-[#7bc100] text-white rounded-br-none"
                          : "bg-white border border-gray-100 text-gray-700 rounded-bl-none"
                      }`}
                    >
                      {msg.role === "ai" && (
                        <Sparkles
                          size={14}
                          className="inline mr-1 text-orange-400 mb-0.5"
                        />
                      )}
                      {msg.content}
                    </div>

                    {/* Alertas visuales de las acciones que toma la IA */}
                    {msg.action === "opened" && (
                      <div className="mt-2 text-[10px] font-bold text-green-700 flex items-center bg-green-100 px-3 py-1.5 rounded-full">
                        <Power size={12} className="mr-1" /> PUERTA ABIERTA Y
                        REGISTRADA
                      </div>
                    )}
                    {msg.action === "message_saved" && (
                      <div className="mt-2 text-[10px] font-bold text-[#00479b] flex items-center bg-blue-100 px-3 py-1.5 rounded-full">
                        <MessageSquare size={12} className="mr-1" /> RECARDO
                        GUARDADO EN "MENSAJES"
                      </div>
                    )}
                    {msg.action === "denied" && (
                      <div className="mt-2 text-[10px] font-bold text-red-600 flex items-center bg-red-100 px-3 py-1.5 rounded-full">
                        <ShieldAlert size={12} className="mr-1" /> ACCESO
                        DENEGADO Y REGISTRADO
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start">
                    <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-none shadow-sm flex space-x-1">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input del Chat */}
              <div className="p-4 bg-white border-t border-gray-100 shrink-0 mb-4">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleSimulateVisitor()
                    }
                    placeholder="Ej: Soy repartidor..."
                    className="w-full bg-gray-100 text-sm text-gray-800 rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#7bc100]/50"
                  />
                  <button
                    onClick={handleSimulateVisitor}
                    disabled={isTyping || !chatInput.trim()}
                    className="absolute right-2 p-1.5 bg-[#00479b] text-white rounded-full hover:bg-blue-800 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. PANTALLA HISTORIAL */}
          {activeTab === "history" && (
            <div className="p-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Actividad Reciente
              </h2>

              <div className="space-y-4">
                {historyLog.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center mt-10">
                    No hay actividad registrada aún.
                  </p>
                ) : (
                  historyLog.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white p-4 rounded-2xl shadow-sm flex items-start space-x-4 border border-gray-50"
                    >
                      <div
                        className={`p-3 rounded-full ${
                          log.type === "ai_open"
                            ? "bg-green-50 text-[#7bc100]"
                            : log.type === "manual"
                            ? "bg-blue-50 text-[#00479b]"
                            : log.type === "message"
                            ? "bg-purple-50 text-purple-600"
                            : "bg-red-50 text-red-500"
                        }`}
                      >
                        {log.type === "ai_open" && <Package size={20} />}
                        {log.type === "manual" && <User size={20} />}
                        {log.type === "message" && <MessageSquare size={20} />}
                        {log.type === "denied" && <ShieldAlert size={20} />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 text-sm">
                          {log.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                          {log.desc}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-gray-700 block">
                          {log.time}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {log.date}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. PANTALLA MENSAJES */}
          {activeTab === "messages" && (
            <div className="p-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Mensajes de Visitas
                </h2>
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                  {messagesList.length} nuevos
                </span>
              </div>

              <div className="space-y-4">
                {messagesList.length === 0 ? (
                  <div className="text-center mt-12 bg-white p-6 rounded-2xl border border-gray-100">
                    <MessageSquare
                      size={40}
                      className="text-gray-300 mx-auto mb-3"
                    />
                    <p className="text-sm text-gray-500">
                      No hay recados de visitas.
                      <br />
                      La IA filtrará y guardará los mensajes aquí.
                    </p>
                  </div>
                ) : (
                  messagesList.map((msg) => (
                    <div
                      key={msg.id}
                      className="bg-white p-5 rounded-2xl shadow-sm border border-l-4 border-l-[#7bc100] flex flex-col space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-[#00479b] tracking-wider uppercase">
                            Mensaje para
                          </span>
                          <h4 className="font-bold text-gray-800 text-sm">
                            {msg.recipient}{" "}
                            <span className="text-xs text-gray-400 font-normal">
                              ({msg.phone})
                            </span>
                          </h4>
                        </div>
                        <span className="text-xs text-gray-400">
                          {msg.time}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl italic">
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
                        className="flex items-center justify-center w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold transition-colors"
                      >
                        <PhoneForwarded size={14} className="mr-2" /> Enviar por
                        WhatsApp
                      </a>

                      <div className="flex items-center justify-center w-full mt-1 bg-green-50 text-green-700 border border-green-200 py-1.5 rounded-xl text-[10px] font-bold">
                        <ShieldCheck size={12} className="mr-1" /> Procesado por
                        IA
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. PANTALLA AJUSTES */}
          {activeTab === "settings" && (
            <div className="p-6 animate-in fade-in duration-300">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Ajustes Generales
              </h2>

              {/* SECCIÓN: PERSONAS AUTORIZADAS */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <UserPlus size={20} className="text-[#00479b]" />
                  <h3 className="font-bold text-gray-800">
                    Personas Autorizadas
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  La IA enviará los recados automáticamente al WhatsApp de estas
                  personas.
                </p>

                {/* Lista de Nombres */}
                <div className="space-y-2 mb-4">
                  {authorizedNames.length === 0 && (
                    <div className="text-xs text-orange-500 bg-orange-50 p-2 rounded text-center">
                      Nadie está autorizado ahora mismo.
                    </div>
                  )}
                  {authorizedNames.map((person, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-700 pl-2 block">
                          {person.name}
                        </span>
                        <span className="text-xs text-gray-500 pl-2 flex items-center mt-0.5">
                          <PhoneForwarded size={10} className="mr-1" />{" "}
                          {person.phone}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveName(person.name)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Input para añadir nombres y teléfonos */}
                <div className="flex flex-col space-y-2 mt-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre y Apellido..."
                    className="w-full bg-gray-50 border border-gray-200 text-sm text-gray-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7bc100]/50"
                  />
                  <div className="flex space-x-2">
                    <div className="flex flex-1 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#7bc100]/50 overflow-hidden">
                      <span className="bg-gray-100 text-gray-500 px-3 py-2 border-r border-gray-200 text-sm flex items-center font-medium">
                        +34
                      </span>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleAddName()}
                        placeholder="600 111 222"
                        className="flex-1 bg-transparent text-sm text-gray-800 px-3 py-2 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleAddName}
                      disabled={!newName.trim() || !newPhone.trim()}
                      className="bg-[#00479b] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* OTROS AJUSTES */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <Wifi size={20} className="text-[#00479b]" />
                    </div>
                    <span className="font-medium text-gray-700 text-sm">
                      Configurar Red WiFi
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-xs text-[#00479b] font-bold tracking-wide">
                  MICROSMART.ES
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Versión 1.1.0 (Build 2026)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Navegación Inferior */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex justify-between items-center z-20 pb-8">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center space-y-1 w-1/5 ${
              activeTab === "home" ? "text-[#00479b]" : "text-gray-400"
            }`}
          >
            <Home size={22} strokeWidth={activeTab === "home" ? 2.5 : 2} />
            <span className="text-[9px] font-bold">Inicio</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center space-y-1 w-1/5 ${
              activeTab === "history" ? "text-[#00479b]" : "text-gray-400"
            }`}
          >
            <Clock size={22} strokeWidth={activeTab === "history" ? 2.5 : 2} />
            <span className="text-[9px] font-bold">Historial</span>
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`relative flex flex-col items-center space-y-1 w-1/5 ${
              activeTab === "messages" ? "text-[#00479b]" : "text-gray-400"
            }`}
          >
            <div className="relative">
              <MessageSquare
                size={22}
                strokeWidth={activeTab === "messages" ? 2.5 : 2}
              />
              {messagesList.length > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <span className="text-[9px] font-bold">Mensajes</span>
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex flex-col items-center space-y-1 w-1/5 ${
              activeTab === "ai" ? "text-[#00479b]" : "text-gray-400"
            }`}
          >
            <Bot size={22} strokeWidth={activeTab === "ai" ? 2.5 : 2} />
            <span className="text-[9px] font-bold">Simulador</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center space-y-1 w-1/5 ${
              activeTab === "settings" ? "text-[#00479b]" : "text-gray-400"
            }`}
          >
            <Settings
              size={22}
              strokeWidth={activeTab === "settings" ? 2.5 : 2}
            />
            <span className="text-[9px] font-bold">Ajustes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
