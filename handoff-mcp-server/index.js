const express = require('express');
const cors = require('cors');
const nodeDataChannel = require('node-datachannel');

const PORT = process.env.PORT || 8080;
const app = express();

app.use(cors());
app.use(express.json());

let dc = null;

app.post('/handoff', (req, res) => {
    // The browser sends an offer
    const { type, sdp } = req.body;

    if (type !== 'offer') {
        return res.status(400).send('Expected an offer');
    }

    const peerConnection = new nodeDataChannel.PeerConnection('PeerConnection', {
        iceServers: ['stun:stun.l.google.com:19302']
    });

    peerConnection.onStateChange((state) => {
        // console.error(`[NodeMCP] PC State:`, state);
    });

    peerConnection.onGatheringStateChange((state) => {
        // console.error(`[NodeMCP] Gathering State:`, state);
        if (state === 'complete') {
            const answer = peerConnection.localDescription();
            res.json({ type: answer.type, sdp: answer.sdp });
        }
    });

    peerConnection.onDataChannel((dataChannel) => {
        dc = dataChannel;
        // console.error(`[NodeMCP] Data channel opened: ${dc.getLabel()}`);

        dc.onMessage((msg) => {
            // Received response from Browser, forward to MCP Client (Claude Desktop) via stdout
            console.log(msg);
        });

        dc.onClosed(() => {
            // console.error(`[NodeMCP] Data channel closed`);
            dc = null;
        });
    });

    peerConnection.setRemoteDescription(sdp, type);
});

app.listen(PORT, '0.0.0.0', () => {
    // We log to stderr to not interfere with MCP stdout jsonrpc
    // console.error(`[NodeMCP] Handoff Signaling Server running on http://0.0.0.0:${PORT}`);
});

// MCP stdio reading
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            // Verify valid JSON before sending
            JSON.parse(line);
            if (dc && dc.isOpen()) {
                dc.sendMessage(line);
            } else {
                // If not connected yet, ideally we should queue or return an error
                // console.error(`[NodeMCP] Dropped message (no channel):`, line);
            }
        } catch (e) {
            // Ignore non-JSON lines or parse errors silently to maintain MCP integrity
        }
    }
});
