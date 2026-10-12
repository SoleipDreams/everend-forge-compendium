import { createContext, useContext } from "react";

/** Standalone readers stay active; Suite can pause visual background work. */
export const ApplicationActivity = createContext(true);
export const useApplicationActive = () => useContext(ApplicationActivity);
