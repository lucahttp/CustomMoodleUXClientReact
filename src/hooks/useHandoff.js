import { useEffect } from "react";
import { executeTool } from "./mcpTools"; // We'll create this to share tools between WebMCP and Handoff

/**
 * useHandoff — connects to the pion/handoff signaling server to establish
 * a WebRTC DataChannel with a backend MCP server.
 */
export const useHandoff = ({ courses, session, handleCourseClick, handleSyncAll, dbService }) => {
  useEffect(() => {
    const mode = localStorage.getItem("mcp_mode");
    if (mode !== "handoff") return;

    const handoffUrl = localStorage.getItem("handoff_url") || "http://localhost:8080";
    console.log(`[Handoff] Initializing connection to ${handoffUrl}`);

    const bootstrapUrl = `${handoffUrl}/handoff`;
    let peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // We expect the local MCP server to create the DataChannel
    peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`[Handoff] Data channel opened: ${channel.label}`);

      channel.onopen = () => {
        console.log(`[Handoff] Data channel ready to receive MCP requests`);
      };

      channel.onmessage = async (msgEvent) => {
        try {
          const request = JSON.parse(msgEvent.data);
          console.log(`[Handoff] Received request:`, request);

          if (request.jsonrpc === "2.0") {
            // Handle MCP jsonrpc requests
            if (request.method === "tools/list") {
              import("./mcpTools").then(({ getToolsList }) => {
                const tools = getToolsList();
                channel.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  result: { tools }
                }));
              });
            } else if (request.method === "tools/call") {
              const { name, arguments: args } = request.params;
              try {
                const result = await executeTool(name, args, { courses, session, handleCourseClick, handleSyncAll, dbService });
                channel.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  result: result
                }));
              } catch (error) {
                channel.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  error: { code: -32603, message: error.message }
                }));
              }
            }
          }
        } catch (e) {
          console.error(`[Handoff] Error handling message:`, e);
        }
      };
    };

    // Since pion/handoff requires the browser to send the initial offer?
    // Looking at pion/handoff docs, typically browser creates the peerConnection, but `handoff.js` overrides it.
    // Let's implement our own simple WebRTC signaling over HTTP or just act as the initiator
    const startSignaling = async () => {
      try {
        const channel = peerConnection.createDataChannel("mcp-channel");

        channel.onopen = () => {
          console.log(`[Handoff] Created Data channel ready`);
        };

        channel.onmessage = async (msgEvent) => {
          try {
            const request = JSON.parse(msgEvent.data);
            console.log(`[Handoff] Received request:`, request);

            if (request.jsonrpc === "2.0") {
              // Handle MCP jsonrpc requests
              if (request.method === "tools/list") {
                const { getToolsList } = await import("./mcpTools");
                const tools = getToolsList();
                channel.send(JSON.stringify({
                  jsonrpc: "2.0",
                  id: request.id,
                  result: { tools }
                }));
              } else if (request.method === "tools/call") {
                const { name, arguments: args } = request.params;
                const { executeTool } = await import("./mcpTools");
                try {
                  const result = await executeTool(name, args, { courses, session, handleCourseClick, handleSyncAll, dbService });
                  channel.send(JSON.stringify({
                    jsonrpc: "2.0",
                    id: request.id,
                    result: result
                  }));
                } catch (error) {
                  channel.send(JSON.stringify({
                    jsonrpc: "2.0",
                    id: request.id,
                    error: { code: -32603, message: error.message }
                  }));
                }
              }
            }
          } catch (e) {
            console.error(`[Handoff] Error handling message:`, e);
          }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Wait for ICE gathering to complete before sending the offer
        await new Promise((resolve) => {
            if (peerConnection.iceGatheringState === 'complete') {
                resolve();
            } else {
                const checkState = () => {
                    if (peerConnection.iceGatheringState === 'complete') {
                        peerConnection.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                };
                peerConnection.addEventListener('icegatheringstatechange', checkState);
            }
        });

        const res = await fetch(bootstrapUrl, {
            method: 'POST',
            body: JSON.stringify({ type: offer.type, sdp: peerConnection.localDescription.sdp }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            throw new Error(`Signaling failed: ${res.statusText}`);
        }

        const answer = await res.json();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[Handoff] Connection established successfully.`);

      } catch (err) {
        console.error(`[Handoff] Signaling error:`, err);
        // Retry logic could go here
      }
    };

    startSignaling();

    return () => {
      peerConnection.close();
    };
  }, [courses, session, handleCourseClick, handleSyncAll, dbService]);
};
