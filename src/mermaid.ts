import { Issue, Milestone } from './github.js'
import { StyleConfig } from './config.js'
import * as core from '@actions/core'

export function generateDiagram(
  milestones: Milestone[],
  issues: Issue[],
  config: StyleConfig
): string {
  const lines: string[] = []

  lines.push('flowchart TB')

  // Class definitions
  lines.push(
    `classDef open fill:${config.colors.issues.open},color:#fff,stroke:#fff`
  )
  lines.push(
    `classDef closed fill:${config.colors.issues.closed},color:#fff,stroke:#fff`
  )
  lines.push('')

  // Track used nodes for dependency validation
  const issueNumbers = new Set(issues.map((i) => i.number))
  core.info(
    `Available issue numbers in diagram: [${Array.from(issueNumbers).join(', ')}]`
  )

  // Group issues by milestone
  const issuesByMilestone = new Map<string, Issue[]>()
  const orphanIssues: Issue[] = []

  for (const issue of issues) {
    if (issue.milestone) {
      if (!issuesByMilestone.has(issue.milestone)) {
        issuesByMilestone.set(issue.milestone, [])
      }
      issuesByMilestone.get(issue.milestone)!.push(issue)
    } else {
      orphanIssues.push(issue)
    }
  }

  // Generate subgraphs for milestones (sorted by due date)
  milestones.forEach((milestone, idx) => {
    const color =
      config.colors.milestones[idx % config.colors.milestones.length]
    const dueStr = milestone.dueOn ? ` (${milestone.dueOn.split('T')[0]})` : ''
    const safeTitle = escapeMermaid(milestone.title)

    lines.push(`subgraph M${milestone.number} ["${safeTitle}${dueStr}"]`)
    lines.push(
      `  style M${milestone.number} fill:${color},stroke:#333,stroke-width:2px`
    )
    lines.push('direction TB')

    const milestoneIssues = issuesByMilestone.get(milestone.title) || []
    for (const issue of milestoneIssues) {
      lines.push(`  ${formatNode(issue, config)}`)
    }

    lines.push('end')
    lines.push('')
  })

  // Orphan issues (top level)
  for (const issue of orphanIssues) {
    lines.push(formatNode(issue, config))
  }
  if (orphanIssues.length > 0) lines.push('')

  // Dependencies (blockedBy relationships)
  // Logic: if A is blockedBy B, then B → A (blocker points to blocked)
  core.info(`Generating dependencies for ${issues.length} issues...`) // <-- СЮДА

  // Logic: if A is blockedBy B, then B → A (blocker points to blocked)
  for (const issue of issues) {
    core.info(
      `Issue #${issue.number} has ${issue.blockedBy.length} blockers: [${issue.blockedBy.join(', ')}]`
    ) // <-- СЮДА

    for (const blockerNum of issue.blockedBy) {
      if (issueNumbers.has(blockerNum)) {
        lines.push(`I${blockerNum} --> I${issue.number}`)
        core.info(`  Added arrow: I${blockerNum} --> I${issue.number}`) // <-- СЮДА
      } else {
        core.info(`  Blocker #${blockerNum} not found in current issues set`) // <-- СЮДА
      }
    }
  }
  if (issues.some((i) => i.blockedBy.length > 0)) lines.push('')

  // Chronological arrows between consecutive milestones
  for (let i = 0; i < milestones.length - 1; i++) {
    if (milestones[i].dueOn && milestones[i + 1].dueOn) {
      lines.push(`M${milestones[i].number} -.-> M${milestones[i + 1].number}`)
    }
  }

  return lines.join('\n')
}

function formatNode(issue: Issue, config: StyleConfig): string {
  const safeTitle = escapeMermaid(issue.title)
  const shape = config.shapes.issue
  const className = issue.state === 'open' ? 'open' : 'closed'

  // Mermaid shapes syntax: ["text"] for box, ("") for round, ("") for stadium, etc.
  let formatted: string
  switch (shape) {
    case 'round':
      formatted = `I${issue.number}("${safeTitle}")`
      break
    case 'stadium':
      formatted = `I${issue.number}(["${safeTitle}"])`
      break
    case 'box':
    default:
      formatted = `I${issue.number}["${safeTitle}"]`
      break
  }

  return `${formatted}:::${className}`
}

function escapeMermaid(text: string): string {
  // Escape quotes and special characters for Mermaid
  return text
    .replace(/"/g, '#quot;')
    .replace(/\[/g, '#91;')
    .replace(/\]/g, '#93;')
    .replace(/\(/g, '#40;')
    .replace(/\)/g, '#41;')
    .replace(/{/g, '#123;')
    .replace(/}/g, '#125;')
    .replace(/</g, '#60;')
    .replace(/>/g, '#62;')
    .replace(/\|/g, '#124;')
    .replace(/\*/g, '#42;')
    .replace(/\n/g, ' ')
    .substring(0, 100) // Limit length to prevent diagram breaking
}
