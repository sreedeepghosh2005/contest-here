import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import Showcase from "./Showcase";

// `vite build --mode pages` builds the public demo site; the normal build is the real join page.
const Root = import.meta.env.MODE === "pages" ? Showcase : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
