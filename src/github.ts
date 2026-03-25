import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'

export interface Issue {
  number: number
  title: string
  state: 'open' | 'closed'
  milestone: string | null
  labels: string[]
  blockedBy: number[]
}

export interface Milestone {
  number: number
  title: string
  dueOn: string | null
  state: 'open' | 'closed'
}

// GraphQL response types
interface GraphQLIssueResponse {
  repository: {
    issue: {
      trackedInIssues: {
        nodes: Array<{ number: number }>
      }
    } | null
  }
}

export async function fetchData(
  token: string,
  excludeLabel: string | null
): Promise<{ milestones: Milestone[]; issues: Issue[] }> {
  const octokit = new Octokit({ auth: token })
  const { owner, repo } = github.context.repo

  // Fetch open milestones sorted by due date
  const { data: milestones } = await octokit.rest.issues.listMilestones({
    owner,
    repo,
    state: 'open',
    sort: 'due_on',
    direction: 'asc'
  })

  const milestoneNumbers = milestones.map((m) => m.number)

  // Fetch all issues from open milestones + open orphan issues
  const issues: Issue[] = []

  // GraphQL для получения связей blockedBy
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`
    }
  })

  // Fetch issues with pagination
  let page = 1

  while (true) {
    const { data: pageIssues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      per_page: 100,
      page
    })

    if (pageIssues.length === 0) {
      break
    }

    for (const issue of pageIssues) {
      // Skip PRs
      if ('pull_request' in issue) continue

      // Skip if has exclude_label
      if (
        excludeLabel &&
        issue.labels.some(
          (l) => (typeof l === 'string' ? l : l.name) === excludeLabel
        )
      )
        continue

      const milestoneTitle = issue.milestone ? issue.milestone.title : null

      // Include if:
      // 1. Belongs to open milestone, OR
      // 2. Open and no milestone (orphan)
      const inOpenMilestone =
        issue.milestone && milestoneNumbers.includes(issue.milestone.number)
      const isOpenOrphan = issue.state === 'open' && !issue.milestone

      if (!inOpenMilestone && !isOpenOrphan) continue

      // Fetch blockedBy relationships via GraphQL
      const blocked = await fetchBlockedBy(
        graphqlWithAuth,
        owner,
        repo,
        issue.number
      )

      issues.push({
        number: issue.number,
        title: issue.title,
        state: issue.state as 'open' | 'closed',
        milestone: milestoneTitle,
        labels: issue.labels.map((l) =>
          typeof l === 'string' ? l : l.name || ''
        ),
        blockedBy: blocked
      })
    }

    page++
  }

  return {
    milestones: milestones.map((m) => ({
      number: m.number,
      title: m.title,
      dueOn: m.due_on,
      state: m.state as 'open' | 'closed'
    })),
    issues
  }
}

async function fetchBlockedBy(
  graphqlWithAuth: typeof graphql,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<number[]> {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          trackedInIssues: trackedInIssues(first: 100) {
            nodes {
              number
            }
          }
        }
      }
    }
  `

  try {
    const result = await graphqlWithAuth<GraphQLIssueResponse>(query, {
      owner,
      repo,
      number: issueNumber
    })

    return (
      result.repository.issue?.trackedInIssues?.nodes?.map((n) => n.number) ||
      []
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.warning(
      `Failed to fetch blockedBy for issue #${issueNumber}: ${errorMessage}`
    )
    return []
  }
}
