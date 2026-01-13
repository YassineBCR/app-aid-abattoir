import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <DarkModeProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </DarkModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
