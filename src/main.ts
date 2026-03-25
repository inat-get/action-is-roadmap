// src/main.ts
import * as core from '@actions/core'
import * as github from '@actions/github' // Убедимся, что импорт есть
import { fetchData } from './github.js'
import { loadConfig } from './config.js'
import { generateDiagram } from './mermaid.js'
import { writeOutput } from './output.js'

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github_token', { required: true })
    const outputType = core.getInput('output_type') as 'file' | 'wiki'
    const outputPath = core.getInput('output_path')
    const wikiTitle = core.getInput('wiki_title')
    const configFile = core.getInput('config_file')
    const excludeLabel = core.getInput('exclude_label') || null

    // Получаем owner и repo из контекста
    const { owner, repo } = github.context.repo

    core.info('Fetching data from GitHub...')
    const { milestones, issues } = await fetchData(token, excludeLabel)

    core.info(`Found ${milestones.length} milestones, ${issues.length} issues`)

    if (issues.length === 0 && milestones.length === 0) {
      core.warning('No data found to generate roadmap')
    }

    core.info('Loading configuration...')
    const config = loadConfig(configFile)

    core.info('Generating diagram...')
    // Передаём owner и repo в генератор
    const diagram = generateDiagram(milestones, issues, config, owner, repo)

    core.info('Writing output...')
    await writeOutput(diagram, outputType, outputPath, wikiTitle, token)

    core.setOutput('diagram', diagram)
    core.info('Done!')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
