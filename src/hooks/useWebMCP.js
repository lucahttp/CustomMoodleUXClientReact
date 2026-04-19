import { useEffect } from "react";
import { getToolsList, executeTool } from "./mcpTools";

/**
 * useWebMCP — Registers Moodle tools into navigator.modelContext (WebMCP).
 * Runs inside a react-frame-component iframe, so we use window.top to reach
 * the top-level page where modelContext lives.
 */
export const useWebMCP = ({ courses, session, handleCourseClick, handleSyncAll, dbService }) => {
  useEffect(() => {
    // Check if we are in WebMCP mode
    const mode = localStorage.getItem("mcp_mode");
    if (mode === "handoff") return;

    const mc = (window.top || window).navigator?.modelContext;
    if (!mc) {
      console.warn("[WebMCP] navigator.modelContext not available. Enable #enable-webmcp-testing in chrome://flags.");
      return;
    }

    const tools = getToolsList();

    tools.forEach(tool => {
      mc.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (args) => {
          return executeTool(tool.name, args, { courses, session, handleCourseClick, handleSyncAll, dbService });
        }
      });
    });

    // Cleanup
    return () => {
      tools.forEach(tool => mc.unregisterTool(tool.name));
    };
  }, [courses, session, handleCourseClick, handleSyncAll, dbService]);
};
