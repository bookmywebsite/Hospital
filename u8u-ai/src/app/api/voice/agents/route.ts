/**
 * Voice Agent Management
 * CRUD operations for voice agents
 * POST: Create agent
 * GET: List or get single agent
 * PATCH: Update agent
 * DELETE: Delete agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CREATE Agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      organizationId = 'default',
      name,
      language = 'en-IN',
      voiceId = 'en-IN-NeerjaNeural',
      greeting = 'Hello. Thank you for calling. How may I help you?',
      systemPrompt,
      tools = [],
      isActive = true,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      );
    }

    const agent = await prisma.voiceAgent.create({
      data: {
        organizationId,
        name,
        language,
        voiceId,
        greeting,
        systemPrompt:
          systemPrompt ||
          `You are ${name}, an AI assistant. Be helpful, warm, and professional. 
         Keep responses short for voice calls (max 2 sentences). 
         Don't diagnose or prescribe medical advice. Speak in ${language}.`,
        isActive,
      },
    });

    console.log(`[Agents] Created agent: ${agent.id} (${name})`);

    return NextResponse.json(
      {
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          language: agent.language,
          voiceId: agent.voiceId,
          greeting: agent.greeting,
          isActive: agent.isActive,
          createdAt: agent.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Agents POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create agent' },
      { status: 500 }
    );
  }
}

// LIST / GET Agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    const organizationId = searchParams.get('organizationId') || 'default';

    if (agentId) {
      // Get single agent
      const agent = await prisma.voiceAgent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, agent });
    } else {
      // List all agents
      const agents = await prisma.voiceAgent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({
        success: true,
        count: agents.length,
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          language: a.language,
          voiceId: a.voiceId,
          greeting: a.greeting,
          isActive: a.isActive,
          createdAt: a.createdAt,
        })),
      });
    }
  } catch (error: any) {
    console.error('[Agents GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE Agent
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      language,
      voiceId,
      greeting,
      systemPrompt,
      isActive,
    } = body;

    const agent = await prisma.voiceAgent.update({
      where: { id: agentId },
      data: {
        ...(name && { name }),
        ...(language && { language }),
        ...(voiceId && { voiceId }),
        ...(greeting && { greeting }),
        ...(systemPrompt && { systemPrompt }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });

    console.log(`[Agents] Updated agent: ${agentId}`);

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        language: agent.language,
        voiceId: agent.voiceId,
        greeting: agent.greeting,
        isActive: agent.isActive,
        updatedAt: agent.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Agents PATCH] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update agent' },
      { status: 500 }
    );
  }
}

// DELETE Agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    await prisma.voiceAgent.delete({
      where: { id: agentId },
    });

    console.log(`[Agents] Deleted agent: ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted',
    });
  } catch (error: any) {
    console.error('[Agents DELETE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete agent' },
      { status: 500 }
    );
  }
}
