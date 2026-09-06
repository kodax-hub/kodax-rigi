import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import "@/styles.css";
import { AnonymizerApp } from "@/components/AnonymizerApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnonymizerApp />
    <Toaster position="bottom-right" theme="dark" />
  </StrictMode>,
);
