// src/output.ts
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from '@actions/exec'

export async function writeOutput(
  diagram: string,
  outputType: 'file' | 'wiki',
  outputPath: string,
  wikiTitle: string,
  token: string
): Promise<void> {
  const { owner, repo } = github.context.repo
  const now = new Date().toISOString()

  const content = `# Project Roadmap

Generated: ${now}

\`\`\`mermaid
${diagram}
\`\`\`
`

  if (outputType === 'file') {
    // Write to file
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(outputPath, content)
    core.info(`Roadmap written to ${outputPath}`)

    // Commit using git
    await commitFile(outputPath, token)
  } else {
    // Write to wiki
    await writeToWiki(wikiTitle, content, token, owner, repo)
  }
}

async function commitFile(filePath: string, token: string): Promise<void> {
  try {
    await exec('git', ['config', 'user.name', 'github-actions[bot]'])
    await exec('git', [
      'config',
      'user.email',
      'github-actions[bot]@users.noreply.github.com'
    ])

    await exec('git', ['add', filePath])

    // Check if there are changes
    let hasChanges = false
    await exec('git', ['diff', '--cached', '--quiet'], {
      ignoreReturnCode: true,
      listeners: {
        stdline: () => {},
        errline: () => {},
        debug: () => {}
      }
    }).then((code) => {
      hasChanges = code !== 0
    })

    if (hasChanges) {
      await exec('git', ['commit', '-m', `Update roadmap [automated]`])
      await exec('git', ['push'])
      core.info('Changes committed and pushed')
    } else {
      core.info('No changes to commit')
    }
  } catch (error) {
    core.warning(`Failed to commit changes: ${error}`)
  }
}

async function writeToWiki(
  title: string,
  content: string,
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const wikiRepo = `https://x-access-token:${token}@github.com/${owner}/${repo}.wiki.git`
  const wikiDir = `.wiki-${Date.now()}`

  try {
    // Clone wiki
    await exec('git', ['clone', wikiRepo, wikiDir], {
      silent: true
    })

    // Write file
    const fileName = `${title.replace(/\s+/g, '-')}.md`
    fs.writeFileSync(path.join(wikiDir, fileName), content)

    // Commit
    await exec('git', [
      '-C',
      wikiDir,
      'config',
      'user.name',
      'github-actions[bot]'
    ])
    await exec('git', [
      '-C',
      wikiDir,
      'config',
      'user.email',
      'github-actions[bot]@users.noreply.github.com'
    ])
    await exec('git', ['-C', wikiDir, 'add', '.'])

    let hasChanges = false
    await exec('git', ['-C', wikiDir, 'diff', '--cached', '--quiet'], {
      ignoreReturnCode: true
    }).then((code) => {
      hasChanges = code !== 0
    })

    if (hasChanges) {
      await exec('git', [
        '-C',
        wikiDir,
        'commit',
        '-m',
        'Update roadmap [automated]'
      ])
      await exec('git', ['-C', wikiDir, 'push'])
      core.info(`Wiki page ${title} updated`)
    } else {
      core.info('No changes to wiki')
    }
  } catch (error) {
    if (
      error.message?.includes('Repository not found') ||
      error.message?.includes('Could not resolve host')
    ) {
      throw new Error('Wiki is not enabled for this repository')
    }
    throw error
  } finally {
    // Cleanup
    if (fs.existsSync(wikiDir)) {
      fs.rmSync(wikiDir, { recursive: true, force: true })
    }
  }
}
