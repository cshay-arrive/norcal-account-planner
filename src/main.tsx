import React from "react";
import ReactDOM from "react-dom/client";
import AccountBookPlanner from "./App";
import "./index.css";

const el = document.getElementById("root");
if (!el) throw new Error("Root element missing from index.html");

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <AccountBookPlanner />
  </React.StrictMode>,
);
