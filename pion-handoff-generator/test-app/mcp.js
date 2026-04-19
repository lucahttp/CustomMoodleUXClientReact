const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const server = new Server(
    {
      name: "pion-handoff-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

// Herramientas MCP para agentes
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "list_active_handoffs",
                description: "Devuelve una lista de las sesiones handoff de WebRTC actualmente activas extraídas desde la base local (PGlite).",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            },
            {
                name: "inspect_handoff_session",
                description: "Inspecciona el estado profundo o tráfico interceptado de una sesión handoff WebRTC.",
                inputSchema: {
                    type: "object",
                    properties: {
                        sessionId: {
                            type: "string",
                            description: "ID de la sesión a inspeccionar"
                        }
                    },
                    required: ["sessionId"]
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "list_active_handoffs": {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify([{ id: "demo-session-id", status: "initiating" }], null, 2)
                }]
            };
        }
        case "inspect_handoff_session": {
            const { sessionId } = args;
            // Aquí en un escenario real nos comunicaríamos con un pipe IPC hacia el binario Go de Pion.
            return {
                content: [{
                    type: "text",
                    text: \`Mostrando tráfico desencriptado simulado para la sesión \${sessionId}...\n[ICE Completed] [DTLS OK] [SCTP Connected]\nTrack ID: audio-1 (Opus)\nTrack ID: video-1 (VP8)\`
                }]
            };
        }
        default:
            throw new Error(`Tool not found: ${name}`);
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Pion/Handoff MCP Server running on stdio");
}

main().catch(console.error);
