import { parseSkillTextMany } from '@/core/skills/skill-parser'
import type { PromptSkill } from '@/shared/types'

const candidateFileNames = ['prompt-skill.json', 'prompt-skill.yaml', 'prompt-skill.yml', 'skill.json', 'skill.yaml', 'skill.yml']
const skillFilePattern = /(^|\/)(prompt-skill|skill|[^/]+\.skill)\.(json|ya?ml)$/i
const maxRecursiveSkills = 50
const maxSkillFileBytes = 256 * 1024

interface GithubRepoRef {
  owner: string
  repo: string
  ref?: string
  path?: string
}

interface GithubRepoMeta {
  default_branch?: string
}

interface GithubTreeItem {
  path?: string
  type?: 'blob' | 'tree' | string
  size?: number
}

interface GithubTreeResponse {
  tree?: GithubTreeItem[]
  truncated?: boolean
}

const parseGithubRepoRef = (url: URL): GithubRepoRef | null => {
  const parts = url.pathname.split('/').filter(Boolean)
  if (url.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
    const [owner, repo, ref, ...rest] = parts
    return { owner, repo, ref, path: rest.join('/') }
  }
  if (url.hostname === 'github.com' && parts.length >= 5 && parts[2] === 'blob') {
    const [owner, repo, _blob, ref, ...rest] = parts
    return { owner, repo, ref, path: rest.join('/') }
  }
  if (url.hostname === 'github.com' && parts.length >= 2) {
    const [owner, repo] = parts
    return { owner, repo }
  }
  return null
}

const toRawGithubUrl = (repoRef: GithubRepoRef, path: string, ref: string): string =>
  `https://raw.githubusercontent.com/${repoRef.owner}/${repoRef.repo}/${ref}/${path}`

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github.raw, text/plain, application/json' },
  })
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`)
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > maxSkillFileBytes) {
    throw new Error(`${url} 文件过大，超过 256KB 限制`)
  }
  const text = await response.text()
  if (new Blob([text]).size > maxSkillFileBytes) {
    throw new Error(`${url} 文件过大，超过 256KB 限制`)
  }
  return text
}

const fetchDefaultBranch = async (repoRef: GithubRepoRef): Promise<string> => {
  if (repoRef.ref) return repoRef.ref
  try {
    const response = await fetch(`https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}`, {
      headers: { accept: 'application/vnd.github+json' },
    })
    if (response.ok) {
      const meta = (await response.json()) as GithubRepoMeta
      if (meta.default_branch) return meta.default_branch
    }
  } catch {
    // Fall through to main/master probing.
  }
  return 'main'
}

const discoverRecursiveCandidatePaths = async (repoRef: GithubRepoRef, ref: string): Promise<string[]> => {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      { headers: { accept: 'application/vnd.github+json' } },
    )
    if (!response.ok) return []
    const data = (await response.json()) as GithubTreeResponse
    const paths = (data.tree ?? [])
      .filter((item) => item.type === 'blob' && item.path && skillFilePattern.test(item.path))
      .filter((item) => (item.size ?? 0) <= maxSkillFileBytes)
      .map((item) => item.path as string)
      .slice(0, maxRecursiveSkills)
    return paths
  } catch {
    return []
  }
}

const getCandidateRawUrls = async (input: string): Promise<string[]> => {
  const url = new URL(input)
  if (url.hostname === 'raw.githubusercontent.com') {
    return [url.toString()]
  }

  const repoRef = parseGithubRepoRef(url)
  if (!repoRef) return [url.toString()]

  const ref = await fetchDefaultBranch(repoRef)
  if (repoRef.path) {
    return [toRawGithubUrl(repoRef, repoRef.path, ref)]
  }

  const recursivePaths = await discoverRecursiveCandidatePaths(repoRef, ref)
  const fallbackPaths = candidateFileNames
  const dedupedPaths = [...new Set([...recursivePaths, ...fallbackPaths])]
  return dedupedPaths.map((path) => toRawGithubUrl(repoRef, path, ref))
}

export const importSkillsFromGithubUrl = async (input: string): Promise<PromptSkill[]> => {
  const candidates = await getCandidateRawUrls(input)
  const imported: PromptSkill[] = []
  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      const text = await fetchText(candidate)
      const skills = parseSkillTextMany(text, 'github-url').map((skill) => ({
        ...skill,
        repoUrl: input,
      }))
      imported.push(...skills)
      if (imported.length >= maxRecursiveSkills) break
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  const unique = [...new Map(imported.map((skill) => [skill.id, skill])).values()]
  if (unique.length > 0) return unique.slice(0, maxRecursiveSkills)

  throw new Error(`GitHub 导入失败：${errors.at(-1) ?? '未找到可导入的 Skill 文件'}`)
}

export const importSkillFromGithubUrl = async (input: string): Promise<PromptSkill> => {
  const skills = await importSkillsFromGithubUrl(input)
  if (skills.length > 1) {
    throw new Error(`该链接发现 ${skills.length} 个 Skill，请使用批量导入入口`)
  }
  return skills[0]
}
