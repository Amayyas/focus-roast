import React from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./Popup";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root element not found in the popup.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
