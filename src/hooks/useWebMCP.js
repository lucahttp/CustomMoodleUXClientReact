import { useEffect } from "react";
import { getToolsList, executeTool } from "./mcpTools";

/**
 * useWebMCP — Registers Moodle tools into navigator.modelContext (WebMCP).
 * Runs inside a react-frame-component iframe, so we use window.top to reach
 * the top-level page where modelContext lives.
 */
export const useWebMCP = ({ courses, session, handleCourseClick, handleSyncAll }) => {
  useEffect(() => {
    // Check if we are in WebMCP mode
    const mode = localStorage.getItem("mcp_mode");
    if (mode === "handoff") return;

    const mc = (window.top || window).navigator?.modelContext;
    if (!mc) {
      console.warn("[WebMCP] navigator.modelContext not available. Enable #enable-webmcp-testing in chrome://flags.");
      return;
    }

    const hasSession = !!session.key;
    const tools = getToolsList(hasSession);

    const activateExtension = () => {
        window.top.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));
        window.dispatchEvent(new CustomEvent("getSessionObject", { detail: null }));
    };

    // Guard: prevent duplicate registration (React StrictMode runs effects twice)
    if (mc._toolsRegistered) return;
    mc._toolsRegistered = true;

    const controller = new AbortController();

    tools.forEach(tool => {
      try {
        mc.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: async (args) => {
            return executeTool(tool.name, args, { courses, session, handleCourseClick, handleSyncAll, activateExtension });
          }
        }, { signal: controller.signal });
      } catch (e) {
        console.error(`[WebMCP] Failed to register tool ${tool.name}:`, e);
      }
    });

    // Cleanup
    return () => {
      controller.abort();
    };
  }, [courses, session, handleCourseClick, handleSyncAll]);
};
