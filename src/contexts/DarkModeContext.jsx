import { createContext, useContext, useState, useEffect } from "react";

const DarkModeContext = createContext();

// Fonction pour obtenir l'état initial depuis localStorage
function getInitialDarkMode() {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem("darkMode");
    if (saved === null) return false;
    const parsed = JSON.parse(saved);
    return parsed === true;
  } catch {
    return false;
  }
}

// Appliquer la classe dark immédiatement (synchrone, avant React)
function applyDarkModeClass(isDark) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Appliquer l'état initial au chargement de la page (avant React)
const initialDarkMode = getInitialDarkMode();
applyDarkModeClass(initialDarkMode);

export function DarkModeProvider({ children }) {
  // Initialiser depuis localStorage
  const [darkMode, setDarkMode] = useState(initialDarkMode);

  // Appliquer la classe à chaque changement de darkMode
  useEffect(() => {
    applyDarkModeClass(darkMode);
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem("darkMode", JSON.stringify(darkMode));
    } catch (e) {
      console.error("Erreur sauvegarde darkMode:", e);
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newValue = !prev;
      // Appliquer immédiatement pour une réactivité instantanée
      applyDarkModeClass(newValue);
      // Sauvegarder immédiatement aussi
      try {
        localStorage.setItem("darkMode", JSON.stringify(newValue));
      } catch (e) {
        console.error("Erreur sauvegarde darkMode:", e);
      }
      return newValue;
    });
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error("useDarkMode must be used within DarkModeProvider");
  }
  return context;
}
