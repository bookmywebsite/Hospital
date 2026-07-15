import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const { url, agentType, createAgent, createKB, createPlaybook } = body;

    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    // Fetch website content
    let siteContent = '';
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      // Strip HTML tags
      siteContent = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
    } catch {
      siteContent = `Website: ${url}. Could not fetch content directly.`;
    }

    // Generate agent config using Groq
    const prompt = `You are an AI agent configuration expert for a hospital/healthcare platform.

Based on this website content:
"""${siteContent}"""

Website URL: ${url}
Agent Type: ${agentType}

Generate the following (only what is requested):
${createAgent    ? '1. AGENT CONFIG: name, role, welcomeMessage, companyName, a system prompt for hospital AI' : ''}
${createKB       ? '2. KNOWLEDGE BASE: 5-8 key FAQs about the hospital/clinic with answers' : ''}
${createPlaybook ? '3. HOSPITAL PLAYBOOK: conversation flow for appointments, triage, and patient support' : ''}

Format your response as JSON with keys: agentConfig, knowledgeBase, playbook
Keep it practical and specific to what you found on the website.
Return ONLY valid JSON, no markdown.`;

    const res = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      max_tokens:  2000,
      temperature: 0.6,
      messages:    [{ role: 'user', content: prompt }],
    });

    let generated: any = {};
    try {
      const raw = res.choices[0]?.message?.content ?? '{}';
      const clean = raw.replace(/```json|```/g, '').trim();
      generated = JSON.parse(clean);
    } catch {
      generated = {
        agentConfig: res.choices[0]?.message?.content ?? 'Agent configured',
        knowledgeBase: '',
        playbook: '',
      };
    }

    // Create agent in DB
    let newAgent = null;
    if (createAgent && generated.agentConfig) {
      const config = typeof generated.agentConfig === 'object' ? generated.agentConfig : {};
      newAgent = await prisma.agent.create({
        data: {
          organizationId: user.organizationId,
          name:           config.name          ?? `Health Agent`,
          role:           config.role          ?? agentType,
          welcomeMessage: config.welcomeMessage ?? `Hello! How can I help you today?`,
          companyName:    config.companyName    ?? url,
          isDefault:      false,
          isActive:       true,
        } as any,
      });
    }

    return NextResponse.json({
      success:      true,
      agentConfig:  typeof generated.agentConfig  === 'string' ? generated.agentConfig  : JSON.stringify(generated.agentConfig,  null, 2),
      knowledgeBase:typeof generated.knowledgeBase === 'string' ? generated.knowledgeBase : JSON.stringify(generated.knowledgeBase, null, 2),
      playbook:     typeof generated.playbook      === 'string' ? generated.playbook      : JSON.stringify(generated.playbook,      null, 2),
      agentId:      newAgent?.id ?? null,
    });
  } catch (error: any) {
    console.error('[Agent Setup]', error);
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 });
  }
}