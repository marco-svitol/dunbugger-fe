import { useEffect, useState, useRef } from "react";

const WEBSOCKET_URL = process.env.REACT_APP_WSS_URL;
const DEVICE_ID = "raspberry123";
const GROUP_NAME = "velasquez";

export default function RaspberryMonitor() {
  const [ws, setWs] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [gpioStates, setGpioStates] = useState({});
  const [logs, setLogs] = useState([]);
  const [connectionId, setConnectionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logsVisible, setLogsVisible] = useState(true);
  const logsEndRef = useRef(null);

  useEffect(() => {
    const reconnectInterval = 5000;  // 5 seconds retry interval
    const maxRetries = 5;
    let retryCount = 0;

    console.log("WebSocket supported:", "WebSocket" in window);

    if (!WEBSOCKET_URL) {
      console.error("WebSocket URL is not defined in environment variables");
      return;
    }

    const connectWebSocket = () => {
      console.log("Connecting to WebSocket:", WEBSOCKET_URL);
      const socket = new WebSocket(WEBSOCKET_URL, 'json.webpubsub.azure.v1');
    
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onopen = () => {
        console.log("Connected to WebSocket");
        setWs(socket);
        setIsConnected(true);
        joinGroup(socket);
        retryCount = 0;  // Reset retry count after successful connection
      };

      socket.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        //TODO: to remove
        console.log("Received event data:", eventData);
        

        switch (eventData.type) {
          case "system":
            setConnectionId(eventData.connectionId);
            break;
          case "message":
            const message = JSON.parse(eventData.data)
            //capire da chi arriva e a chi è destinato
          case "device_online":
            if (message.device_id === DEVICE_ID) {
              setIsOnline(true);
              requestInitialState(socket);
            }
            break;
          case "initial_state":
            setGpioStates(message.gpio_states);
            setLogs(message.logs);
            break;
          case "gpio_update":
            setGpioStates((prev) => ({ ...prev, [message.gpio]: message.value }));
            break;
          case "message":
            setLogs((prev) => [...prev, message.data]);
            break;
          default:
            console.warn("Unknown message type:", message);
        }
      };

      socket.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        setIsOnline(false);
        setConnectionId(null);

        if (retryCount < maxRetries) {
          console.log(`Retrying connection in ${reconnectInterval / 1000} seconds...`);
          setTimeout(() => {
            retryCount++;
            connectWebSocket();
          }, reconnectInterval);
        } else {
          console.error("Max retries reached. Could not reconnect.");
        }
      };
    };

    connectWebSocket();
    return () => {
      // Cleanup on unmount
      if (ws) {
        ws.close();
      }
    };

  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const joinGroup = (socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "joinGroup", group: GROUP_NAME }));
      console.log(`Joined group: ${GROUP_NAME}`);
    }
  };

  const requestInitialState = (socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "request_initial_state", device_id: DEVICE_ID }));
    }
  };

  return (
    <div>
      <h2>Raspberry Monitor</h2>
      <p>WebSocket Status: {isConnected ? "Connected" : "Disconnected"}</p>
      <p>Connection ID: {connectionId || "N/A"}</p>
      <p>Device Status: {isOnline ? "Online" : "Offline"}</p>
      <h3>GPIO States</h3>
      <ul>
        {Object.entries(gpioStates).map(([gpio, value]) => (
          <li key={gpio}>{gpio}: {value}</li>
        ))}
      </ul>
      <h3>
        Logs
        <button onClick={() => setLogsVisible(!logsVisible)}>
          {logsVisible ? "-" : "+"}
        </button>
      </h3>
      {logsVisible && (
        <div style={{ position: "relative" }}>
          <textarea
            style={{ width: "100%", height: "200px", backgroundColor: "black", color: "white" }}
            value={logs.join("\n")}
            readOnly
          />
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
