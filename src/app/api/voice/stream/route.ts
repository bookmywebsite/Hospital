import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'voice-stream',
    websocket: true,
    message:
      'Voice WebSocket streaming is handled by the standalone voice server.',
  });
}



// // src/app/api/voice/stream/route.ts
// // This handles the WebSocket connection for real-time voice streaming
// export const dynamic = 'force-dynamic';
// import { WebSocketServer } from 'ws';
// import { DeepgramLiveSTT } from '@/lib/voice/deepgram-stt';
// import { AzureLiveTTS } from '@/lib/voice/azure-tts';
// import { GroqDualBrain } from '@/lib/voice/groq-brain';
// import { prisma } from '@/lib/prisma';

// // NOTE: For Next.js on Vercel, WebSocket handling requires a
// // custom server. See Part 14 for deployment options.
// // For development, we use a standalone WebSocket server.

// export function createVoiceStreamHandler(wss: WebSocketServer) {
//   wss.on('connection', async (ws, req) => {
//     console.log('New voice stream connection');

//     let stt: DeepgramLiveSTT;
//     let tts: AzureLiveTTS;
//     let brain: GroqDualBrain;
//     let streamSid = '';
//     let callSid = '';
//     let callerNumber = '';
//     let direction = 'inbound';
//     let fullTranscript = '';
//     let isAgentSpeaking = false;
//     let callRecord: any = null;

//     // Handle messages from Twilio
//     ws.on('message', async (message: string) => {
//       try {
//         const msg = JSON.parse(message);

//         switch (msg.event) {
//           case 'connected':
//             console.log('Twilio stream connected');
//             break;

//           case 'start':
//             // Call just started - initialize everything
//             streamSid = msg.start.streamSid;
//             callSid = msg.start.customParameters?.callSid || '';
//             callerNumber = msg.start.customParameters?.callerNumber || '';
//             direction = msg.start.customParameters?.direction || 'inbound';

//             // Load agent for this phone number
//             const agent = await prisma.voiceAgent.findFirst({
//               where: { isActive: true },
//               // include: { knowledgeBase: true }
//             });

//             if (!agent) {
//               console.error('No active agent found');
//               ws.close();
//               return;
//             }

//             // Create call record in database
//             callRecord = await prisma.voiceCall.create({
//               data: {
//                 agentId: agent.id,
//                 direction,
//                 callerNumber,
//                 calledNumber: msg.start.customParameters?.calledNumber || '',
//                 status: 'in-progress',
//                 twilioCallSid: callSid,
//                 startedAt: new Date(),
//               }
//             });

//             // Define tools the AI can use
//             const tools = [
//               {
//                 type: 'function' as const,
//                 function: {
//                   name: 'book_appointment',
//                   description: 'Book an appointment for the caller',
//                   parameters: {
//                     type: 'object',
//                     properties: {
//                       date: { type: 'string', description: 'Date like 2024-01-15' },
//                       time: { type: 'string', description: 'Time like 10:00 AM' },
//                       service: { type: 'string', description: 'What service' },
//                     },
//                     required: ['date', 'time'],
//                   },
//                 },
//               },
//               {
//                 type: 'function' as const,
//                 function: {
//                   name: 'transfer_to_human',
//                   description: 'Transfer call to a human agent when requested or when the AI cannot help',
//                   parameters: { type: 'object', properties: {} },
//                 },
//               },
//               {
//                 type: 'function' as const,
//                 function: {
//                   name: 'check_availability',
//                   description: 'Check available appointment slots',
//                   parameters: {
//                     type: 'object',
//                     properties: {
//                       date: { type: 'string', description: 'Date to check' },
//                     },
//                     required: ['date'],
//                   },
//                 },
//               },
//             ];

//             // Initialize the AI brain with agent's system prompt
//             brain = new GroqDualBrain({
//                 systemPrompt: agent.systemPrompt,
//                 language: agent.language,
//             });

//             // Initialize TTS - sends audio back to caller
//             tts = new AzureLiveTTS(agent.voiceId, (audioChunk: Buffer) => {
//               // Send audio back through Twilio WebSocket
//               const payload = audioChunk.toString('base64');
//               ws.send(JSON.stringify({
//                 event: 'media',
//                 streamSid,
//                 media: { payload },
//               }));
//             });

//             // Initialize STT - listens to caller
//             stt = new DeepgramLiveSTT(async (event) => {
//                 const text = event.transcript;
//                 const isFinal = event.isFinal;
//               if (!isFinal || !text.trim()) return;
//               if (isAgentSpeaking) return; // Don't process while agent is talking

//               console.log(`Caller said: ${text}`);
//               fullTranscript += `\nCaller: ${text}`;

//               // Save caller message
//               await prisma.callMessage.create({
//                 data: { callId: callRecord.id, role: 'caller', content: text }
//               });

//               // === DUAL BRAIN: SLM filler + LLM real response ===
//               isAgentSpeaking = true;

//               // 1. FAST: Get filler from SLM (80ms)
//               const fillerPromise = brain.generateFiller(text);
//               // 2. SMART: Get real response from LLM (300-500ms)
//               const responsePromise = brain.generateResponse(text);

//               // Speak the filler immediately
//               const filler = await fillerPromise;
//               await tts.speak(filler);

//               // Now speak the real response
//               const result = await responsePromise;
//                 const response = result.answer;

//               // Handle special commands
//               if (response === '__TRANSFER__') {
//                 // Transfer to human
//                 await tts.speak('Let me transfer you to a team member. Please hold.');
//                 // TODO: Implement Twilio call transfer
//                 isAgentSpeaking = false;
//                 return;
//               }

//               await tts.speak(response);
//               fullTranscript += `\nAgent: ${filler} ${response}`;

//               // Save agent message
//               await prisma.callMessage.create({
//                 data: { callId: callRecord.id, role: 'agent', content: response }
//               });

//               isAgentSpeaking = false;
//             });

//             await stt.start(); // 'en', 'hi', 'kn', etc.

//             // Speak greeting immediately when call connects
//             await tts.speak(agent.greeting);
//             fullTranscript += `\nAgent: ${agent.greeting}`;
//             break;

//           case 'media':
//             // Audio chunk from caller - send to STT
//             if (stt && msg.media?.payload) {
//               const audioBuffer = Buffer.from(msg.media.payload, 'base64');
//               stt.sendAudio(audioBuffer);
//             }
//             break;

//           case 'stop':
//             // Call ended - cleanup and analyze
//             console.log('Call ended');
//             if (stt) await stt.stop();
//             if (tts) tts.close();

//             // Analyze the call with AI
//             if (brain && fullTranscript && callRecord) {
//               try {
//                 const analysis = await brain.classifyCall(fullTranscript);
//                 await prisma.voiceCall.update({
//                   where: { id: callRecord.id },
//                   data: {
//                     status: 'completed',
//                     transcript: fullTranscript,
//                     summary: analysis.summary,
//                     sentiment: analysis.sentiment,
//                     leadScore: analysis.leadScore,
//                     extractedData: analysis.extractedData,
//                     endedAt: new Date(),
//                     duration: Math.floor(
//                       (Date.now() - callRecord.startedAt.getTime()) / 1000
//                     ),
//                   }
//                 });
//                 console.log('Call analyzed:', analysis);
//               } catch (e) {
//                 console.error('Analysis failed:', e);
//               }
//             }
//             break;
//         }
//       } catch (error) {
//         console.error('Stream error:', error);
//       }
//     });

//     ws.on('close', () => {
//       console.log('Stream disconnected');
//       if (stt) stt.stop();
//       if (tts) tts.close();
//     });
//   });
// }




// // /**
// //  * Voice Stream Information Endpoint
// //  * Returns information about the WebSocket streaming server
// //  * 
// //  * NOTE: Actual WebSocket handling is done by standalone voice-server.ts
// //  * because Next.js/Vercel don't support persistent WebSocket connections.
// //  * 
// //  * This endpoint can be used for:
// //  * - Health checks
// //  * - Stream information
// //  * - Debugging
// //  */

// // import { NextRequest, NextResponse } from 'next/server';

// // export async function GET(request: NextRequest) {
// //   const wsUrl = process.env.VOICE_WS_SERVER_URL || '';
  
// //   if (!wsUrl) {
// //     return NextResponse.json(
// //       {
// //         error: 'Voice streaming server not configured',
// //         help: 'Set VOICE_WS_SERVER_URL environment variable to WebSocket server URL (e.g., wss://your-server.railway.app)',
// //       },
// //       { status: 503 }
// //     );
// //   }

// //   return NextResponse.json({
// //     status: 'ok',
// //     wsUrl,
// //     info: {
// //       streaming: 'Twilio Media Streams WebSocket',
// //       languages: ['en-IN', 'hi-IN', 'kn-IN', 'ta-IN', 'te-IN', 'ml-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'pa-IN', 'or-IN'],
// //       stt: 'Deepgram nova-2',
// //       tts: 'Azure Speech',
// //       brain: 'Groq (Llama dual-brain)',
// //     },
// //   });
// // }

// // export async function POST(request: NextRequest) {
// //   // This receives webhooks from Twilio if configured (informational only)
// //   try {
// //     const body = await request.json();
// //     console.log('[Stream] Received event:', body.event);
// //     return NextResponse.json({ received: true });
// //   } catch {
// //     return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
// //   }
// // }

