import { Issue, Milestone } from './github.js'
import { StyleConfig } from './config.js'
import * as core from '@actions/core'

export function generateDiagram(
  milestones: Milestone[],
  issues: Issue[],
  config: StyleConfig,
  owner: string, // Добавлено
  repo: string // Добавлено
): string {
  const lines: string[] = []
  const weights = config.weights || {}
  const clickCommands: string[] = [] // Хранилище для click-команд

  lines.push('flowchart TB')

  // Class definitions
  lines.push(
    `classDef open fill:${config.colors.issues.open},color:#fff,stroke:#fff`
  )
  lines.push(
    `classDef closed fill:${config.colors.issues.closed},color:#fff,stroke:#fff`
  )
  lines.push('')

  // Map для быстрого доступа к issue по номеру
  const issueMap = new Map(issues.map((i) => [i.number, i]))

  core.info(`Available issues: [${Array.from(issueMap.keys()).join(', ')}]`)

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

  // Generate subgraphs for milestones
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

    // Добавляем ссылку на milestone (работает в большинстве рендеров Mermaid)
    clickCommands.push(
      `click M${milestone.number} href "https://github.com/${owner}/${repo}/milestone/${milestone.number}"`
    )

    const milestoneIssues = issuesByMilestone.get(milestone.title) || []
    for (const issue of milestoneIssues) {
      lines.push(`  ${formatNode(issue, config)}`)
      // Добавляем ссылку на issue
      clickCommands.push(
        `click I${issue.number} href "https://github.com/${owner}/${repo}/issues/${issue.number}"`
      )
    }

    lines.push('end')
    lines.push('')
  })

  // Orphan issues (top level)
  for (const issue of orphanIssues) {
    lines.push(formatNode(issue, config))
    clickCommands.push(
      `click I${issue.number} href "https://github.com/${owner}/${repo}/issues/${issue.number}"`
    )
  }
  if (orphanIssues.length > 0) lines.push('')

  // Dependencies (blockedBy relationships)
  core.info(`Generating dependencies for ${issues.length} issues...`)

  const blockingLinks: string[] = []
  for (const issue of issues) {
    core.info(
      `Issue #${issue.number} (milestone: ${issue.milestone || 'none'}) has ${issue.blockedBy.length} blockers: [${issue.blockedBy.join(', ')}]`
    )

    for (const blockerNum of issue.blockedBy) {
      const blocker = issueMap.get(blockerNum)

      if (!blocker) {
        core.info(`  Blocker #${blockerNum} not found in current issues set`)
        continue
      }

      if (issue.milestone === blocker.milestone) {
        blockingLinks.push(`I${blockerNum} --> I${issue.number}`)
        core.info(
          `  Added arrow: I${blockerNum} --> I${issue.number} (same milestone: ${issue.milestone})`
        )
      } else {
        core.info(
          `  Skipping cross-milestone arrow: #${blockerNum} (${blocker.milestone || 'no ms'}) --> #${issue.number} (${issue.milestone || 'no ms'})`
        )
      }
    }
  }

  // Sub-issues relationships
  const subIssueLinks: string[] = []
  core.info(`Generating sub-issues relationships...`)

  for (const issue of issues) {
    if (!issue.parent) continue

    const parent = issueMap.get(issue.parent)

    if (!parent) {
      core.info(
        `  Parent #${issue.parent} for issue #${issue.number} not found in current issues set`
      )
      continue
    }

    if (issue.milestone === parent.milestone) {
      subIssueLinks.push(`I${issue.number} --> I${issue.parent}`)
      core.info(
        `  Added sub-issue link: I${issue.number} --> I${issue.parent} (same milestone: ${issue.milestone})`
      )
    } else {
      core.info(
        `  Skipping cross-milestone sub-issue: #${issue.number} (${issue.milestone || 'no ms'}) --> #${issue.parent} (${parent.milestone || 'no ms'})`
      )
    }
  }

  // Chronological arrows между consecutive milestones
  const chronologicalLinks: string[] = []
  for (let i = 0; i < milestones.length - 1; i++) {
    if (milestones[i].dueOn && milestones[i + 1].dueOn) {
      chronologicalLinks.push(
        `M${milestones[i].number} ==> M${milestones[i + 1].number}`
      )
    }
  }

  // Добавляем связи в диаграмму
  if (blockingLinks.length > 0) {
    lines.push(...blockingLinks)
    lines.push('')
  }

  if (subIssueLinks.length > 0) {
    lines.push(...subIssueLinks)
    lines.push('')
  }

  if (chronologicalLinks.length > 0) {
    lines.push(...chronologicalLinks)
    lines.push('')
  }

  // Стили для связей
  let linkIndex = 0

  if (blockingLinks.length > 0) {
    for (let i = 0; i < blockingLinks.length; i++) {
      lines.push(
        `linkStyle ${linkIndex} stroke:${config.colors.arrows.blocking},stroke-width:${weights.blocking || 1}px`
      )
      linkIndex++
    }
    lines.push('')
  }

  if (subIssueLinks.length > 0) {
    for (let i = 0; i < subIssueLinks.length; i++) {
      lines.push(
        `linkStyle ${linkIndex} stroke:${config.colors.arrows.subIssues},stroke-width:${weights.subIssues || 2}px`
      )
      linkIndex++
    }
    lines.push('')
  }

  if (chronologicalLinks.length > 0) {
    for (let i = 0; i < chronologicalLinks.length; i++) {
      lines.push(
        `linkStyle ${linkIndex} stroke:${config.colors.arrows.chronological},stroke-width:${weights.chronological || 3}px`
      )
      linkIndex++
    }
  }

  // Добавляем кликабельные ссылки в конец диаграммы
  if (clickCommands.length > 0) {
    lines.push('')
    lines.push('%% Clickable links')
    lines.push(...clickCommands)
  }

  return lines.join('\n')
}

function formatNode(issue: Issue, config: StyleConfig): string {
  const safeTitle = escapeMermaid(issue.title)
  const shape = config.shapes.issue
  const className = issue.state === 'open' ? 'open' : 'closed'

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
    .substring(0, 100)
}
