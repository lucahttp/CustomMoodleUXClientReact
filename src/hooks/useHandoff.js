import { useEffect } from "react";
import { executeTool } from "./mcpTools"; // We'll create this to share tools between WebMCP and Handoff

/**
 * useHandoff — connects to the pion/handoff signaling server to establish
 * a WebRTC DataChannel with a backend MCP server.
 */
export const useHandoff = ({ courses, session, handleCourseClick, handleSyncAll, dbService }) => {
  // OBSOLETO: El viejo puente WebRTC P2P ha sido reemplazado por la arquitectura OPFS + Socket.io en handoffProxy.js
  // Se anuló este hook para evitar los errores de ERR_CONNECTION_REFUSED hacia el puerto 8080.
};
