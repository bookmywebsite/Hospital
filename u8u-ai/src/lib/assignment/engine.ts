import { prisma } from '@/lib/prisma';

interface AssignmentResult {
    success: boolean;
    assignedTo?: any;
    reason: string;
}

// ── Main assignment engine ────────────────────────────────────────────────────

export async function assignLead(leadId: string): Promise<AssignmentResult> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
    });

    if (!lead) return { success: false, reason: 'Lead not found' };
    if (lead.assignedToId) return { success: false, reason: 'Lead already assigned' };

    // Fetch organization separately (organization is not a relation on Lead)
    const org = await prisma.organization.findUnique({
        where: { id: lead.organizationId },
    });
    
    const mode = org?.assignmentMode ?? 'ROUND_ROBIN';

    let assignee: any = null;
    let reason = '';

    switch (mode) {
        case 'ROUND_ROBIN': {
            const r = await assignRoundRobin(lead);
            assignee = r.assignee;
            reason = r.reason;
            break;
        }
        case 'SKILL_BASED': {
            const r = await assignSkillBased(lead);
            assignee = r.assignee;
            reason = r.reason;
            break;
        }
        case 'LOAD_BALANCED': {
            const r = await assignLoadBalanced(lead);
            assignee = r.assignee;
            reason = r.reason;
            break;
        }
        case 'MANUAL':
            return { success: false, reason: 'Manual assignment mode — no auto-assignment' };
        default:
            return { success: false, reason: `Unknown mode: ${mode}` };
    }

    if (!assignee) return { success: false, reason: reason || 'No available team member' };

    // Update lead — use raw prisma to avoid schema type conflicts
    await (prisma as any).lead.update({
        where: { id: leadId },
        data: { assignedToId: assignee.id, assignedAt: new Date() },
    });

    // Update team member stats
    await (prisma as any).teamMember.update({
        where: { id: assignee.id },
        data: {
            totalAssigned: { increment: 1 },
            currentLeadCount: { increment: 1 },
            lastAssignedAt: new Date(),
        },
    });

    // Log activity
    await prisma.activity.create({
        data: {
            leadId,
            type: 'lead_assigned',
            title: `Lead assigned via ${mode}`,
            description: `Assigned to ${assignee.id} — ${reason}`,
            actorType: 'system',
            metadata: { assigneeId: assignee.id, mode, reason },
        },
    });

    console.log(`[Assignment] Lead ${leadId} → ${assignee.id} via ${mode}`);
    return { success: true, assignedTo: assignee, reason };
}

// ── Round Robin ───────────────────────────────────────────────────────────────

async function assignRoundRobin(lead: any): Promise<{ assignee: any; reason: string }> {
    const teamMembers = await (prisma as any).teamMember.findMany({
        where: {
            organizationId: lead.organizationId,
            isAvailable: true,
        },
        orderBy: [
            { lastAssignedAt: 'asc' },
            { totalAssigned: 'asc' },
        ],
        include: { user: true },
    });

    if (teamMembers.length === 0) {
        return { assignee: null, reason: 'No available team members' };
    }

    return { assignee: teamMembers[0], reason: 'Round robin — next in queue' };
}

// ── Skill Based ───────────────────────────────────────────────────────────────

async function assignSkillBased(lead: any): Promise<{ assignee: any; reason: string }> {
    // Check assignment rules first
    const rules = await (prisma as any).assignmentRule.findMany({
        where: { organizationId: lead.organizationId, isActive: true },
        orderBy: { priority: 'desc' },
        include: { assignTo: true },
    });

    for (const rule of rules) {
        if (matchesRule(lead, rule)) {
            if (rule.assignTo?.isAvailable) {
                return { assignee: rule.assignTo, reason: `Matched rule: ${rule.name}` };
            }
        }
    }

    // Language matching fallback
    const leadLang = lead.preferredLanguage ?? 'EN';
    const langMatchers = await (prisma as any).teamMember.findMany({
        where: {
            organizationId: lead.organizationId,
            isAvailable: true,
            languages: { has: leadLang },
        },
        orderBy: { currentLeadCount: 'asc' },
        include: { user: true },
    });

    if (langMatchers.length > 0) {
        return { assignee: langMatchers[0], reason: `Language match: ${leadLang}` };
    }

    return assignRoundRobin(lead);
}

// ── Load Balanced ─────────────────────────────────────────────────────────────

async function assignLoadBalanced(lead: any): Promise<{ assignee: any; reason: string }> {
    const teamMembers = await (prisma as any).teamMember.findMany({
        where: { organizationId: lead.organizationId, isAvailable: true },
        include: { user: true },
    });

    if (teamMembers.length === 0) {
        return { assignee: null, reason: 'No available team members' };
    }

    const memberLoads = teamMembers.map((m: any) => ({
        member: m,
        loadPercentage: m.currentLeadCount / (m.maxLeadsPerDay || 50),
    }));

    memberLoads.sort((a: any, b: any) => a.loadPercentage - b.loadPercentage);

    const selected = memberLoads[0];
    if (selected.loadPercentage >= 1) {
        return { assignee: null, reason: 'All team members at capacity' };
    }

    return {
        assignee: selected.member,
        reason: `Load balanced — ${Math.round(selected.loadPercentage * 100)}% capacity`,
    };
}

// ── Rule matching ─────────────────────────────────────────────────────────────

function matchesRule(lead: any, rule: any): boolean {
    const conditions = rule.conditions as Record<string, any>;

    for (const [key, value] of Object.entries(conditions)) {
        switch (key) {
            case 'tier':
                if (lead.tier !== value) return false;
                break;
            case 'source':
                if (lead.source !== value) return false;
                break;
            case 'scoreMin':
                if ((lead.score ?? 0) < value) return false;
                break;
            case 'scoreMax':
                if ((lead.score ?? 0) > value) return false;
                break;
            case 'language':
                if ((lead.preferredLanguage ?? 'EN') !== value) return false;
                break;
            case 'company':
                if (!lead.company?.toLowerCase().includes(String(value).toLowerCase())) return false;
                break;
        }
    }

    return true;
}

// ── Reassign ──────────────────────────────────────────────────────────────────

export async function reassignLead(leadId: string, reason: string): Promise<AssignmentResult> {
    const lead = await (prisma as any).lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, reason: 'Lead not found' };

    // Decrement previous assignee count
    if (lead.assignedToId) {
        await (prisma as any).teamMember.update({
            where: { id: lead.assignedToId },
            data: { currentLeadCount: { decrement: 1 } },
        }).catch(() => { });
    }

    // Clear assignment
    await (prisma as any).lead.update({
        where: { id: leadId },
        data: { assignedToId: null, assignedAt: null },
    });

    return assignLead(leadId);
}

// ── Bulk assign ───────────────────────────────────────────────────────────────

export async function bulkAssignLeads(leadIds: string[]): Promise<{
    assigned: number;
    failed: number;
    results: AssignmentResult[];
}> {
    const results: AssignmentResult[] = [];
    let assigned = 0;
    let failed = 0;

    for (const leadId of leadIds) {
        const result = await assignLead(leadId);
        results.push(result);
        if (result.success) assigned++;
        else failed++;
    }

    return { assigned, failed, results };
}

// ── Reset daily lead counts (called at midnight) ──────────────────────────────

export async function resetDailyLeadCounts(organizationId: string): Promise<void> {
    await (prisma as any).teamMember.updateMany({
        where: { organizationId },
        data: { currentLeadCount: 0 },
    });
    console.log(`[Assignment] Reset daily counts for org ${organizationId}`);
}